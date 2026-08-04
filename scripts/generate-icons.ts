/**
 * Gera os ícones do sistema a partir de código: sem dependência de imagem.
 *
 *   npm run gen:icons
 *
 * Produz:
 *   src/app/favicon.ico        aba do navegador (16 + 32 + 48 embutidos)
 *   src/app/icon.svg           favicon vetorial, nítido em qualquer densidade
 *   public/icon-192.png        atalho Android / manifest
 *   public/icon-512.png        splash e loja de PWA
 *   public/icon-maskable.png   Android adaptativo (área segura de 80%)
 *   public/apple-touch-icon.png  atalho na tela inicial do iPhone (180px)
 *   public/og-image.png        prévia em link compartilhado (1200x630)
 *
 * Por que um encoder próprio: `sharp` e `canvas` trazem binários nativos que
 * quebram em build de host compartilhado. O ícone é geometria simples: um
 * quadrado arredondado e três ondas: e cabe em ~120 linhas de rasterização.
 * Rodar isto é opcional: os arquivos ficam versionados no repositório.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// A laranja do curso, a mesma de `--primary` em globals.css.
const BRAND = { r: 0xff, g: 0x4a, b: 0x17 };
const INK = { r: 0xff, g: 0xff, b: 0xff };

// ===========================================================================
// Encoder PNG mínimo (RGBA, sem interlace)
// ===========================================================================

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** `pixels` é RGBA linear, 4 bytes por pixel. */
function encodePng(width: number, height: number, pixels: Uint8Array): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profundidade
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filtro adaptativo
  ihdr[12] = 0; // sem interlace

  // Cada scanline leva um byte de filtro na frente; 0 = sem filtro.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(pixels.buffer, y * width * 4, width * 4).copy(raw, rowStart + 1);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** ICO com PNGs embutidos: aceito por tudo de Windows Vista para cá. */
function encodeIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // 1 = ícone
  header.writeUInt16LE(images.length, 4);

  const entries: Buffer[] = [];
  let offset = 6 + images.length * 16;

  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0; // paleta
    entry[3] = 0;
    entry.writeUInt16LE(1, 4); // planos
    entry.writeUInt16LE(32, 6); // bits por pixel
    entry.writeUInt32BE(0, 8);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

// ===========================================================================
// Desenho: quadrado arredondado + três ondas
// ===========================================================================

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Distância assinada até um retângulo de cantos arredondados. */
function roundedBoxSdf(px: number, py: number, cx: number, cy: number, hx: number, hy: number, r: number) {
  const qx = Math.abs(px - cx) - hx + r;
  const qy = Math.abs(py - cy) - hy + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return Math.min(Math.max(qx, qy), 0) + outside - r;
}

function distToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

interface IconOptions {
  size: number;
  /** Fração da largura ocupada pelo símbolo. Menor = mais respiro em volta. */
  artScale?: number;
  /**
   * Ícone adaptativo do Android.
   *
   * O sistema recorta o ícone na forma que quiser (círculo, squircle, gota),
   * então o fundo precisa ir de BORDA A BORDA: sem cantos arredondados e sem
   * transparência, ou o recorte deixa buracos. Só o símbolo respeita a zona
   * segura dos 80% centrais.
   */
  maskable?: boolean;
  /** Proporção diferente de 1:1: usado na imagem de prévia de link. */
  height?: number;
}

function drawIcon({ size, artScale = 1, maskable = false, height = size }: IconOptions): Uint8Array {
  const pixels = new Uint8Array(size * height * 4);

  const cx = size / 2;
  const cy = height / 2;

  const art = size * (maskable ? 0.72 : artScale);
  const halfArt = (size * artScale) / 2;
  const cornerRadius = size * artScale * 0.235;

  // Três ondas, centradas verticalmente.
  const waveSpan = art * 0.62;
  const waveLeft = cx - waveSpan / 2;
  const waveRight = cx + waveSpan / 2;
  const stroke = art * 0.082;
  const halfStroke = stroke / 2;
  const amplitude = art * 0.052;
  const wavelength = waveSpan;
  const gap = art * 0.165;
  const waveCenters = [cy - gap, cy, cy + gap];

  const waveAt = (x: number, baseY: number) =>
    baseY + amplitude * Math.sin((2 * Math.PI * (x - waveLeft)) / wavelength);

  /**
   * Cada onda vira uma polilinha densa.
   *
   * A distância perpendicular estimada pela inclinação erra justamente onde a
   * curva vira, e o erro aparece como degrau na ponta do traço. Distância real
   * a segmentos custa mais, mas isto roda uma vez e o resultado é o ícone do
   * produto.
   */
  const samples = Math.max(96, Math.round(size * 0.9));
  const step = (waveRight - waveLeft) / (samples - 1);
  const polylines = waveCenters.map((baseY) =>
    Array.from({ length: samples }, (_, i) => {
      const x = waveLeft + i * step;
      return { x, y: waveAt(x, baseY) };
    }),
  );

  // Só os segmentos próximos em X podem estar dentro do traço.
  const window = halfStroke + amplitude + 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;

      // ---------------------------------------------------------- fundo
      let bgAlpha: number;
      if (maskable) {
        bgAlpha = 1; // sangria total: o recorte do sistema define a forma
      } else {
        const d = roundedBoxSdf(px, py, cx, cy, halfArt, Math.min(halfArt, height / 2), cornerRadius);
        bgAlpha = clamp01(0.5 - d);
      }

      // ---------------------------------------------------------- ondas
      let inkAlpha = 0;
      const lo = Math.max(0, Math.floor((px - window - waveLeft) / step));
      const hi = Math.min(samples - 2, Math.ceil((px + window - waveLeft) / step));

      for (const line of polylines) {
        let dist = Infinity;
        for (let i = lo; i <= hi; i++) {
          const a = line[i];
          const b = line[i + 1];
          const d = distToSegment(px, py, a.x, a.y, b.x, b.y);
          if (d < dist) dist = d;
        }
        // Fora da janela em X, o que vale é a ponta: é ela que dá o cap redondo.
        if (lo > hi) {
          const cap = px < waveLeft ? line[0] : line[samples - 1];
          dist = Math.hypot(px - cap.x, py - cap.y);
        }
        inkAlpha = Math.max(inkAlpha, clamp01(0.5 - (dist - halfStroke)));
      }

      // A onda nunca vaza para fora do fundo.
      inkAlpha = Math.min(inkAlpha, bgAlpha);

      const alpha = Math.max(bgAlpha, inkAlpha);
      const t = alpha > 0 ? inkAlpha / alpha : 0;

      const i = (y * size + x) * 4;
      pixels[i] = Math.round(BRAND.r + (INK.r - BRAND.r) * t);
      pixels[i + 1] = Math.round(BRAND.g + (INK.g - BRAND.g) * t);
      pixels[i + 2] = Math.round(BRAND.b + (INK.b - BRAND.b) * t);
      pixels[i + 3] = Math.round(alpha * 255);
    }
  }

  return pixels;
}

function png(options: IconOptions): Buffer {
  return encodePng(options.size, options.height ?? options.size, drawIcon(options));
}

// ===========================================================================
// SVG: o favicon vetorial, escrito à mão para bater com o raster
// ===========================================================================

function iconSvg(): string {
  const wave = (cy: number) =>
    `M 19 ${cy} C 27 ${cy - 7}, 37 ${cy + 7}, 45 ${cy} S 63 ${cy - 7}, 77 ${cy}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="InglishEasy">
  <rect width="96" height="96" rx="22" fill="#FF4A17"/>
  <g fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round">
    <path d="${wave(32)}"/>
    <path d="${wave(48)}"/>
    <path d="${wave(64)}"/>
  </g>
</svg>
`;
}

// ===========================================================================

function write(relativePath: string, data: Buffer | string) {
  const full = resolve(process.cwd(), relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, data);
  const size = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
  console.log(`  ✓ ${relativePath.padEnd(34)} ${(size / 1024).toFixed(1)} KB`);
}

function main() {
  console.log("\n▸ Gerando ícones\n");

  write("src/app/icon.svg", iconSvg());

  write(
    "src/app/favicon.ico",
    encodeIco([16, 32, 48].map((size) => ({ size, png: png({ size }) }))),
  );

  write("public/icon-192.png", png({ size: 192 }));
  write("public/icon-512.png", png({ size: 512 }));
  write("public/icon-maskable.png", png({ size: 512, maskable: true }));
  // O iOS já aplica o próprio arredondamento por cima: mandamos o quadrado.
  write("public/apple-touch-icon.png", png({ size: 180 }));
  write("public/og-image.png", png({ size: 1200, height: 630, artScale: 0.32 }));

  console.log("\n✓ Ícones gerados.\n");
}

main();
