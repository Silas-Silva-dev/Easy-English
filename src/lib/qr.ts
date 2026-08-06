/**
 * Gerador de QR Code conforme a norma ISO/IEC 18004 (modo byte / UTF-8).
 *
 * A implementação cobre o pipeline completo exigido por qualquer leitor real:
 *   1. seleção automática de versão (1 a 10) pela capacidade do texto;
 *   2. codificação em modo byte com terminador, padding e bytes 0xEC/0x11;
 *   3. divisão em blocos Reed-Solomon com intercalação de dados e paridade;
 *   4. desenho dos padrões de função (localização, alinhamento, temporização);
 *   5. informação de formato/versão protegida por BCH;
 *   6. avaliação das 8 máscaras pelas 4 regras de penalidade da norma.
 *
 * Sem qualquer uma dessas etapas o código até "parece" um QR, mas nenhum
 * celular consegue decodificar — foi exatamente esse o problema da versão
 * anterior, que montava a matriz na versão 4 usando blocos da versão 3.
 */

export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

/** Ordem em que os níveis aparecem na tabela de blocos RS. */
const EC_LEVEL_INDEX: Record<ErrorCorrectionLevel, number> = { L: 0, M: 1, Q: 2, H: 3 };

/** Bits do nível de correção dentro da informação de formato (tabela 12 da norma). */
const EC_FORMAT_BITS: Record<ErrorCorrectionLevel, number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

/**
 * Maior versão suportada. Na 10 já cabem 216 bytes em nível M — muito acima de
 * qualquer URL de verificação — e evita carregar a tabela inteira das 40.
 */
const MAX_VERSION = 10;

/**
 * Blocos Reed-Solomon por versão e nível, na ordem L, M, Q, H.
 * Cada trinca é [quantidade de blocos, total de codewords, codewords de dados].
 * Versões com dois grupos de blocos trazem duas trincas.
 */
const RS_BLOCK_TABLE: number[][] = [
  // Versão 1
  [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
  // Versão 2
  [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
  // Versão 3
  [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
  // Versão 4
  [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
  // Versão 5
  [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
  // Versão 6
  [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
  // Versão 7
  [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
  // Versão 8
  [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
  // Versão 9
  [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
  // Versão 10
  [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16],
];

/** Coordenadas centrais dos padrões de alinhamento, indexadas por versão - 1. */
const ALIGNMENT_PATTERN_POSITIONS: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

/* ==========================================================================
   Aritmética no corpo de Galois GF(256), polinômio primitivo 0x11D
   ========================================================================== */

const GF_EXP = new Array<number>(256);
const GF_LOG = new Array<number>(256);

(function initGaloisField() {
  for (let i = 0; i < 8; i++) GF_EXP[i] = 1 << i;
  for (let i = 8; i < 256; i++) {
    GF_EXP[i] = GF_EXP[i - 4] ^ GF_EXP[i - 5] ^ GF_EXP[i - 6] ^ GF_EXP[i - 8];
  }
  for (let i = 0; i < 255; i++) GF_LOG[GF_EXP[i]] = i;
})();

function gfExp(n: number): number {
  let value = n;
  while (value < 0) value += 255;
  while (value >= 255) value -= 255;
  return GF_EXP[value];
}

function gfLog(n: number): number {
  if (n < 1) throw new Error(`gfLog fora de domínio: ${n}`);
  return GF_LOG[n];
}

function polynomialMultiply(a: number[], b: number[]): number[] {
  const result = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === 0) continue;
    for (let j = 0; j < b.length; j++) {
      if (b[j] === 0) continue;
      result[i + j] ^= gfExp(gfLog(a[i]) + gfLog(b[j]));
    }
  }
  return result;
}

/** Polinômio gerador (x - a^0)(x - a^1)...(x - a^(grau-1)). */
function generatorPolynomial(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    poly = polynomialMultiply(poly, [1, gfExp(i)]);
  }
  return poly;
}

/** Divisão sistemática: devolve as `ecLength` codewords de paridade. */
function reedSolomonEncode(data: number[], ecLength: number): number[] {
  const generator = generatorPolynomial(ecLength);
  const remainder = new Array<number>(ecLength).fill(0);

  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    if (factor === 0) continue;
    const logFactor = gfLog(factor);
    for (let i = 0; i < ecLength; i++) {
      remainder[i] ^= gfExp(gfLog(generator[i + 1]) + logFactor);
    }
  }

  return remainder;
}

/* ==========================================================================
   Codificação dos dados
   ========================================================================== */

interface RSBlockSpec {
  dataCount: number;
  ecCount: number;
}

function getRSBlocks(version: number, ecLevel: ErrorCorrectionLevel): RSBlockSpec[] {
  const entry = RS_BLOCK_TABLE[(version - 1) * 4 + EC_LEVEL_INDEX[ecLevel]];
  const blocks: RSBlockSpec[] = [];
  for (let i = 0; i < entry.length; i += 3) {
    const count = entry[i];
    const totalCount = entry[i + 1];
    const dataCount = entry[i + 2];
    for (let j = 0; j < count; j++) {
      blocks.push({ dataCount, ecCount: totalCount - dataCount });
    }
  }
  return blocks;
}

function totalDataCodewords(version: number, ecLevel: ErrorCorrectionLevel): number {
  return getRSBlocks(version, ecLevel).reduce((sum, block) => sum + block.dataCount, 0);
}

/** Modo byte usa 8 bits de contador até a versão 9 e 16 bits a partir da 10. */
function characterCountBits(version: number): number {
  return version < 10 ? 8 : 16;
}

/** Menor versão em que o texto cabe, ou null se estourar a MAX_VERSION. */
function selectVersion(byteLength: number, ecLevel: ErrorCorrectionLevel): number | null {
  for (let version = 1; version <= MAX_VERSION; version++) {
    const capacityBits = totalDataCodewords(version, ecLevel) * 8;
    const requiredBits = 4 + characterCountBits(version) + byteLength * 8;
    if (requiredBits <= capacityBits) return version;
  }
  return null;
}

class BitBuffer {
  private readonly bits: number[] = [];

  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }

  get length(): number {
    return this.bits.length;
  }

  toCodewords(): number[] {
    const codewords: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) {
        byte = (byte << 1) | (this.bits[i + j] ?? 0);
      }
      codewords.push(byte);
    }
    return codewords;
  }
}

/** Fluxo de dados completo: cabeçalho, payload, terminador e padding. */
function buildDataCodewords(
  bytes: number[],
  version: number,
  ecLevel: ErrorCorrectionLevel,
): number[] {
  const capacity = totalDataCodewords(version, ecLevel);
  const capacityBits = capacity * 8;

  const buffer = new BitBuffer();
  buffer.put(0b0100, 4); // indicador de modo byte
  buffer.put(bytes.length, characterCountBits(version));
  for (const byte of bytes) buffer.put(byte, 8);

  // Terminador de até 4 bits, truncado se o fluxo já estiver perto do limite.
  buffer.put(0, Math.min(4, capacityBits - buffer.length));
  // Completa o byte corrente com zeros.
  while (buffer.length % 8 !== 0) buffer.put(0, 1);

  const codewords = buffer.toCodewords();
  const padBytes = [0xec, 0x11];
  for (let i = 0; codewords.length < capacity; i++) {
    codewords.push(padBytes[i % 2]);
  }

  return codewords;
}

/** Intercala blocos de dados e de paridade na ordem exigida pela norma. */
function interleaveCodewords(
  dataCodewords: number[],
  version: number,
  ecLevel: ErrorCorrectionLevel,
): number[] {
  const specs = getRSBlocks(version, ecLevel);
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];

  let offset = 0;
  for (const spec of specs) {
    const block = dataCodewords.slice(offset, offset + spec.dataCount);
    offset += spec.dataCount;
    dataBlocks.push(block);
    ecBlocks.push(reedSolomonEncode(block, spec.ecCount));
  }

  const result: number[] = [];
  const maxData = Math.max(...dataBlocks.map((block) => block.length));
  for (let i = 0; i < maxData; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  const maxEc = Math.max(...ecBlocks.map((block) => block.length));
  for (let i = 0; i < maxEc; i++) {
    for (const block of ecBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }

  return result;
}

/* ==========================================================================
   Informação de formato e de versão (códigos BCH)
   ========================================================================== */

function formatInformationBits(ecLevel: ErrorCorrectionLevel, maskPattern: number): number {
  const data = (EC_FORMAT_BITS[ecLevel] << 3) | maskPattern;
  let remainder = data;
  for (let i = 0; i < 10; i++) {
    remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  }
  return ((data << 10) | remainder) ^ 0x5412;
}

function versionInformationBits(version: number): number {
  let remainder = version;
  for (let i = 0; i < 12; i++) {
    remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
  }
  return (version << 12) | remainder;
}

/* ==========================================================================
   Montagem da matriz
   ========================================================================== */

const MASK_FUNCTIONS: ReadonlyArray<(row: number, column: number) => boolean> = [
  (row, column) => (row + column) % 2 === 0,
  (row) => row % 2 === 0,
  (_row, column) => column % 3 === 0,
  (row, column) => (row + column) % 3 === 0,
  (row, column) => (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0,
  (row, column) => ((row * column) % 2) + ((row * column) % 3) === 0,
  (row, column) => (((row * column) % 2) + ((row * column) % 3)) % 2 === 0,
  (row, column) => (((row + column) % 2) + ((row * column) % 3)) % 2 === 0,
];

interface BuiltMatrix {
  modules: boolean[][];
  size: number;
}

function buildMatrix(
  codewords: number[],
  version: number,
  ecLevel: ErrorCorrectionLevel,
  maskPattern: number,
): BuiltMatrix {
  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );

  const setFunctionModule = (row: number, column: number, dark: boolean) => {
    modules[row][column] = dark;
    isFunction[row][column] = true;
  };

  // Padrões de localização + separadores claros ao redor.
  const placeFinderPattern = (originRow: number, originColumn: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = originRow + r;
        const column = originColumn + c;
        if (row < 0 || row >= size || column < 0 || column >= size) continue;
        const dark =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        setFunctionModule(row, column, dark);
      }
    }
  };
  placeFinderPattern(0, 0);
  placeFinderPattern(0, size - 7);
  placeFinderPattern(size - 7, 0);

  // Padrões de alinhamento. As três combinações que cairiam sobre os padrões
  // de localização são puladas explicitamente.
  const positions = ALIGNMENT_PATTERN_POSITIONS[version - 1];
  const last = positions.length - 1;
  for (let i = 0; i <= last; i++) {
    for (let j = 0; j <= last; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      const centerRow = positions[i];
      const centerColumn = positions[j];
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const dark = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
          setFunctionModule(centerRow + r, centerColumn + c, dark);
        }
      }
    }
  }

  // Padrões de temporização na linha e na coluna 6.
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    setFunctionModule(6, i, dark);
    setFunctionModule(i, 6, dark);
  }

  // Módulo escuro obrigatório.
  setFunctionModule(size - 8, 8, true);

  // Informação de formato, gravada nas duas cópias previstas pela norma.
  const formatBits = formatInformationBits(ecLevel, maskPattern);
  for (let i = 0; i < 15; i++) {
    const dark = ((formatBits >>> i) & 1) === 1;

    if (i < 6) setFunctionModule(i, 8, dark);
    else if (i < 8) setFunctionModule(i + 1, 8, dark);
    else setFunctionModule(size - 15 + i, 8, dark);

    if (i < 8) setFunctionModule(8, size - 1 - i, dark);
    else if (i === 8) setFunctionModule(8, 7, dark);
    else setFunctionModule(8, 14 - i, dark);
  }

  // Informação de versão (obrigatória a partir da versão 7).
  if (version >= 7) {
    const versionBits = versionInformationBits(version);
    for (let i = 0; i < 18; i++) {
      const dark = ((versionBits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunctionModule(a, b, dark);
      setFunctionModule(b, a, dark);
    }
  }

  // Colocação dos bits em zigue-zague, de baixo para cima, aos pares de coluna.
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // a coluna 6 é de temporização e não entra no par
    for (let vertical = 0; vertical < size; vertical++) {
      for (let j = 0; j < 2; j++) {
        const column = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vertical : vertical;
        if (isFunction[row][column]) continue;
        if (bitIndex < totalBits) {
          modules[row][column] = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) === 1;
          bitIndex++;
        }
        // Bits restantes ficam claros, como manda a norma.
      }
    }
  }

  // Aplicação da máscara apenas sobre os módulos de dados.
  const mask = MASK_FUNCTIONS[maskPattern];
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      if (isFunction[row][column]) continue;
      if (mask(row, column)) modules[row][column] = !modules[row][column];
    }
  }

  return { modules, size };
}

/* ==========================================================================
   Penalidades das máscaras (regras N1 a N4 da norma)
   ========================================================================== */

const FINDER_LIKE_PATTERN = [true, false, true, true, true, false, true];

function penaltyForRuns(line: boolean[]): number {
  let penalty = 0;
  let runColor = line[0];
  let runLength = 1;
  for (let i = 1; i < line.length; i++) {
    if (line[i] === runColor) {
      runLength++;
      continue;
    }
    if (runLength >= 5) penalty += 3 + (runLength - 5);
    runColor = line[i];
    runLength = 1;
  }
  if (runLength >= 5) penalty += 3 + (runLength - 5);
  return penalty;
}

function penaltyForFinderLike(line: boolean[]): number {
  let penalty = 0;
  for (let i = 0; i + 6 < line.length; i++) {
    let matches = true;
    for (let j = 0; j < 7; j++) {
      if (line[i + j] !== FINDER_LIKE_PATTERN[j]) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;

    // Precisa de 4 módulos claros de um dos lados do padrão 1:1:3:1:1.
    const before = line.slice(Math.max(0, i - 4), i);
    const after = line.slice(i + 7, i + 11);
    const clearBefore = i >= 4 && before.every((module) => !module);
    const clearAfter = after.length === 4 && after.every((module) => !module);
    if (clearBefore || clearAfter) penalty += 40;
  }
  return penalty;
}

function computePenalty(modules: boolean[][], size: number): number {
  let penalty = 0;

  for (let index = 0; index < size; index++) {
    const horizontal = modules[index];
    const vertical = modules.map((line) => line[index]);
    penalty += penaltyForRuns(horizontal) + penaltyForRuns(vertical);
    penalty += penaltyForFinderLike(horizontal) + penaltyForFinderLike(vertical);
  }

  // Blocos 2x2 de mesma cor.
  for (let row = 0; row < size - 1; row++) {
    for (let column = 0; column < size - 1; column++) {
      const color = modules[row][column];
      if (
        modules[row][column + 1] === color &&
        modules[row + 1][column] === color &&
        modules[row + 1][column + 1] === color
      ) {
        penalty += 3;
      }
    }
  }

  // Desvio da proporção ideal de 50% de módulos escuros.
  let dark = 0;
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      if (modules[row][column]) dark++;
    }
  }
  const ratio = (dark * 100) / (size * size);
  penalty += Math.floor(Math.abs(ratio - 50) / 5) * 10;

  return penalty;
}

/* ==========================================================================
   API pública
   ========================================================================== */

export interface QRCodeMatrix {
  /** Matriz [linha][coluna]; `true` representa módulo escuro. */
  modules: boolean[][];
  /** Quantidade de módulos por lado, sem a zona de silêncio. */
  size: number;
  version: number;
  errorCorrectionLevel: ErrorCorrectionLevel;
  maskPattern: number;
}

/**
 * Codifica o texto e devolve a matriz já mascarada com a melhor das 8 máscaras.
 * Lança se o conteúdo não couber na maior versão suportada.
 */
export function generateQRCodeMatrix(
  text: string,
  errorCorrectionLevel: ErrorCorrectionLevel = "M",
): QRCodeMatrix {
  if (!text) throw new Error("Texto vazio: não há o que codificar no QR Code.");

  const bytes = Array.from(new TextEncoder().encode(text));
  const version = selectVersion(bytes.length, errorCorrectionLevel);
  if (version === null) {
    throw new Error(
      `Conteúdo de ${bytes.length} bytes excede a capacidade da versão ${MAX_VERSION} no nível ${errorCorrectionLevel}.`,
    );
  }

  const dataCodewords = buildDataCodewords(bytes, version, errorCorrectionLevel);
  const codewords = interleaveCodewords(dataCodewords, version, errorCorrectionLevel);

  let best: BuiltMatrix | null = null;
  let bestMask = 0;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (let maskPattern = 0; maskPattern < 8; maskPattern++) {
    const candidate = buildMatrix(codewords, version, errorCorrectionLevel, maskPattern);
    const penalty = computePenalty(candidate.modules, candidate.size);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = candidate;
      bestMask = maskPattern;
    }
  }

  const chosen = best as BuiltMatrix;
  return {
    modules: chosen.modules,
    size: chosen.size,
    version,
    errorCorrectionLevel,
    maskPattern: bestMask,
  };
}

export interface QRCodeSVGOptions {
  /** Nível de correção de erros. `M` equilibra densidade e tolerância. */
  errorCorrectionLevel?: ErrorCorrectionLevel;
  /** Módulos de zona de silêncio ao redor. A norma exige no mínimo 4. */
  quietZone?: number;
  /** Rótulo acessível do gráfico. */
  title?: string;
  /** Cor dos módulos escuros. Quanto mais perto do preto, melhor a leitura. */
  foreground?: string;
  /** Cor do fundo e da zona de silêncio. */
  background?: string;
}

/**
 * Gera o SVG do QR Code.
 *
 * O SVG sai com `width`/`height` em 100% e um `viewBox` na escala de módulos:
 * assim ele acompanha o tamanho do contêiner sem risco de recorte, tanto na
 * tela quanto na impressão.
 */
export function generateQRCodeSVG(text: string, options: QRCodeSVGOptions = {}): string {
  const {
    errorCorrectionLevel = "M",
    quietZone = 4,
    title = "QR Code de verificação",
    foreground = "#000000",
    background = "#ffffff",
  } = options;

  try {
    const { modules, size } = generateQRCodeMatrix(text, errorCorrectionLevel);
    const viewBox = size + quietZone * 2;

    // Um único path com as sequências horizontais de módulos escuros: mantém o
    // DOM leve e evita frestas de antialiasing entre retângulos vizinhos.
    const segments: string[] = [];
    for (let row = 0; row < size; row++) {
      let column = 0;
      while (column < size) {
        if (!modules[row][column]) {
          column++;
          continue;
        }
        let run = 1;
        while (column + run < size && modules[row][column + run]) run++;
        segments.push(`M${column + quietZone} ${row + quietZone}h${run}v1h-${run}z`);
        column += run;
      }
    }

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBox} ${viewBox}"`,
      ` width="100%" height="100%" preserveAspectRatio="xMidYMid meet"`,
      ` shape-rendering="crispEdges" role="img" aria-label="${escapeXml(title)}">`,
      `<title>${escapeXml(title)}</title>`,
      `<rect width="${viewBox}" height="${viewBox}" fill="${background}"/>`,
      `<path d="${segments.join("")}" fill="${foreground}"/>`,
      `</svg>`,
    ].join("");
  } catch (error) {
    console.error("[qr] Falha ao gerar o QR Code:", error);
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"`,
      ` role="img" aria-label="QR Code indisponível">`,
      `<rect width="100" height="100" fill="${background}"/>`,
      `</svg>`,
    ].join("");
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
