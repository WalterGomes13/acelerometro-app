import React, { useRef, useMemo, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet, Dimensions } from 'react-native';
import { useFont } from '@shopify/react-native-skia';
import { YAxisLabels } from './YAxisLabels';
import { GraphPath } from './GraphPath';

const PADDING = { top: 20, right: 30, bottom: 30, left: 40 };

export const DynamicChart = ({ 
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
  const font = useFont(require('../../assets/fonts/Satoshi-Regular.otf'), 10);
  
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
      finalMinY = 0;    // A magnitude da FFT não é negativa, então começamos em 0.
      finalMaxY = 0.5;
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

  // Calcula a largura do gráfico de forma condicional
  let chartWidth;
  if (isFFT) {
    chartWidth = visibleWidth;
  } else {
    // Para os gráficos de aceleração, mantém a lógica de crescer com o tempo.
    chartWidth = Math.max(visibleWidth, PADDING.left + PADDING.right + (dataLen * pointWidth));
  }
  useEffect(() => {
    if (!isFFT && chartWidth > visibleWidth - PADDING.left) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [dataLen, isFFT, chartWidth, visibleWidth]);

  if (dataLen < 2) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.infoText}>Aguardando dados...</Text>
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
      {isFFT ? (
        <GraphPath
          data={trimmedData}
          color={color}
          chartWidth={chartWidth - PADDING.left}
          chartHeight={chartHeight}
          isFFT={isFFT}
          minY={minY}
          maxY={maxY}
          font={font}
          startTime={startTime}
        />
      ) : (
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
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  chartContainer: {
    marginVertical: 8,
    borderRadius: 16,
    width: '100%', 
    height: 220,
    overflow: 'hidden',
    backgroundColor: 'rgba(245, 245, 245, 0.8)',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  chartPlaceholder: { 
    width: '100%', 
    height: 220,
    fontFamily: 'Satoshi-Regular',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 245, 245, 0.8)',
    borderRadius: 16,
  },
  infoText: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 16,
    lineHeight: 24,
  },
});