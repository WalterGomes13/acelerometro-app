import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, PermissionsAndroid, ScrollView, Button, Dimensions } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { useState, useEffect, useRef } from 'react';
import { decode } from 'react-native-quick-base64';
import { LineChart } from 'react-native-chart-kit';
import FFT from 'fft.js';

const USE_MOCK = true; // false, se for um android real

const bleManager = USE_MOCK ? null : new BleManager();
//const bleManager = new BleManager();

const SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const RX_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"; // para enviar dados ao ESP32
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


export default function App() {
  const [deviceID, setDeviceID] = useState(null);
  const [acelerometro, setAcelerometro] = useState(0);
  const [RxChar, setRxChar] = useState(null);
  const [historico, setHistorico] = useState({ Ax: [0,0], Ay: [0,0], Az: [0,0] });
  const [connectionStatus, setConnectionStatus] = useState("Searching...");
  const [modo, setModo] = useState("time"); // "time" ou "fft"

  const deviceRef = useRef(null);

  // -----------------------------
  // MOCK MODE
  // -----------------------------
  useEffect(() => {
    if (USE_MOCK) {
      setConnectionStatus("Connected (Mock)");
      const interval = setInterval(() => {
        // Gera valores simulados -3.0 a +3.0 g
        const Ax = (Math.random() * 6 - 3).toFixed(2);
        const Ay = (Math.random() * 6 - 3).toFixed(2);
        const Az = (Math.random() * 6 - 3).toFixed(2);

        // String no mesmo formato do ESP32
        const dataString = `${Ax},${Ay},${Az}\n`;

        console.log("📡 Mock acelerometro:", dataString);

        // Converte para objeto {Ax, Ay, Az} (facilita no React)
        setAcelerometro({ Ax, Ay, Az });

        setHistorico(prev => ({
          Ax: [...prev.Ax.slice(-63), parseFloat(Ax)],
          Ay: [...prev.Ay.slice(-63), parseFloat(Ay)],
          Az: [...prev.Az.slice(-63), parseFloat(Az)],
        }));
      }, 100);

      return () => clearInterval(interval);
    }
  }, []);

  // -----------------------------
  // FFT
  // -----------------------------
  const fftX = calcularFFT(historico.Ax, 10);
  const fftY = calcularFFT(historico.Ay, 10);
  const fftZ = calcularFFT(historico.Az, 10);

  // -----------------------------
  // REAL BLE MODE
  // -----------------------------
  const searchAndConnectToDevice = () => {
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error(error);
        setConnectionStatus("Error searching for devices");
        return;
      }
      if (device.name === "ESP32-MPU6050") {
        bleManager.stopDeviceScan();
        setConnectionStatus("Connecting...");
        connectToDevice(device);
      }
    });
  };

  useEffect(() => {
    if (!USE_MOCK){
      searchAndConnectToDevice();
    }
  }, []);

  const connectToDevice = (device) => {
    return device
    .connect()
    .then((device) => {
      setDeviceID(device.id);
      setConnectionStatus("Connected");
      deviceRef.current = device;
      return device.discoverAllServicesAndCharacteristics();
    })
    .then((device) => {
      return device.services();
    })
    .then((services) => {
      let service = services.find((service) => service.uuid === SERVICE_UUID);
      return service.characteristics();
    })
    .then((characteristics) => {
      let acelerometroCharacteristicRX = characteristics.find(
        (char) => char.uuid === RX_UUID
      );
      setRxChar(acelerometroCharacteristicRX);
      acelerometroCharacteristicRX.monitor((error, char) => {
        if (error) {
          console.error(error);
          return
        }

        const rawData = decode(char.value);
        const decodedStr = new TextDecoder("utf-8").decode(
          Uint8Array.from(rawData, (c) => c.charCodeAt(0))
        );

        console.log("Received acelerometro data:", decodedStr);

        const [Ax, Ay, Az] = decodedStr.trim().split(",");
        setAcelerometro({ Ax, Ay, Az });

        const ax = parseFloat(Ax);
        const ay = parseFloat(Ay);
        const az = parseFloat(Az);

        if (isNaN(ax) || isNaN(ay) || isNaN(az)) {
          console.warn("Valores inválidos recebidos:", { Ax, Ay, Az });
          return;
        }

         setHistorico(prev => ({
          Ax: [...prev.Ax.slice(-49), parseFloat(Ax)],
          Ay: [...prev.Ay.slice(-49), parseFloat(Ay)],
          Az: [...prev.Az.slice(-49), parseFloat(Az)],
        }));
      });
    })
    .catch((error) => {
      console.log(error);
      setConnectionStatus("Error in Connection");
    });
  };

  useEffect(() => {
    if (USE_MOCK) return;

    const subscription = bleManager.onDeviceDisconnected(
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

  const MAX_POINTS = 50; // janela de tempo visível

  const renderChart = (label, data, color) => {
    if (!Array.isArray(data) || data.length < 2) {
      return <Text style={{ marginVertical: 8 }}>Aguardando dados…</Text>;
    }

    // mantém só os últimos MAX_POINTS
    const visibleData = data.slice(-MAX_POINTS);

    return (
      <LineChart
        data={{
          labels: visibleData.map((_, i) => i.toString()), // eixo X anda junto
          datasets: [{ data: visibleData, color: () => color }],
        }}
        width={Dimensions.get("window").width - 40}
        height={220}
        chartConfig={{
          backgroundColor: "#fff",
          backgroundGradientFrom: "#f5f5f5",
          backgroundGradientTo: "#eaeaea",
          decimalPlaces: 2,
          color: () => color,
          labelColor: () => "#333",
          style: { borderRadius: 16 },
        }}
        bezier
        style={{ marginVertical: 8, borderRadius: 16 }}
      />
    );
  };


  const renderFFTChart = (label, data, color) => {
    if (!Array.isArray(data) || data.length < 2) {
      return <Text style={{ marginVertical: 8 }}>Aguardando dados…</Text>;
    }
    return (
      <LineChart
        data={{
          labels: data.map(p => Number(p.x).toFixed(1)), // ver item 3 se trocar para {freq,mag}
          datasets: [{ data: data.map(p => Number(p.y) || 0), color: () => color }],
        }}
        width={Dimensions.get("window").width - 40}
        height={220}
        chartConfig={{
          backgroundColor: "#fff",
          backgroundGradientFrom: "#f5f5f5",
          backgroundGradientTo: "#eaeaea",
          decimalPlaces: 2,
          color: () => color,
          labelColor: () => "#333",
          style: { borderRadius: 16 },
        }}
        bezier
        style={{ marginVertical: 8, borderRadius: 16 }}
      />
    );
  };



  return (
    <ScrollView style={styles.scroll}>
      <View style={styles.container}>
        <Text style={styles.title}>📡 Acelerômetro</Text>
        <Text>Ax: {acelerometro.Ax}</Text>
        <Text>Ay: {acelerometro.Ay}</Text>
        <Text>Az: {acelerometro.Az}</Text>
        <Text>Status: {connectionStatus}</Text>

        <View style={styles.buttons}>
          <Button title="Aceleração" onPress={() => setModo("time")} />
          <Button title="FFT" onPress={() => setModo("fft")} />
        </View>

        {modo === "time" ? (
          <>
            <Text style={styles.chartTitle}>Eixo X (tempo)</Text>
            {renderChart("X", historico.Ax, "red")}

            <Text style={styles.chartTitle}>Eixo Y (tempo)</Text>
            {renderChart("Y", historico.Ay, "green")}

            <Text style={styles.chartTitle}>Eixo Z (tempo)</Text>
            {renderChart("Z", historico.Az, "blue")}
          </>
        ) : (
          <>
            <Text style={styles.chartTitle}>Eixo X (FFT)</Text>
            {renderFFTChart("X FFT", fftX, "purple")}

            <Text style={styles.chartTitle}>Eixo Y (FFT)</Text>
            {renderFFTChart("Y FFT", fftY, "orange")}

            <Text style={styles.chartTitle}>Eixo Z (FFT)</Text>
            {renderFFTChart("Z FFT", fftZ, "cyan")}
          </>
        )}

        <StatusBar style="auto" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#fff"
  },
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    marginBottom: 10,
  },
  chartTitle: {
    textAlign: "center",
    marginVertical: 10,
    fontWeight: "bold",
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginVertical: 10,
  },
});

async function requestLocationPermission() {
  try {
     const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      {
        title: "Location permission for bluetooth scanning",
        message: "Grant location permission to allow the app to scan for Bluetooth devices",
        buttonNeutral: "Ask Me Later",
        buttonNegative: "Cancel",
        buttonPositive: "OK"
      }
     );
     if (granted === PermissionsAndroid.RESULTS.GRANTED){
      console.log("Location permission for bluetooth scanning granted");
     } else {
      console.log("Location permission for bluetooth scanning denied");
     }
  } catch (err) {
    console.warn(err);
  }
}

if(!USE_MOCK){
  requestLocationPermission();
}