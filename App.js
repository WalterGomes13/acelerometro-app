import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, PermissionsAndroid, ScrollView, Button, Dimensions, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { useState, useEffect, useRef, useMemo } from 'react';
import { decode } from 'react-native-quick-base64';
import { Canvas, Path, Skia, Text as SkiaText, useFont } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withTiming } from 'react-native-reanimated';
import FFT from 'fft.js';

const PADDING = { top: 20, right: 30, bottom: 30, left: 40 }; // left maior para labels Y
const containerWidth = Dimensions.get('window').width - 40;
const MAX_PONTOS_HISTORICO = 300;

const SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const TX_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"; // para receber dados do ESP32

// -----------------------------
// Função para calcular FFT
// -----------------------------
function calcularFFT(dados, sampleRate = 10) {
  const N = 64;
  const slice = Array.isArray(dados) ? dados.slice(-N) : [];

  const fft = new FFT(N);
  const out = fft.createComplexArray();
  const dataComplex = fft.createComplexArray();

  for (let i = 0; i < N; i++) {
    dataComplex[2 * i] = slice[i] ?? 0;
    dataComplex[2 * i + 1] = 0;
  }

  fft.transform(out, dataComplex);

  const magnitudes = [];
  for (let i = 0; i < N / 2; i++) {
    const re = out[2 * i];
    const im = out[2 * i + 1];
    const freq = (i * sampleRate) / N;
    magnitudes.push({ x: freq, y: Math.sqrt(re * re + im * im) });
  }
  return magnitudes; // sempre com 32 pontos
}

// função utilitária segura para converter base64 (char.value) para string UTF-8
function base64ToUtf8(base64Str) {
  // tenta 3 abordagens defensivas
  try {
    // 1) se Buffer estiver disponível (node polyfill)
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(base64Str, 'base64').toString('utf8');
    }
  } catch (e) {}

  try {
    // 2) usar react-native-quick-base64 decode -> pode retornar Uint8Array ou string
    const maybe = decode(base64Str); // import { decode } from 'react-native-quick-base64'
    if (maybe instanceof Uint8Array) {
      const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
      if (decoder) return decoder.decode(maybe);
      // fallback manual
      return String.fromCharCode.apply(null, Array.from(maybe));
    } else if (typeof maybe === 'string') {
      return maybe;
    }
  } catch (e) {}

  try {
    // 3) fallback: atob (se existir) + decodeURIComponent
    if (typeof atob !== 'undefined') {
      const binary = atob(base64Str);
      // convert binary to utf-8 string
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      return typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8').decode(bytes) : String.fromCharCode(...bytes);
    }
  } catch (e) {}

  // última tentativa — devolve string vazia
  return '';
}

const SkiaChart = ({ data, color, chartWidth, chartHeight, isFFT = false, yTicks = 4 }) => {
  const graphWidth = chartWidth - PADDING.left - PADDING.right;
  const graphHeight = chartHeight - PADDING.top - PADDING.bottom;
  const font = useFont(require('./assets/fonts/RobotoSlab[wght].ttf'), 10);

  // Coerce e normaliza os dados para números
  const parsed = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return isFFT
      ? data.map(p => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 }))
      : data.map(v => Number(v) || 0);
  }, [data, isFFT]);

  // Cria o Skia.Path e calcula ticks Y (useMemo para performance)
  const { skPath, yTicksArray } = useMemo(() => {
    if (!parsed || parsed.length < 2) {
      return { skPath: Skia.Path.Make(), yTicksArray: [] };
    }

    const values = isFFT ? parsed.map(p => p.y) : parsed;
    let minY = Math.min(...values);
    let maxY = Math.max(...values);
    if (minY === maxY) { minY -= 0.5; maxY += 0.5; } // evita zero range
    const rangeY = maxY - minY;

    // monta path SVG
    const commands = values.map((val, i) => {
      const x = PADDING.left + (i / (values.length - 1)) * graphWidth;
      const y = PADDING.top + graphHeight - ((val - minY) / rangeY) * graphHeight;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');

    const pathFromSvg = Skia.Path.MakeFromSVGString(commands) || Skia.Path.Make();

    // ticks Y
    const ticks = [];
    for (let t = 0; t <= yTicks; t++) {
      const v = minY + (t / yTicks) * rangeY;
      const y = PADDING.top + graphHeight - ((v - minY) / rangeY) * graphHeight;
      ticks.push({ value: v, y });
    }

    return { skPath: pathFromSvg, yTicksArray: ticks };
  }, [parsed, chartWidth, chartHeight, isFFT]);

  // fonte ainda carregando -> retorne espaço reservado
  if (!font) return <View style={{ width: chartWidth, height: chartHeight }} />;

  return (
    <Canvas style={{ width: chartWidth, height: chartHeight }}>
      {/* desenha labels Y */}
      {yTicksArray.map((t, i) => (
        <SkiaText
          key={`yt-${i}`}
          x={6}
          y={t.y + 4}
          text={t.value.toFixed(2)}
          font={font}
          color="black"
        />
      ))}

      {/* desenha a linha do gráfico */}
      <Path path={skPath} style="stroke" color={color} strokeWidth={2} />

      {/* se FFT: desenhar labels X a cada N pontos */}
      {isFFT && parsed.map((p, i) => {
        if (i % 5 !== 0) return null;
        const x = PADDING.left + (i / (parsed.length - 1)) * graphWidth - 6;
        const y = chartHeight - PADDING.bottom + 14;
        return (
          <SkiaText key={`xt-${i}`} x={x} y={y} text={p.x.toFixed(0)} font={font} color="black" />
        );
      })}
    </Canvas>
  );
};

const DynamicChart = ({ 
  label, 
  data, 
  color, 
  isFFT = false, 
  pointWidth = 10, 
  chartHeight = 220,
  maxPoints = 200   // 🔹 número máximo de pontos exibidos
}) => {
  const scrollRef = useRef(null);
  const visibleWidth = Dimensions.get('window').width - 40;

  // 🔹 Mantém só os últimos N pontos
  const trimmedData = Array.isArray(data) 
    ? data.slice(-maxPoints) 
    : [];

  const dataLen = trimmedData.length;
  const chartWidth = Math.max(visibleWidth, dataLen * pointWidth);

  useEffect(() => {
    if (!isFFT && chartWidth > visibleWidth) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [dataLen, isFFT, chartWidth]);

  if (dataLen < 2) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text>Aguardando dados...</Text>
      </View>
    );
  }

  return (
    <View style={styles.chartContainer}>
      <ScrollView
        horizontal
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ width: chartWidth }}
      >
        <SkiaChart
          data={trimmedData}
          color={color}
          chartWidth={chartWidth}
          chartHeight={chartHeight}
          isFFT={isFFT}
        />
      </ScrollView>
    </View>
  );
};

export default function App() {
  const bleManagerRef = useRef(null);
  const deviceRef = useRef(null);

  const [deviceID, setDeviceID] = useState(null);
  const [acelerometro, setAcelerometro] = useState({ Ax: 0, Ay: 0, Az: 0 }); // Inicia como objeto
  const [historico, setHistorico] = useState({ Ax: [], Ay: [], Az: [] });
  const [connectionStatus, setConnectionStatus] = useState("Aguardando permissões...");

  const bufferRef = useRef([]);
  const animationFrameId = useRef(null);

  useEffect(() => {
    bleManagerRef.current = new BleManager();

    return () => {
      if (deviceRef.current) {
        deviceRef.current.cancelConnection()
          .catch(err => console.log("Erro ao cancelar conexão:", err));
      }
      if (bleManagerRef.current) {
        bleManagerRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    const requestPermissionsAndStartScan = async () => {
      // Verifica se é Android
      if (Platform.OS === 'android') {
        const apiLevel = Platform.Version;

        let permissionsToRequest = [];
        if (apiLevel < 31) { // Android 11 e inferior
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        } else { // Android 12 e superior
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        }

        const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);

        const allPermissionsGranted = permissionsToRequest.every(
          permission => granted[permission] === PermissionsAndroid.RESULTS.GRANTED
        );

        if (allPermissionsGranted) {
          console.log("Permissões concedidas! Iniciando scan...");
          searchAndConnectToDevice(); // --- PASSO 2: Iniciar o scan SÓ DEPOIS de ter permissão
        } else {
          console.log("Permissões negadas.");
          setConnectionStatus("Permissões de Bluetooth são necessárias.");
        }
      }
    };

    requestPermissionsAndStartScan();
  }, []);

  useEffect(() => {
    const gameLoop = () => {
      // Pega todos os dados recebidos desde o último frame
      const batch = [...bufferRef.current];
      bufferRef.current = [];

      if (batch.length > 0) {
        // Pega APENAS o último e mais recente ponto do lote
        const lastPoint = batch[batch.length - 1];

        // Atualiza o estado do histórico com este único ponto
        setHistorico(prev => ({
          Ax: [...prev.Ax, lastPoint.Ax].slice(-MAX_PONTOS_HISTORICO),
          Ay: [...prev.Ay, lastPoint.Ay].slice(-MAX_PONTOS_HISTORICO),
          Az: [...prev.Az, lastPoint.Az].slice(-MAX_PONTOS_HISTORICO),
        }));
        
        // Atualiza o valor numérico também
        setAcelerometro(lastPoint);
      }

      // Agenda o próximo frame
      animationFrameId.current = requestAnimationFrame(gameLoop);
    };

    // Inicia o loop
    animationFrameId.current = requestAnimationFrame(gameLoop);

    // Função de limpeza para parar o loop quando o componente for desmontado
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []); 

  // -----------------------------
  // FFT
  // -----------------------------
  const fftX = useMemo(() => calcularFFT(historico.Ax), [historico.Ax]);
  const fftY = useMemo(() => calcularFFT(historico.Ay), [historico.Ay]);
  const fftZ = useMemo(() => calcularFFT(historico.Az), [historico.Az]);

  // -----------------------------
  // REAL BLE MODE
  // -----------------------------
  const searchAndConnectToDevice = () => {
    if (!bleManagerRef.current) return;
    setConnectionStatus("Scanning...");

    bleManagerRef.current.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error(error);
        setConnectionStatus("Error searching for devices");
        return;
      }
      if (device.name === "ESP32-MPU6050") {
        bleManagerRef.current.stopDeviceScan(); // CORREÇÃO: Usar a referência correta
        setConnectionStatus("Connecting...");
        connectToDevice(device);
      }
    });
  };

  const connectToDevice = async (device) => {
    if (deviceRef.current) {
      console.log("Já existe um device conectado:", deviceRef.current.id);
      return deviceRef.current;
    }

    try {
      const connectedDevice = await device.connect();
      setDeviceID(connectedDevice.id);
      setConnectionStatus("Connected");
      deviceRef.current = connectedDevice;

      await connectedDevice.discoverAllServicesAndCharacteristics();

      connectedDevice.monitorCharacteristicForService(
        SERVICE_UUID,
        TX_UUID,
        (error, char) => {
          if (error) {
            console.error(error);
            setConnectionStatus(`Error: ${error.reason}`);
            return;
          }
          const decodedStr = base64ToUtf8(char.value || '');
          const parts = decodedStr.trim().split(",").map(s => parseFloat(s));
          const Ax = Number.isFinite(parts[0]) ? parts[0] : 0;
          const Ay = Number.isFinite(parts[1]) ? parts[1] : 0;
          const Az = Number.isFinite(parts[2]) ? parts[2] : 0;

          bufferRef.current.push({ Ax, Ay, Az });
        }
      );

      return connectedDevice;
    } catch (error) {
      console.log(error);
      setConnectionStatus("Error in Connection");
    }
  };

  useEffect(() => {
    const subscription = bleManagerRef.current.onDeviceDisconnected(
      deviceID,
      (error, device) =>{
        if (error) {
          console.log("Disconnected with error:", error);
        }
        setConnectionStatus("Disconnected");
        console.log("Disconnected device");
        setAcelerometro({ Ax: 0, Ay: 0, Az: 0 });
        if (deviceRef.current){
          setConnectionStatus("Reconnecting...");
          connectToDevice(deviceRef.current)
            .then(() => setConnectionStatus("Connected"))
            .catch((error) => {
              console.log("Reconnection failed: ", error);
              setConnectionStatus("Reconndction failed");
            });
        }
      }
    );
    return () => subscription.remove();
  }, [deviceID]);

  return (
    <ScrollView style={styles.scroll}>
      <View style={styles.container}>
        <Text style={styles.title}>📡 Acelerômetro com Skia</Text>
        <Text>Ax: {acelerometro.Ax}</Text>
        <Text>Ay: {acelerometro.Ay}</Text>
        <Text>Az: {acelerometro.Az}</Text>
        <Text>Status: {connectionStatus}</Text>

        <Text style={styles.chartTitle}>Eixo X (tempo)</Text>
        <DynamicChart label="X" data={historico.Ax} color="red" maxPoints={200} />

        <Text style={styles.chartTitle}>Eixo Y (tempo)</Text>
        <DynamicChart label="Y" data={historico.Ay} color="green" maxPoints={200} />

        <Text style={styles.chartTitle}>Eixo Z (tempo)</Text>
        <DynamicChart label="Z" data={historico.Az} color="blue" maxPoints={200} />

        <Text style={styles.chartTitle}>Eixo X (FFT)</Text>
        <DynamicChart label="X FFT" data={fftX} color="purple" isFFT={true} pointWidth={25} />

        <Text style={styles.chartTitle}>Eixo Y (FFT)</Text>
        <DynamicChart label="Y FFT" data={fftY} color="orange" isFFT={true} pointWidth={25} />

        <Text style={styles.chartTitle}>Eixo Z (FFT)</Text>
        <DynamicChart label="Z FFT" data={fftZ} color="cyan" isFFT={true} pointWidth={25} />
      
        <StatusBar style="auto" />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#fff"
  },
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    paddingBottom: 50,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  chartTitle: {
    textAlign: "center",
    marginTop: 20,
    marginBottom: 8,
    fontWeight: "bold",
    fontSize: 16,
  },
  chartContainer: {
    marginVertical: 8,
    borderRadius: 16,
    width: containerWidth - 40, 
    height: 220,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  chartPlaceholder: { // Novo estilo para quando não há dados
    width: containerWidth - 40,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
  }
});