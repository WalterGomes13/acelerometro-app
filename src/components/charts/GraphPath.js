import React, { useMemo } from 'react';
import { Canvas, Path, Skia, SkiaText } from '@shopify/react-native-skia';

const PADDING = { top: 20, right: 30, bottom: 30, left: 40 };

export const GraphPath = ({ data, color, chartWidth, chartHeight, isFFT, minY, maxY, font, startTime }) => {
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

  // Guarda a última label de tempo desenhada para evitar sobreposição
  let lastLabelTime = -Infinity; 

  return (
    <Canvas style={{ width: chartWidth, height: chartHeight }}>
      <Path path={skPath} style="stroke" color={color} strokeWidth={2} />

      {/* Labels X para FFT */}
      {isFFT && font && data.map((p, i) => {
        if (i % 5 !== 0) return null;
        const x = PADDING.left + (i / (data.length - 1)) * graphWidth - 6;
        const y = chartHeight - PADDING.bottom + 14;
        return (<SkiaText key={`xt-freq-${i}`} x={x} y={y} text={`${p.x.toFixed(0)}Hz`} font={font} color="black" />);
      })}
      {!isFFT && font && startTime && data.map((point, i) => {
        const elapsedMillis = point.timestamp - startTime;
        const elapsedSeconds = elapsedMillis / 1000;

        if (elapsedSeconds >= lastLabelTime + 5) {
          const labelTime = Math.floor(elapsedSeconds / 5) * 5;
          if (labelTime > lastLabelTime) {
            lastLabelTime = labelTime;
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