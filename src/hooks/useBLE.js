import { useState, useRef, useEffect } from 'react';
import { BleManager } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { base64ToUtf8 } from '../utils/base64';

const SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const TX_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";
const MAX_PONTOS_HISTORICO = 300;

export const useBLE = () => {
  const [deviceID, setDeviceID] = useState(null);
  const [acelerometro, setAcelerometro] = useState({ Ax: 0, Ay: 0, Az: 0 }); // Inicia como objeto
  const [historico, setHistorico] = useState({ Ax: [], Ay: [], Az: [] });
  const [connectionStatus, setConnectionStatus] = useState("Aguardando permissões...");
  const [foundDevice, setFoundDevice] = useState(null);

  const bleManagerRef = useRef(null);
  const deviceRef = useRef(null);
  const bufferRef = useRef([]);
  const animationFrameId = useRef(null);
  const recordingStartTimeRef = useRef(null);
  const isManualDisconnect = useRef(false);
  const monitorSubscriptionRef = useRef(null);

  useEffect(() => {
    bleManagerRef.current = new BleManager();
    
    return () => {
      if (monitorSubscriptionRef.current) {
        try {
          monitorSubscriptionRef.current.remove();
        } catch (e) { /* ignore */ }
        monitorSubscriptionRef.current = null;
      }

      if (deviceRef.current) {
        deviceRef.current.cancelConnection()
        .catch(err => console.log("Erro ao cancelar conexão:", err));
      }
      bleManagerRef.current?.destroy();
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

  useEffect(() => {
    const subscription = bleManagerRef.current.onDeviceDisconnected(
      deviceID,
      (error, device) =>{
        if(isManualDisconnect.current){
          console.log("Desconexão manual ignorada.");
          return;
        }

        if (error) {
          console.log("Desconectado com erro:", error);
        }
        console.log("Serviço desconectado");
        setConnectionStatus("Desconectado");
        setAcelerometro({ Ax: 0, Ay: 0, Az: 0 });

        if (deviceRef.current){
          setConnectionStatus("Reconectando...");
          connectToDevice(deviceRef.current)
            .then(() => setConnectionStatus("Conectado"))
            .catch((error) => {
              console.log("Reconexão falhou: ", error);
              setConnectionStatus("Reconexão falhou");
            });
        }
      }
    );
    return () => subscription.remove();
  }, [deviceID]);
  
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
        setConnectionStatus("Dispositivo encontrado!");
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

      if (monitorSubscriptionRef.current) {
        try {
          monitorSubscriptionRef.current.remove();
        } catch (e) { /* ignore */ }
        monitorSubscriptionRef.current = null;
      }

      monitorSubscriptionRef.current = connectedDevice.monitorCharacteristicForService(
        SERVICE_UUID,
        TX_UUID,
        (error, char) => {
          if (error) {
            if(isManualDisconnect.current){
              console.log("Monitor interrompido por desconexão manual.");
              return;
            }

            console.log('erro aqui');
            console.error(error);
            setConnectionStatus(`Dispositivo deconectado!`);
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

    isManualDisconnect.current = true;

    // remove o monitor ANTES de cancelar a conexão para evitar callbacks assíncronos
    if (monitorSubscriptionRef.current) {
      try {
        monitorSubscriptionRef.current.remove();
        monitorSubscriptionRef.current = null;
        console.log('Monitor unsubscribed antes do cancelConnection');
      } catch (e) {
        console.warn('Falha ao remover monitorSubscription:', e);
      }
    }

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

    // mantém o flag por um pequeno intervalo para cobrir callbacks tardios
    setTimeout(() => { isManualDisconnect.current = false; }, 700);

    // 5. Inicia o processo de busca novamente
    console.log("Reiniciando scan após reset...");
    searchAndConnectToDevice();
  };

  // Retorna os estados e funções que a UI vai precisar
  return {
    acelerometro,
    connectionStatus,
    foundDevice,
    historico,
    deviceID,
    recordingStartTimeRef,
    handleConnectPress,
    handleResetConnection
  };
};