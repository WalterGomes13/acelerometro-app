import { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, PermissionsAndroid,Button, ScrollView, TouchableOpacity, Dimensions, Platform, Image, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {useBLE} from '../hooks/useBLE';
import {DynamicChart} from '../components/charts/DynamicChart';
import { calcularFFT } from '../utils/calculoFFT';
import { useFont } from '@shopify/react-native-skia';

const MAX_PONTOS_HISTORICO = 300;

const CORES_GRAFICOS = {
  tempoX: '#E74C3C',
  fftX: '#C0392B',
  tempoY: '#2ECC71',
  fftY: '#27AE60',
  tempoZ: '#3498DB',
  fftZ: '#2980B9',
};

export const DashboardScreen = () =>{
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const isLandscape = windowWidth > windowHeight;

    const {
        acelerometro,
        connectionStatus,
        foundDevice,
        scanForDevices,
        connectToDevice,
        resetConnection,
    } = useBLE();

    const [historico, setHistorico] = useState({ Ax: [], Ay: [], Az: [] });
    const recordingStartTimeRef = useRef(null);
    const skiaFont = useFont(require('../assets/fonts/Satoshi-Regular.otf'), 10);

    useEffect(() => {
        scanForDevices();
    }, []);

    useEffect(() => {
        if (acelerometro.timestamp) { // Só roda se um novo dado do acelerômetro chegou
        if (recordingStartTimeRef.current === null) {
            recordingStartTimeRef.current = acelerometro.timestamp;
        }
        setHistorico(prev => ({
            Ax: [...prev.Ax, { value: acelerometro.Ax, timestamp: acelerometro.timestamp }].slice(-MAX_PONTOS_HISTORICO),
            Ay: [...prev.Ay, { value: acelerometro.Ay, timestamp: acelerometro.timestamp }].slice(-MAX_PONTOS_HISTORICO),
            Az: [...prev.Az, { value: acelerometro.Az, timestamp: acelerometro.timestamp }].slice(-MAX_PONTOS_HISTORICO),
        }));
        }
    }, [acelerometro]);

    const fftX = useMemo(() => calcularFFT(historico.Ax.map(p => p.value)), [historico.Ax]);
    const fftY = useMemo(() => calcularFFT(historico.Ay.map(p => p.value)), [historico.Ay]);
    const fftZ = useMemo(() => calcularFFT(historico.Az.map(p => p.value)), [historico.Az]);

    if(!skiaFont){
      return null;
    }

    const chartCardWidth = isLandscape ? (windowWidth / 2) - 30 : windowWidth - 40;

    return (
        <View style={styles.mainContainer}>
            <StatusBar style="dark" />
            <View style={styles.backgroundImageContainer}>
                <Image source={require('../assets/adaptive-icon.png')} style={styles.backgroundImage} />
            </View>

            <ScrollView style={styles.scroll}>
                <View style={styles.headerContainer}>
                    <Image source={require('../assets/icon-barra.png')} style={styles.titleImage} />
                </View>

                <View style={styles.container}>
                    <View style={isLandscape ? styles.topContainerLandscape : styles.topContainerPortrait}>
                        <View style={styles.infoContainer}>
                            <Text style={styles.infoText}>Status: {connectionStatus}</Text>
                        </View>

                        <View style={isLandscape ? styles.buttonRow : styles.buttonColumn}>
                                {foundDevice && (
                                    <View style={styles.buttonWrapper}>
                                        <TouchableOpacity
                                            style={[styles.customButton, styles.connectButton]}
                                            onPress={() => connectToDevice(foundDevice)}
                                        >
                                            <Text style={styles.customButtonText}>
                                                Conectar ao {foundDevice.name}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            <View style={styles.buttonWrapper}>
                                <TouchableOpacity
                                style={[styles.customButton, styles.resetButton]}
                                onPress={resetConnection}
                                >
                                    <Text style={styles.customButtonText}>
                                        Resetar Conexão
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    <View style={styles.chartsWrapper}>
                        {/* Gráfico X */}
                        <Text style={styles.chartTitle}>Eixo X</Text>
                        <View style={[styles.chartCard, { width: chartCardWidth }]}>
                            <Text style={styles.infoText}>Gráfico da aceleração: {acelerometro.Ax.toFixed(2)}g</Text>
                            <DynamicChart label="X" data={historico.Ax} color={CORES_GRAFICOS.tempoX} startTime={recordingStartTimeRef.current} containerWidth={chartCardWidth} font={skiaFont}/>
                        </View>
                        <View style={[styles.chartCard, { width: chartCardWidth }]}>
                            <Text style={styles.infoText}>Gráfico da transformada rápida (FFT)</Text>
                            <DynamicChart label="X FFT" data={fftX} color={CORES_GRAFICOS.fftX} isFFT={true} pointWidth={25} containerWidth={chartCardWidth} font={skiaFont}/>
                        </View>

                        <View style={styles.separator} />

                        {/* Gráfico Y */}
                        <Text style={styles.chartTitle}>Eixo Y</Text>
                        <View style={[styles.chartCard, { width: chartCardWidth }]}>
                            <Text style={styles.infoText}>Gráfico da aceleração: {acelerometro.Ay.toFixed(2)}g</Text>
                            <DynamicChart label="Y" data={historico.Ay} color={CORES_GRAFICOS.tempoY} startTime={recordingStartTimeRef.current} containerWidth={chartCardWidth} font={skiaFont}/>
                        </View>
                        <View style={[styles.chartCard, { width: chartCardWidth }]}>
                            <Text style={styles.infoText}>Gráfico da transformada rápida (FFT)</Text>
                            <DynamicChart label="Y FFT" data={fftY} color={CORES_GRAFICOS.fftY} isFFT={true} pointWidth={25} containerWidth={chartCardWidth} font={skiaFont}/>
                        </View>

                        <View style={styles.separator} />

                        {/* Gráfico Z */}
                        <Text style={styles.chartTitle}>Eixo Z</Text>
                        <View style={[styles.chartCard, { width: chartCardWidth }]}>
                            <Text style={styles.infoText}>Gráfico da aceleração: {acelerometro.Az.toFixed(2)}g</Text>
                            <DynamicChart label="Z" data={historico.Az} color={CORES_GRAFICOS.tempoZ} startTime={recordingStartTimeRef.current} containerWidth={chartCardWidth} font={skiaFont}/>
                        </View>
                        <View style={[styles.chartCard, { width: chartCardWidth }]}>
                            <Text style={styles.infoText}>Gráfico da transformada rápida (FFT)</Text>
                            <DynamicChart label="Z FFT" data={fftZ} color={CORES_GRAFICOS.fftZ} isFFT={true} pointWidth={25} containerWidth={chartCardWidth} font={skiaFont}/>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
  // --- ESTRUTURA PRINCIPAL ---
  mainContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  backgroundImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImage: {
    width: '100%',
    height: undefined,
    aspectRatio: 1, 
    opacity: 0.15,
  },
  scroll: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },
  separator: {
    height: 1,
    width: '90%',
    backgroundColor: '#CCCCCC',
    marginVertical: 30,
  },

  // --- CABEÇALHO ---
  headerContainer: {
    width: '100%',
    paddingTop: 40, 
    paddingBottom: 15,
    paddingHorizontal: 20, 
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#DDDDDD', 
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  titleImage: {
    height: 40, 
    width: undefined,
    aspectRatio: 2506 / 1024,
    resizeMode: 'contain',
  },

  // --- CONTAINER PRINCIPAL DO CONTEÚDO ---
  container: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 50,
    backgroundColor: 'transparent'
  },
  
  // --- LAYOUT RESPONSIVO (TOPO) ---
  topContainerPortrait: {
    width: '90%',
    alignItems: 'center',
    marginTop: 20,
  },
  topContainerLandscape: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  infoContainer: {
    marginBottom: 10,
    alignItems: 'center',
  },
  infoText: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 16,
    lineHeight: 24,
  },

  // --- BOTÕES ---
  buttonColumn: {
    width: '90%',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonWrapper: {
    marginVertical: 5,
    marginHorizontal: 10,
    minWidth: 160,
  },
  customButton: {
    width: '100%', 
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  connectButton: {
    backgroundColor: '#201392ff',
  },
  resetButton: {
    backgroundColor: '#88281dff',
  },
  customButtonText: {
    fontFamily: 'Satoshi-Bold', 
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500', 
  },
  // --- GRÁFICOS ---
  chartsWrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  chartCard: {
    marginBottom: 20,
  },
  chartTitle: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 16,
    color: '#333333',
    marginBottom: 8,
  }
});