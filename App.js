import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, PermissionsAndroid, ScrollView, Button, Dimensions, Platform, ImageBackground, Image } from 'react-native';
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
function calcularFFT(dados, sampleRate = 20) {
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

const GraphPath = ({ data, color, chartWidth, chartHeight, isFFT, minY, maxY, font, startTime }) => {
  const graphWidth = chartWidth - PADDING.left - PADDING.right;
  const graphHeight = chartHeight - PADDING.top - PADDING.bottom;

  // Extrai apenas os valores numéricos para o caminho do gráfico
  const valuesOnly = useMemo(() => data.map(p => (isFFT ? p.y : p.value)), [data, isFFT]);
  const skPath = useMemo(() => {
    if (valuesOnly.length < 2) return Skia.Path.Make();
    
    const rangeY = (maxY - minY) === 0 ? 1 : maxY - minY;
    const commands = valuesOnly.map((val, i) => {
      const x = PADDING.left + (i / (valuesOnly.length - 1)) * graphWidth;
      const y = PADDING.top + graphHeight - ((val - minY) / rangeY) * graphHeight;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');

    return Skia.Path.MakeFromSVGString(commands) || Skia.Path.Make();
  }, [valuesOnly, chartWidth, chartHeight, minY, maxY]);

  // Guarda o timestamp do primeiro ponto visível como referência
  //const startTime = data.length > 0 ? data[0].timestamp : 0;
  // Guarda a última label de tempo desenhada para evitar sobreposição
  let lastLabelTime = -Infinity; 

  return (
    <Canvas style={{ width: chartWidth, height: chartHeight }}>
      <Path path={skPath} style="stroke" color={color} strokeWidth={2} />

      {/* Labels X para FFT (lógica antiga, sem alterações) */}
      {isFFT && font && data.map((p, i) => {
        if (i % 5 !== 0) return null;
        const x = PADDING.left + (i / (data.length - 1)) * graphWidth - 6;
        const y = chartHeight - PADDING.bottom + 14;
        return (<SkiaText key={`xt-freq-${i}`} x={x} y={y} text={`${p.x.toFixed(0)}Hz`} font={font} color="black" />);
      })}

      {/* 3. A LÓGICA AGORA USA O STARTTIME FIXO E FUNCIONA CORRETAMENTE */}
      {!isFFT && font && startTime && data.map((point, i) => {
        const elapsedMillis = point.timestamp - startTime;
        const elapsedSeconds = elapsedMillis / 1000;

        if (elapsedSeconds >= lastLabelTime + 5) {
          const labelTime = Math.floor(elapsedSeconds / 5) * 5;
          if (labelTime > lastLabelTime) {
            lastLabelTime = labelTime;
            // ... (resto da lógica para desenhar o SkiaText) ...
            const x = PADDING.left + (i / (data.length - 1)) * graphWidth - 6;
            const y = chartHeight - PADDING.bottom + 14;
            return (
              <SkiaText key={`xt-time-${i}`} x={x} y={y} text={`${labelTime}s`} font={font} color="black"/>
            );
          }
        }
        return null;
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
  maxPoints = 200,
  yTicks = 4,
  startTime
}) => {
  const scrollRef = useRef(null);
  const visibleWidth = Dimensions.get('window').width - 40;
  const font = useFont(require('./assets/fonts/RobotoSlab[wght].ttf'), 10);
  
  const trimmedData = Array.isArray(data) ? data.slice(-maxPoints) : [];
  const dataLen = trimmedData.length;

  // --- A MUDANÇA ESTÁ TODA DENTRO DESTE useMemo ---
  const { minY, maxY, yTicksArray } = useMemo(() => {
    if (trimmedData.length < 2) {
      // Para o estado inicial, já retornamos o range padrão de -2 a 2
      const defaultMinY = -1.5;
      const defaultMaxY = 1.5;
      const rangeY = defaultMaxY - defaultMinY;
      const graphHeight = chartHeight - PADDING.top - PADDING.bottom;
      const ticks = [];
      for (let t = 0; t <= yTicks; t++) {
        const v = defaultMinY + (t / yTicks) * rangeY;
        const y = PADDING.top + graphHeight - ((v - defaultMinY) / rangeY) * graphHeight;
        ticks.push({ value: v, y: y });
      }
      return { minY: defaultMinY, maxY: defaultMaxY, yTicksArray: ticks };
    }

    const values = isFFT ? trimmedData.map(p => p.y) : trimmedData.map(p => p.value);
    
    let finalMinY, finalMaxY;

    if (isFFT) {
      // Para FFT, mantemos a lógica antiga de auto-ajuste
      finalMinY = Math.min(...values);
      finalMaxY = Math.max(...values);
      if (finalMinY === finalMaxY) {
        finalMinY -= 0.5;
        finalMaxY += 0.5;
      }
    } else {
      // --- LÓGICA DO EIXO Y FIXO E DINÂMICO PARA ACELERAÇÃO ---
      const defaultBoundary = 1.5;
      
      // 1. Encontra o maior valor absoluto nos dados atuais
      const absoluteMax = Math.max(...values.map(v => Math.abs(v)));

      // 2. Decide qual será o limite do gráfico
      // Se o maior valor for menor que 2, o limite é 2.
      // Se for maior (ex: 2.5), o limite vira Math.ceil(2.5), que é 3.
      const boundary = Math.max(defaultBoundary, Math.ceil(absoluteMax));

      // 3. Define o range final de forma simétrica
      finalMinY = -boundary;
      finalMaxY = boundary;
    }

    // A lógica para calcular as posições dos ticks continua a mesma,
    // mas agora usando os valores `finalMinY` e `finalMaxY`.
    const rangeY = finalMaxY - finalMinY;
    const graphHeight = chartHeight - PADDING.top - PADDING.bottom;
    const ticks = [];
    for (let t = 0; t <= yTicks; t++) {
      const v = finalMinY + (t / yTicks) * rangeY;
      const y = PADDING.top + graphHeight - ((v - finalMinY) / rangeY) * graphHeight;
      ticks.push({ value: v, y: y });
    }

    return { minY: finalMinY, maxY: finalMaxY, yTicksArray: ticks };

  }, [trimmedData, chartHeight, isFFT, yTicks]);

  const chartWidth = Math.max(visibleWidth - PADDING.left, dataLen * pointWidth);

  useEffect(() => {
    if (!isFFT && chartWidth > visibleWidth - PADDING.left) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [dataLen, isFFT, chartWidth, visibleWidth]);

  if (dataLen < 2) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text>Aguardando dados...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.chartContainer, { flexDirection: 'row' }]}>
      <YAxisLabels 
        yTicksArray={yTicksArray} 
        chartHeight={chartHeight} 
        font={font} 
      />
      <ScrollView
        horizontal
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <GraphPath
          data={trimmedData}
          color={color}
          chartWidth={chartWidth}
          chartHeight={chartHeight}
          isFFT={isFFT}
          minY={minY}
          maxY={maxY}
          font={font}
          startTime={startTime}
        />
      </ScrollView>
    </View>
  );
};

// Componente para desenhar APENAS as labels do eixo Y
const YAxisLabels = ({ yTicksArray, chartHeight, font }) => {
  if (!font || !yTicksArray || yTicksArray.length === 0) {
    // Retorna um espaço reservado com a largura das labels se a fonte ou os dados não estiverem prontos
    return <View style={{ width: PADDING.left, height: chartHeight }} />;
  }

  return (
    <Canvas style={{ width: PADDING.left, height: chartHeight }}>
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
    </Canvas>
  );
};

export default function App() {
  const bleManagerRef = useRef(null);
  const deviceRef = useRef(null);

  const [deviceID, setDeviceID] = useState(null);
  const [acelerometro, setAcelerometro] = useState({ Ax: 0, Ay: 0, Az: 0 }); // Inicia como objeto
  const [historico, setHistorico] = useState({ Ax: [], Ay: [], Az: [] });
  const [connectionStatus, setConnectionStatus] = useState("Aguardando permissões...");
  const [foundDevice, setFoundDevice] = useState(null);

  const bufferRef = useRef([]);
  const animationFrameId = useRef(null);
  const recordingStartTimeRef = useRef(null);

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
          searchAndConnectToDevice(); 
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
      const batch = [...bufferRef.current];
      bufferRef.current = [];

      if (batch.length > 0) {
        if (recordingStartTimeRef.current === null && batch[0].timestamp) {
          recordingStartTimeRef.current = batch[0].timestamp;
        }
        const lastPoint = batch[batch.length - 1];

        // MUDANÇA NA ESTRUTURA DO HISTÓRICO:
        // Agora, cada array armazena objetos { value, timestamp }
        setHistorico(prev => ({
          Ax: [...prev.Ax, { value: lastPoint.Ax, timestamp: lastPoint.timestamp }].slice(-MAX_PONTOS_HISTORICO),
          Ay: [...prev.Ay, { value: lastPoint.Ay, timestamp: lastPoint.timestamp }].slice(-MAX_PONTOS_HISTORICO),
          Az: [...prev.Az, { value: lastPoint.Az, timestamp: lastPoint.timestamp }].slice(-MAX_PONTOS_HISTORICO),
        }));
        
        setAcelerometro(lastPoint);
      }

      animationFrameId.current = requestAnimationFrame(gameLoop);
    };

    animationFrameId.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []); 

  // -----------------------------
  // FFT
  // -----------------------------
  const fftX = useMemo(() => calcularFFT(historico.Ax.map(p => p.value)), [historico.Ax]);
  const fftY = useMemo(() => calcularFFT(historico.Ay.map(p => p.value)), [historico.Ay]);
  const fftZ = useMemo(() => calcularFFT(historico.Az.map(p => p.value)), [historico.Az]);
  // -----------------------------
  // REAL BLE MODE
  // -----------------------------
  const searchAndConnectToDevice = () => {
    if (!bleManagerRef.current) return;
    setConnectionStatus("Escanenando...");
    setFoundDevice(null);

    bleManagerRef.current.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error(error);
        setConnectionStatus("Erro ao procurar por dispositivos");
        return;
      }
      if (device.name === "ESP32-MPU6050") {
        bleManagerRef.current.stopDeviceScan(); // CORREÇÃO: Usar a referência correta
        setConnectionStatus("Dispositivo encontrado! Clique para conectar");
        setFoundDevice(device)
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
      setConnectionStatus("Conectado");
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

          bufferRef.current.push({ Ax, Ay, Az, timestamp: Date.now() });
        }
      );

      return connectedDevice;
    } catch (error) {
      console.log(error);
      setConnectionStatus("Erro na conexão");
    }
  };

  const handleConnectPress = () =>{
    if (foundDevice){
      connectToDevice(foundDevice);
    }
  }

  const handleResetConnection = async () => {
    // 1. Avisa ao usuário que o reset começou
    setConnectionStatus("Resetando conexão...");

    // 2. Para qualquer busca de dispositivos que possa estar ativa
    bleManagerRef.current?.stopDeviceScan();

    // 3. Tenta desconectar do dispositivo atual, se houver um
    if (deviceRef.current) {
      try {
        await deviceRef.current.cancelConnection();
        console.log("Desconectado com sucesso para reset");
      } catch (error) {
        console.error("Falha ao desconectar durante reset:", error);
      }
    }

    // 4. Limpa todo o estado e as referências para o estado inicial
    setHistorico({ Ax: [], Ay: [], Az: [] });
    setAcelerometro({ Ax: 0, Ay: 0, Az: 0 });
    setDeviceID(null);
    setFoundDevice(null);
    bufferRef.current = [];
    recordingStartTimeRef.current = null;
    deviceRef.current = null; // Muito importante para permitir uma nova conexão

    // 5. Inicia o processo de busca novamente
    console.log("Reiniciando scan após reset...");
    searchAndConnectToDevice();
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
    <View style={styles.mainContainer}>
      <StatusBar style="dark" />

      <Image
        source={require('./assets/adaptive-icon.png')}
        style={styles.backgroundImage}
        // blurRadius={1} // Opcional: para um efeito de desfoque
      />

      <ScrollView style={styles.scroll}>
        <View style={styles.container}>
          <Text style={styles.title}>📡 UNIFOR Motion Lab</Text>
          <Text>Ax: {acelerometro.Ax}</Text>
          <Text>Ay: {acelerometro.Ay}</Text>
          <Text>Az: {acelerometro.Az}</Text>
          <Text>Status: {connectionStatus}</Text>

          {foundDevice && !deviceID && (
            <View style={styles.buttonContainer}>
              <Button
                title={`Conectar ao ${foundDevice.name}`}
                onPress={handleConnectPress}
                color="#201392ff" // Um tom de verde
              />
            </View>
          )}

          <View style={styles.buttonContainer}>
            <Button 
              title="Resetar Conexão" 
              onPress={handleResetConnection} 
              color="#88281dff" // Um tom de vermelho
            />
          </View>

          <Text style={styles.chartTitle}>Eixo X (tempo): {acelerometro.Ax}</Text>
          <DynamicChart label="X" data={historico.Ax} color="#E74C3C" maxPoints={200} startTime={recordingStartTimeRef.current}/>

          <Text style={styles.chartTitle}>Eixo X (FFT)</Text>
          <DynamicChart label="X FFT" data={fftX} color="#9a2b1eff" isFFT={true} pointWidth={25} />

          <Text style={styles.chartTitle}>Eixo Y (tempo): {acelerometro.Ay}</Text>
          <DynamicChart label="Y" data={historico.Ay} color="#2ECC71" maxPoints={200} startTime={recordingStartTimeRef.current}/>

          <Text style={styles.chartTitle}>Eixo Y (FFT)</Text>
          <DynamicChart label="Y FFT" data={fftY} color="#188144ff" isFFT={true} pointWidth={25} />

          <Text style={styles.chartTitle}>Eixo Z (tempo): {acelerometro.Az}</Text>
          <DynamicChart label="Z" data={historico.Az} color="#3498DB" maxPoints={200} startTime={recordingStartTimeRef.current}/>

          <Text style={styles.chartTitle}>Eixo Z (FFT)</Text>
          <DynamicChart label="Z FFT" data={fftZ} color="#145682ff" isFFT={true} pointWidth={25} />
        
          <StatusBar style="auto" />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImage: {
    width: '100%',
    height: undefined,
    aspectRatio: 1024 / 1024,
    opacity: 0.15,
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    paddingBottom: 50,
    backgroundColor: 'transparent'
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000000',
  },
  buttonContainer: {
    marginVertical: 10,
    width: '80%',
  },
  chartTitle: {
    textAlign: "center",
    marginTop: 20,
    marginBottom: 8,
    fontWeight: "bold",
    fontSize: 16,
    color: '#333333'
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
  chartPlaceholder: { 
    width: containerWidth - 40,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
  }
});