import { useState, useRef, useEffect } from 'react';
import { BleManager } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { base64ToUtf8 } from '../utils/base64';

const SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const TX_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";

export const useBLE = () => {
  const bleManagerRef = useRef(new BleManager());
  const deviceRef = useRef(null);

  const [acelerometro, setAcelerometro] = useState({ Ax: 0, Ay: 0, Az: 0 });
  const [connectionStatus, setConnectionStatus] = useState("Aguardando...");
  const [foundDevice, setFoundDevice] = useState(null);

  const bufferRef = useRef([]);

  useEffect(() => {
    const gameLoop = () => {
      const batch = [...bufferRef.current];
      bufferRef.current = [];

      if (batch.length > 0) {
        const lastPoint = batch[batch.length - 1];
        setAcelerometro(lastPoint);
      }
      
      requestAnimationFrame(gameLoop);
    };

    const frameId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // --- FUNÇÕES DE AÇÃO (A "API" do nosso Hook) ---

  const scanForDevices = async () => {
    if (Platform.OS === 'android') {
      const locationPermission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (locationPermission !== PermissionsAndroid.RESULTS.GRANTED) {
        setConnectionStatus("Permissão de localização é necessária.");
        return;
      }
      if (Platform.Version >= 31) {
        const scanPermission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
        const connectPermission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
        if (scanPermission !== PermissionsAndroid.RESULTS.GRANTED || connectPermission !== PermissionsAndroid.RESULTS.GRANTED) {
          setConnectionStatus("Permissões de Bluetooth são necessárias.");
          return;
        }
      }
    }
    
    setConnectionStatus("Procurando dispositivo...");
    bleManagerRef.current.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error("Erro no scan:", error);
        setConnectionStatus("Erro ao procurar");
        return;
      }
      if (device.name === "ESP32-MPU6050") {
        bleManagerRef.current.stopDeviceScan();
        setConnectionStatus("Dispositivo encontrado!");
        setFoundDevice(device);
      }
    });
  };

  const connectToDevice = async (device) => {
    if (!device) return;

    setConnectionStatus("Conectando...");
    try {
      const connectedDevice = await device.connect();
      deviceRef.current = connectedDevice;
      setFoundDevice(null);
      setConnectionStatus("Conectado");

      await connectedDevice.discoverAllServicesAndCharacteristics();
      
      connectedDevice.monitorCharacteristicForService(SERVICE_UUID, TX_UUID, (error, char) => {
        if (error) {
          console.error("Erro no monitoramento:", error);
          resetStateAndScan(); 
          return;
        }
        const decodedStr = base64ToUtf8(char.value || '');
        const parts = decodedStr.trim().split(",").map(s => parseFloat(s));
        const [Ax, Ay, Az] = parts.map(p => Number.isFinite(p) ? p : 0);
        bufferRef.current.push({ Ax, Ay, Az, timestamp: Date.now() });
      });

      connectedDevice.onDisconnected((error, disconnectedDevice) => {
        console.log("Dispositivo desconectado!");
        resetStateAndScan();
      });

    } catch (error) {
      console.log("Erro na conexão:", error);
      setConnectionStatus("Falha ao conectar");
    }
  };

  const resetConnection = async () => {
    bleManagerRef.current?.stopDeviceScan();
    if (deviceRef.current) {
      try {
        await deviceRef.current.cancelConnection();
      } catch (error) { console.error("Falha ao desconectar:", error); }
    }
    resetStateAndScan();
  };

  // --- FUNÇÕES AUXILIARES INTERNAS ---

  const resetStateAndScan = () => {
    setAcelerometro({ Ax: 0, Ay: 0, Az: 0 });
    setFoundDevice(null);
    deviceRef.current = null;
    bufferRef.current = [];
    scanForDevices();
  };

  // Retorna os estados e funções que a UI vai precisar
  return {
    acelerometro,
    connectionStatus,
    foundDevice,
    scanForDevices,
    connectToDevice,
    resetConnection,
  };
};