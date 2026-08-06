/**
 * Guilhoché — os padrões de linhas entrelaçadas que aparecem em cédulas,
 * apólices e diplomas.
 *
 * São curvas paramétricas: cada camada é a mesma curva com um pequeno desvio
 * de fase e de raio, e é a sobreposição delas que cria a trama de interferência
 * impossível de reproduzir à mão ou numa fotocópia. Aqui elas saem como `d` de
 * `<path>`, calculadas por fórmula — nenhuma imagem, nenhuma dependência, e o
 * traço continua nítido em qualquer escala de impressão.
 */

/** Duas casas decimais bastam na escala em que os desenhos são usados. */
function round(value: number): string {
  return value.toFixed(1);
}

export interface RosetteOptions {
  /** Raio externo, nas unidades do viewBox. */
  radius: number;
  /** Quantidade de lóbulos da roseta. */
  lobes: number;
  /** Profundidade dos lóbulos, de 0 (círculo) a 1. */
  depth: number;
  /** Curvas sobrepostas. */
  layers: number;
  /** Rotação, em radianos, acrescentada a cada camada. */
  twist: number;
  /** Encolhimento do raio a cada camada. */
  scaleStep: number;
  /** Pontos calculados por volta. */
  samples: number;
}

const ROSETTE_DEFAULTS: RosetteOptions = {
  radius: 100,
  lobes: 7,
  depth: 0.3,
  layers: 5,
  twist: 0.12,
  scaleStep: 0.05,
  samples: 260,
};

/**
 * Roseta guilhoché centrada na origem — um epitrocóide de `lobes` lóbulos,
 * repetido com desvio de fase para formar a trama.
 */
export function guillocheRosettePath(options: Partial<RosetteOptions> = {}): string {
  const { radius, lobes, depth, layers, twist, scaleStep, samples } = {
    ...ROSETTE_DEFAULTS,
    ...options,
  };

  const segments: string[] = [];

  for (let layer = 0; layer < layers; layer++) {
    const r = radius * (1 - layer * scaleStep);
    const phase = layer * twist;
    let path = "";

    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * Math.PI * 2;
      const x =
        r * ((1 - depth) * Math.cos(t + phase) + depth * Math.cos(-(lobes - 1) * t + phase));
      const y =
        r * ((1 - depth) * Math.sin(t + phase) + depth * Math.sin(-(lobes - 1) * t + phase));
      path += `${i === 0 ? "M" : "L"}${round(x)} ${round(y)}`;
    }

    segments.push(`${path}Z`);
  }

  return segments.join("");
}

export interface RibbonOptions {
  /** Largura da faixa, nas unidades do viewBox. */
  width: number;
  /** Altura total disponível; as ondas ficam centradas nela. */
  height: number;
  /** Linhas sobrepostas. */
  lines: number;
  /** Ciclos da onda principal ao longo da largura. */
  waves: number;
  /** Amplitude máxima, como fração de metade da altura. */
  amplitude: number;
  /** Defasagem, em radianos, acrescentada a cada linha. */
  phaseStep: number;
  /** Pontos calculados por linha. */
  samples: number;
}

const RIBBON_DEFAULTS: RibbonOptions = {
  width: 1000,
  height: 40,
  lines: 4,
  waves: 14,
  amplitude: 0.85,
  phaseStep: 0.42,
  samples: 200,
};

/**
 * Faixa guilhoché: interferência de duas senoides de frequências múltiplas —
 * por serem múltiplas inteiras, o desenho fecha certinho nas duas pontas e a
 * faixa pode encostar na moldura sem emenda visível.
 */
export function guillocheRibbonPath(options: Partial<RibbonOptions> = {}): string {
  const { width, height, lines, waves, amplitude, phaseStep, samples } = {
    ...RIBBON_DEFAULTS,
    ...options,
  };

  const centerY = height / 2;
  const maxAmplitude = (height / 2) * amplitude;
  const segments: string[] = [];

  for (let line = 0; line < lines; line++) {
    const phase = line * phaseStep;
    let path = "";

    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      const x = u * width;
      const y =
        centerY +
        maxAmplitude * 0.62 * Math.sin(waves * 2 * Math.PI * u + phase) +
        maxAmplitude * 0.38 * Math.sin(waves * 3 * 2 * Math.PI * u - phase * 1.7);
      path += `${i === 0 ? "M" : "L"}${round(x)} ${round(y)}`;
    }

    segments.push(path);
  }

  return segments.join("");
}
