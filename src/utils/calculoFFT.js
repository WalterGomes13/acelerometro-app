import FFT from "fft.js";

export function calcularFFT(dados, sampleRate = 100) {
  const N = dados.length;
  const slice = Array.isArray(dados) ? dados.slice(-N) : [];

  if(slice.length < N){
    while (slice.length < N) return [];
  }

  const mean = slice.reduce((acc, v) => acc + v, 0) / N;
  const signal = slice.map(v => v - mean)

  const windowed = signal.map((v, i) =>
    v * (0.5 * (1 - Math.cos((2*Math.PI*i)/(N - 1))))
  );

  const fft = new FFT(N);
  const out = fft.createComplexArray(); //so para tamanho ; tam: N*2
  fft.realTransform(out, windowed);
  //fft.completeSpectrum(out);

  const scaling = N / 4;

  const magnitudes = [];
  for (let i = 0; i < N / 2; i++) {
    const re = out[2 * i]; // valor real
    const im = out[2 * i + 1]; //valor imag
    const freq = (i * sampleRate) / N; 
    const raw = Math.sqrt(re*re + im*im);
    const magnitude = raw / scaling;
    magnitudes.push({ x: freq, y: magnitude});
  }
  return magnitudes; 
}