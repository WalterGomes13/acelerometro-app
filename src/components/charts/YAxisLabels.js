import React from 'react';
import { View } from 'react-native';
import { Canvas, Text as SkiaText } from '@shopify/react-native-skia';

const PADDING = { top: 20, right: 30, bottom: 30, left: 40 };

export const YAxisLabels = ({ yTicksArray, chartHeight, font }) => {
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