import { useFonts } from 'expo-font';
import { StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { DashboardScreen } from './src/screens/DashboardScreen';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'Satoshi-Regular': require('./assets/fonts/Satoshi-Regular.otf'),
    'Satoshi-Medium': require('./assets/fonts/Satoshi-Medium.otf'),
    'Satoshi-Bold': require('./assets/fonts/Satoshi-Bold.otf'),
    'Satoshi-Black' : require('./assets/fonts/Satoshi-Black.otf')
  })

  useEffect(() => {
    if (fontError) {
      console.error("ERRO DETALHADO AO CARREGAR FONTES:", fontError);
    }
  }, [fontError]);

  if (!fontsLoaded && !fontError) {
    return null; 
  }

  return <DashboardScreen />
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
    // A sombra pode ser adicionada aqui se desejar
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