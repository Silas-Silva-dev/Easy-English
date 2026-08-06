/**
 * Decodificador independente: lê a matriz produzida por src/lib/qr.ts do zero
 * (formato -> máscara -> zigue-zague -> desintercalação -> síndromes RS -> texto)
 * e compara com a entrada original. Nada é reaproveitado do encoder além da matriz.
 */
import { generateQRCodeMatrix, generateQRCodeSVG } from "../src/lib/qr";

// ---------- GF(256) independente ----------
const EXP = new Array<number>(512);
const LOG = new Array<number>(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// ---------- Tabela de blocos (transcrita da norma, independente do encoder) ----------
// [ecPerBlock, blocosGrupo1, dadosGrupo1, blocosGrupo2, dadosGrupo2] por versão, nível M
const BLOCKS_M: Record<number, [number, number, number, number, number]> = {
  1: [10, 1, 16, 0, 0],
  2: [16, 1, 28, 0, 0],
  3: [26, 1, 44, 0, 0],
  4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0],
  6: [16, 4, 27, 0, 0],
  7: [18, 4, 31, 0, 0],
  8: [22, 2, 38, 2, 39],
  9: [22, 3, 36, 2, 37],
  10: [26, 4, 43, 1, 44],
};

const ALIGNMENT: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

const MASKS: Array<(r: number, c: number) => boolean> = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function functionModuleMap(size: number, version: number): boolean[][] {
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const mark = (r: number, c: number) => {
    if (r >= 0 && r < size && c >= 0 && c < size) fn[r][c] = true;
  };
  // localizadores + separadores + blocos de formato
  for (const [or, oc] of [[0, 0], [0, size - 7], [size - 7, 0]] as const) {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) mark(or + r, oc + c);
  }
  // faixas de formato
  for (let i = 0; i < 9; i++) { mark(8, i); mark(i, 8); }
  for (let i = 0; i < 8; i++) { mark(8, size - 1 - i); mark(size - 1 - i, 8); }
  // temporização
  for (let i = 0; i < size; i++) { mark(6, i); mark(i, 6); }
  // alinhamento
  const pos = ALIGNMENT[version];
  const last = pos.length - 1;
  for (let i = 0; i <= last; i++) {
    for (let j = 0; j <= last; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) mark(pos[i] + r, pos[j] + c);
    }
  }
  // informação de versão
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      mark(a, b); mark(b, a);
    }
  }
  return fn;
}

function bchFormatOk(raw: number): boolean {
  // divisão pelo polinômio gerador G15 = 0x537 sobre os 15 bits
  let rem = raw;
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return rem === 0;
}

interface Decoded {
  version: number;
  ecLevel: string;
  mask: number;
  text: string;
}

function decode(modules: boolean[][], size: number): Decoded {
  if ((size - 17) % 4 !== 0) throw new Error(`Tamanho inválido: ${size}`);
  const version = (size - 17) / 4;

  // --- informação de formato, cópia 1 ---
  let raw = 0;
  for (let i = 0; i < 15; i++) {
    let bit: boolean;
    if (i < 6) bit = modules[i][8];
    else if (i < 8) bit = modules[i + 1][8];
    else bit = modules[size - 15 + i][8];
    if (bit) raw |= 1 << i;
  }
  const unmasked = raw ^ 0x5412;
  if (!bchFormatOk(unmasked)) throw new Error("BCH da informação de formato não fecha (cópia 1)");

  // --- informação de formato, cópia 2, tem de bater com a primeira ---
  let raw2 = 0;
  for (let i = 0; i < 15; i++) {
    let bit: boolean;
    if (i < 8) bit = modules[8][size - 1 - i];
    else if (i === 8) bit = modules[8][7];
    else bit = modules[8][14 - i];
    if (bit) raw2 |= 1 << i;
  }
  if (raw2 !== raw) throw new Error("As duas cópias da informação de formato divergem");

  const ecBits = (unmasked >>> 13) & 0b11;
  const mask = (unmasked >>> 10) & 0b111;
  const ecLevel = { 0b01: "L", 0b00: "M", 0b11: "Q", 0b10: "H" }[ecBits as 0 | 1 | 2 | 3];
  if (ecLevel !== "M") throw new Error(`Nível de correção lido = ${ecLevel}, esperado M`);

  // --- módulo escuro obrigatório ---
  if (!modules[size - 8][8]) throw new Error("Módulo escuro obrigatório ausente");

  // --- informação de versão (v >= 7) ---
  if (version >= 7) {
    let vraw = 0;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      if (modules[a][b]) vraw |= 1 << i;
      if (modules[a][b] !== modules[b][a]) throw new Error("Cópias da info de versão divergem");
    }
    let rem = vraw;
    for (let i = 17; i >= 12; i--) if ((rem >>> i) & 1) rem ^= 0x1f25 << (i - 12);
    if (rem !== 0) throw new Error("BCH da informação de versão não fecha");
    if (vraw >>> 12 !== version) throw new Error("Versão codificada difere do tamanho da matriz");
  }

  // --- desmascarar e ler em zigue-zague ---
  const fn = functionModuleMap(size, version);
  const maskFn = MASKS[mask];
  const bits: number[] = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical++) {
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        const upward = ((right + 1) & 2) === 0;
        const r = upward ? size - 1 - vertical : vertical;
        if (fn[r][c]) continue;
        const value = maskFn(r, c) ? !modules[r][c] : modules[r][c];
        bits.push(value ? 1 : 0);
      }
    }
  }

  const stream: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    stream.push(byte);
  }

  // --- desintercalar ---
  const [ecPerBlock, n1, d1, n2, d2] = BLOCKS_M[version];
  const specs: number[] = [];
  for (let i = 0; i < n1; i++) specs.push(d1);
  for (let i = 0; i < n2; i++) specs.push(d2);
  const totalBlocks = specs.length;

  const dataBlocks: number[][] = specs.map(() => []);
  let idx = 0;
  const maxData = Math.max(...specs);
  for (let i = 0; i < maxData; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      if (i < specs[b]) dataBlocks[b].push(stream[idx++]);
    }
  }
  const ecBlocks: number[][] = specs.map(() => []);
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < totalBlocks; b++) ecBlocks[b].push(stream[idx++]);
  }

  // --- verificação por síndromes: todas devem ser zero num código íntegro ---
  for (let b = 0; b < totalBlocks; b++) {
    const cw = [...dataBlocks[b], ...ecBlocks[b]];
    for (let s = 0; s < ecPerBlock; s++) {
      let acc = 0;
      for (let j = 0; j < cw.length; j++) {
        acc ^= mul(cw[j], EXP[(s * (cw.length - 1 - j)) % 255]);
      }
      if (acc !== 0) throw new Error(`Síndrome ${s} do bloco ${b} != 0 (paridade RS inválida)`);
    }
  }

  // --- interpretar o fluxo de dados ---
  const dataBits: number[] = [];
  for (const block of dataBlocks) {
    for (const byte of block) for (let i = 7; i >= 0; i--) dataBits.push((byte >>> i) & 1);
  }
  let p = 0;
  const take = (n: number) => {
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | dataBits[p++];
    return v;
  };
  const mode = take(4);
  if (mode !== 0b0100) throw new Error(`Modo lido = ${mode.toString(2)}, esperado 0100 (byte)`);
  const count = take(version < 10 ? 8 : 16);
  const bytes: number[] = [];
  for (let i = 0; i < count; i++) bytes.push(take(8));

  return {
    version,
    ecLevel,
    mask,
    text: new TextDecoder().decode(Uint8Array.from(bytes)),
  };
}

// ---------- casos de teste ----------
const cases = [
  // Dominio real de producao (NEXT_PUBLIC_SITE_URL) e o de desenvolvimento.
  "https://easyenglish.silassilva.tech/verificar-certificado/EE-2026-MFGQAKXZ",
  "https://easyenglish.com/verificar-certificado/EE-2026-MFGQAKXZ",
  "https://www.easyenglish.com.br/verificar-certificado/EE-2026-MFGQAKXZ",
  "http://localhost:3000/verificar-certificado/EE-2026-ABCDEFGH",
  "https://easy.example/verificar-certificado/EE-2026-Z9Y8X7W6",
  "A",
  "HELLO WORLD",
  "acentuação e cedilha: verificação de certificação — ÁÉÍÓÚ",
  "x".repeat(120),
  "https://muito-longo.example.com.br/verificar-certificado/" + "E".repeat(100),
];

let failures = 0;
for (const input of cases) {
  try {
    const matrix = generateQRCodeMatrix(input, "M");
    const out = decode(matrix.modules, matrix.size);
    const ok = out.text === input;
    if (!ok) failures++;
    console.log(
      `${ok ? "OK  " : "FALHA"} v${String(out.version).padStart(2)} ${matrix.size}x${matrix.size} ` +
      `mask=${out.mask} enc.mask=${matrix.maskPattern} len=${input.length} :: ${input.slice(0, 46)}`,
    );
    if (!ok) console.log(`      esperado: ${input}\n      obtido:   ${out.text}`);
    if (out.mask !== matrix.maskPattern) {
      failures++;
      console.log("      máscara declarada no formato difere da escolhida pelo encoder");
    }
  } catch (error) {
    failures++;
    console.log(`FALHA (${(error as Error).message}) :: ${input.slice(0, 46)}`);
  }
}

// SVG sanity: sem recorte, viewBox coerente, único path
const svg = generateQRCodeSVG("https://easyenglish.com/verificar-certificado/EE-2026-MFGQAKXZ");
const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
const m = generateQRCodeMatrix("https://easyenglish.com/verificar-certificado/EE-2026-MFGQAKXZ", "M");
const expected = m.size + 8;
console.log(
  `\nSVG: viewBox=${vb?.[1]}x${vb?.[2]} esperado=${expected} ` +
  `width100%=${svg.includes('width="100%"')} bytes=${svg.length}`,
);
if (Number(vb?.[1]) !== expected || Number(vb?.[2]) !== expected) failures++;
if (!svg.includes('width="100%"')) failures++;

console.log(failures === 0 ? "\nTODOS OS TESTES PASSARAM" : `\n${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
