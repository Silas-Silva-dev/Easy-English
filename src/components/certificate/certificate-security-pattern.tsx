"use client";

import { guillocheRibbonPath, guillocheRosettePath } from "@/lib/guilloche";

/**
 * Camada de segurança do certificado.
 *
 * Reúne os elementos que um documento oficial de verdade tem e um certificado
 * genérico não: roseta guilhoché de fundo, faixas guilhoché rentes à moldura e
 * arabescos nos quatro cantos. O SVG usa o milímetro como unidade — o viewBox
 * é a própria A4 paisagem —, então cada medida daqui é a medida no papel.
 */

// Traçados fixos, calculados uma única vez na carga do módulo.
// Muitas camadas com desvio pequeno: e o que produz a trama fechada de
// guilhoche, em vez de um punhado de lacos soltos.
const WATERMARK = guillocheRosettePath({
  radius: 50,
  lobes: 16,
  depth: 0.16,
  layers: 10,
  twist: 0.062,
  scaleStep: 0.019,
  samples: 220,
});

const RIBBON_WIDTH = 245;
const RIBBON_HEIGHT = 3.6;
const RIBBON = guillocheRibbonPath({
  width: RIBBON_WIDTH,
  height: RIBBON_HEIGHT,
  lines: 4,
  waves: 26,
  amplitude: 0.9,
  phaseStep: 0.55,
  samples: 260,
});

/**
 * Cantoneira do canto superior esquerdo: dois colchetes arredondados
 * concentricos com um losango no vao. Os outros tres cantos sao espelhos.
 *
 * O desenho tem 10mm e comeca a 8.8mm da borda, ou seja, termina em 18.8mm —
 * logo antes dos 21mm onde o rodape comeca. E essa folga que impede a borda do
 * bloco de validacao de cruzar o enfeite.
 */
const CORNER_ORNAMENT = [
  "M0 10V4.2A4.2 4.2 0 0 1 4.2 0H10",
  "M2.7 10V5.3A2.7 2.7 0 0 1 5.3 2.7H10",
  "M5.5 3.7 7.3 5.5 5.5 7.3 3.7 5.5Z",
].join("");

const CORNER_INSET = 8.8;

const CORNERS = [
  { x: CORNER_INSET, y: CORNER_INSET, scale: "1,1" },
  { x: 297 - CORNER_INSET, y: CORNER_INSET, scale: "-1,1" },
  { x: CORNER_INSET, y: 210 - CORNER_INSET, scale: "1,-1" },
  { x: 297 - CORNER_INSET, y: 210 - CORNER_INSET, scale: "-1,-1" },
];

export function CertificateSecurityPattern() {
  return (
    <svg
      className="cert-security"
      viewBox="0 0 297 210"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Marca d'água: roseta guilhoché no centro da folha */}
      <g transform="translate(148.5 105)" opacity="0.05">
        <path d={WATERMARK} fill="none" stroke="currentColor" strokeWidth="0.12" />
      </g>

      {/* Faixas guilhoché rentes à moldura, acima e abaixo do conteúdo */}
      <g opacity="0.38">
        <g transform="translate(26 9.8)">
          <path d={RIBBON} fill="none" stroke="currentColor" strokeWidth="0.14" />
        </g>
        <g transform={`translate(26 ${210 - 9.8 - RIBBON_HEIGHT})`}>
          <path d={RIBBON} fill="none" stroke="currentColor" strokeWidth="0.14" />
        </g>
      </g>

      {/* Arabescos nos quatro cantos */}
      <g opacity="0.6">
        {CORNERS.map((corner) => (
          <g
            key={`${corner.x}-${corner.y}`}
            transform={`translate(${corner.x} ${corner.y}) scale(${corner.scale})`}
          >
            <path
              d={CORNER_ORNAMENT}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.35"
              strokeLinecap="round"
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
