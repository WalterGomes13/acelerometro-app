// src/components/charts/DynamicChart.js

import React, { useRef, useMemo, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';

// Importações NOMEADAS (com chaves)
import { YAxisLabels } from './YAxisLabels';
import { GraphPath } from './GraphPath';

const PADDING = { top: 20, right: 30, bottom: 30, left: 40 };

export const DynamicChart = ({ 
  data, 
  color, 
  isFFT = false, 
  pointWidth,
  chartHeight = 220,
  maxPoints = 200,
  yTicks = 4,
  startTime,
  containerWidth,
  font
}) => {
  const scrollRef = useRef(null);
  //const font = useFont(require('../../assets/fonts/Satoshi-Regular.otf'), 10);
  
  const visibleWidth = containerWidth;
  const trimmedData = Array.isArray(data) ? data.slice(-maxPoints) : [];
  const dataLen = trimmedData.length;

  const { minY, maxY, yTicksArray } = useMemo(() => {
    if (trimmedData.length < 2) {
      const defaultMinY = -2, defaultMaxY = 2, rangeY = 4;
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
      finalMinY = Math.min(...values);
      finalMaxY = Math.max(...values);
      if (finalMinY === finalMaxY) { finalMinY -= 0.5; finalMaxY += 0.5; }
    } else {
      const defaultBoundary = 2;
      const absoluteMax = Math.max(...values.map(v => Math.abs(v)));
      const boundary = Math.max(defaultBoundary, Math.ceil(absoluteMax));
      finalMinY = -boundary;
      finalMaxY = boundary;
    }
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

  const finalPointWidth = pointWidth || 1;
  const chartWidth = Math.max(visibleWidth - PADDING.left, dataLen * finalPointWidth);

  useEffect(() => {
    if (!isFFT && chartWidth > visibleWidth - PADDING.left) {
      scrollRef.current?.scrollToEnd({ animated: false });
    }
  }, [dataLen, isFFT, chartWidth, visibleWidth]);

  if (dataLen < 2) {
    return (
      <View style={[styles.chartPlaceholder, { width: containerWidth }]}>
        <Text>Aguardando dados...</Text>
      </View>
    );
  }

  // --- ESTRUTURA JSX CORRIGIDA ---
  return (
    <View style={[styles.chartContainer, { width: containerWidth }]}>
      <View style={{flexDirection: 'row'}}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  chartContainer: {
    marginVertical: 8,
    borderRadius: 16,
    height: 220,
    overflow: 'hidden',
    backgroundColor: 'rgba(245, 245, 245, 0.8)',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chartPlaceholder: { 
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 245, 245, 0.8)',
    borderRadius: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  }
});