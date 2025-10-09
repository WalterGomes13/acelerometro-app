import React, { useMemo } from 'react';
import { Canvas, Path, Skia, Text as SkiaText } from '@shopify/react-native-skia';

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

  const renderXAxisLabels = () => {
    // Só executa se for o gráfico da FFT e a fonte estiver carregada
    if (!isFFT || !font) return null;

    // 1. Defina os parâmetros da sua FFT
    const sampleRate = 20; // IMPORTANTE: Este valor deve ser o mesmo usado na sua função calcularFFT
    const maxFreq = sampleRate / 2; // A frequência máxima de uma FFT é metade da taxa de amostragem
    const labels = [];

    // 2. Crie um loop para cada frequência inteira que queremos mostrar (0Hz, 1Hz, 2Hz, ...)
    for (let hz = 0; hz <= maxFreq; hz++) {
      
      // 3. Calcule a posição X para cada frequência.
      // A posição é uma proporção da frequência em relação à frequência máxima.
      const x = PADDING.left + (hz / maxFreq) * graphWidth - 4; // o -4 é um pequeno ajuste para centralizar o texto
      const y = chartHeight - PADDING.bottom + 14;

      labels.push(
        <SkiaText
          key={`xt-hz-${hz}`}
          x={x}
          y={y}
          text={`${hz}Hz`}
          font={font}
          color="black"
        />
      );
    }
    return labels;
  };

  return (
    <Canvas style={{ width: chartWidth, height: chartHeight }}>
      <Path path={skPath} style="stroke" color={color} strokeWidth={2} />

      {renderXAxisLabels()}
      {/* Labels X para FFT */}
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