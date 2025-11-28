import { useMemo, useEffect, useRef } from 'react';
import { StyleSheet, Text, View,  ScrollView, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {useBLE} from '../hooks/useBLE';
import { DynamicChart } from '../components/charts/DynamicChart';
import { calcularFFT } from '../utils/calculoFFT';
import { useFont } from '@shopify/react-native-skia';

export const DashboardScreen = () =>{
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const isLandscape = windowWidth > windowHeight;
    const tam_buffer = 256;

    const {
        acelerometro,
        connectionStatus,
        foundDevice,
        historico,
        historicoAccel,
        deviceID,
        recordingStartTimeRef,
        handleConnectPress,
        handleResetConnection
    } = useBLE();

    const skiaFont = useFont(require('../../assets/fonts/Satoshi-Regular.otf'), 10);

    const ultimaFFT_X = useRef([]);
    const fftX = useMemo(() => {
      const len = historico.Ax.length;
      if (len >= tam_buffer){
        console.log("FFT x calculada")
        const novaFFT = calcularFFT(historico.Ax.map(p => p.value))
        ultimaFFT_X.current = novaFFT;
        return novaFFT;
      } 
      return ultimaFFT_X.current;
    }, [historico.Ax]);
    
    const ultimaFFT_Y = useRef([]);
    const fftY = useMemo(() => {
      const len = historico.Ay.length;
      if (len >= tam_buffer){
        console.log("FFT y calculada")
        const novaFFT = calcularFFT(historico.Ay.map(p => p.value))
        ultimaFFT_Y.current = novaFFT;
        return novaFFT;
      } 
      return ultimaFFT_Y.current;
    }, [historico.Ay]);
    
    const ultimaFFT_Z = useRef([]);
    const fftZ = useMemo(() => {
      const len = historico.Az.length;
      if (len >= tam_buffer){
        console.log("FFT z calculada")
        const novaFFT = calcularFFT(historico.Az.map(p => p.value))
        ultimaFFT_Z.current = novaFFT;
        return novaFFT;
      } 
      return ultimaFFT_Z.current;
    }, [historico.Az]);

    useEffect(() => {
      console.log("Tamanho do histórico:", {
        Ax: historico.Ax.length,
        Ay: historico.Ay.length,
        Az: historico.Az.length,
      });
    }, [historico]);

    if(!skiaFont){
      return null;
    }

    const chartCardWidth = isLandscape ? (windowWidth / 2) - 30 : windowWidth - 40;

    return (
      <View style={styles.mainContainer}>
        <StatusBar style="dark" />
  
        <View style={styles.backgroundImageContainer}>
          <Image
            source={require('../../assets/adaptive-icon.png')}
            style={styles.backgroundImage}
          />
        </View>
  
        <ScrollView style={styles.scroll}>
          <View style={styles.headerContainer}>
            <Image
              source={require('../../assets/icon-barra.png')}
              style={styles.titleImage}
            />
          </View>
  
          <View style={styles.container}>
            {/* Este container superior ainda ficará lado a lado em paisagem */}
            <View style={styles.topContainerPortrait}>
              <View style={styles.infoContainer}>
                <Text style={styles.infoText}>Status: {connectionStatus}</Text>
              </View>
  
              <View style={isLandscape ? styles.buttonRow : styles.buttonColumn}>
                {foundDevice && !deviceID && (
                  <View style={styles.buttonWrapper}>
                    <TouchableOpacity
                      style={[styles.customButton, styles.connectButton]}
                      onPress={handleConnectPress}
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
                    onPress={handleResetConnection}
                  >
                    <Text style={styles.customButtonText}>
                      Resetar Conexão
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
  
            {/* O container dos gráficos não precisa mais de estilo condicional */}
            <View style={styles.chartsWrapper}>
              
              {/* --- A LÓGICA DA LARGURA MUDA AQUI --- */}
              {/* Gráfico X */}
              <Text style={styles.chartTitle}>Eixo X </Text>
              <View style={[styles.chartCard, { width: windowWidth - 40 }]}>
                <Text style={styles.infoText}>Gráfico da aceleração: {acelerometro.Ax}g</Text>
                <DynamicChart label="X" data={historicoAccel.Ax} color="#E74C3C" startTime={recordingStartTimeRef.current} containerWidth={chartCardWidth}/>
              </View>
              <View style={[styles.chartCard, { width: windowWidth - 40 }]}>
                <Text style={styles.infoText}>Transformada rápida de fourrier</Text>
                <DynamicChart label="X FFT" data={fftX} color="#9a2b1eff" isFFT={true} pointWidth={25} containerWidth={chartCardWidth}/>
              </View>
  
              <View style={styles.separator} />
  
              {/* Gráfico Y */}
              <Text style={styles.chartTitle}>Eixo Y </Text>
              <View style={[styles.chartCard, { width: windowWidth - 40 }]}>
                <Text style={styles.infoText}>Gráfico da aceleração: {acelerometro.Ay}g</Text>
                <DynamicChart label="Y" data={historicoAccel.Ay} color="#2ECC71" startTime={recordingStartTimeRef.current} containerWidth={chartCardWidth}/>
              </View>
              <View style={[styles.chartCard, { width: windowWidth - 40 }]}>
                <Text style={styles.infoText}>Transformada rápida de fourrier</Text>
                <DynamicChart label="Y FFT" data={fftY} color="#188144ff" isFFT={true} pointWidth={25} containerWidth={chartCardWidth}/>
              </View>
  
              <View style={styles.separator} />
  
              {/* Gráfico Z */}
              <Text style={styles.chartTitle}>Eixo Z </Text>
              <View style={[styles.chartCard, { width: windowWidth - 40 }]}>
                <Text style={styles.infoText}>Gráfico da aceleração: {acelerometro.Az}g</Text>
                <DynamicChart label="Z" data={historicoAccel.Az} color="#3498DB" startTime={recordingStartTimeRef.current} containerWidth={chartCardWidth}/>
              </View>
              <View style={[styles.chartCard, { width: windowWidth - 40 }]}>
                <Text style={styles.infoText}>Transformada rápida de fourrier</Text>
                <DynamicChart label="Z FFT" data={fftZ} color="#145682ff" isFFT={true} pointWidth={25} containerWidth={chartCardWidth}/>
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
    aspectRatio: 1, // 1024 / 1024 = 1
    opacity: 0.15,
  },
  scroll: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },

  // --- CABEÇALHO ---
  headerContainer: {
    width: '100%',
    paddingTop: 50, 
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
    height: 40, // Altura fixa para a imagem do título
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
  separator: {
    height: 1, // Altura de 1 pixel para formar uma linha fina
    width: '90%', // Largura de 90% para não encostar nas laterais
    backgroundColor: '#CCCCCC', // Uma cor cinza claro
    marginVertical: 30, // Um bom espaçamento vertical (15px acima, 15px abaixo)
  },
  
  // --- LAYOUT RESPONSIVO (TOPO) ---
  topContainerPortrait: {
    width: '90%',
    alignItems: 'center',
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
  // --- ESTILOS PARA BOTÕES CUSTOMIZADOS ---
  customButton: {
    width: '100%', // Ocupa toda a largura do buttonWrapper
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
    fontFamily: 'Satoshi-Bold', // <-- A FONTE QUE VOCÊ PEDIU!
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500', // Um peso médio para melhor legibilidade
  },
  // --- GRÁFICOS ---
  chartsWrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  chartCard: {
    marginBottom: 20,
    // A largura dinâmica é aplicada diretamente no JSX, não aqui.
  },
  chartTitle: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 16,
    color: '#333333',
    marginBottom: 8,
  },
  
  // Estilos usados DENTRO do componente DynamicChart
  chartContainer: {
    marginVertical: 8,
    borderRadius: 16,
    width: '100%', // <-- CORRIGIDO
    height: 220,
    overflow: 'hidden',
    backgroundColor: 'rgba(245, 245, 245, 0.8)',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  chartPlaceholder: { 
    width: '100%', // <-- CORRIGIDO
    height: 220,
    fontFamily: 'Satoshi-Regular',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 245, 245, 0.8)',
    borderRadius: 16,
  }
});