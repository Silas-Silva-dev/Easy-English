"use client";

import * as React from "react";

import { guillocheRosettePath } from "@/lib/guilloche";

/**
 * Selo oficial de emissão.
 *
 * É o carimbo circular dos documentos oficiais: anéis concêntricos, dizeres
 * curvados acompanhando a borda, roseta guilhoché no miolo e a marca da
 * plataforma ao centro. Tudo desenhado em SVG, então imprime nítido em
 * qualquer resolução e não depende de fonte nem de imagem externa.
 */

// Calculada uma vez só: o traçado é fixo.
const SEAL_ROSETTE = guillocheRosettePath({
  radius: 52,
  lobes: 9,
  depth: 0.34,
  layers: 4,
  twist: 0.16,
  scaleStep: 0.07,
  samples: 200,
});

const ARC_RADIUS = 76;
const TOP_ARC = `M-${ARC_RADIUS} 0A${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${ARC_RADIUS} 0`;
// Sentido invertido para os dizeres de baixo saírem em pé, como num carimbo.
const BOTTOM_ARC = `M-${ARC_RADIUS} 0A${ARC_RADIUS} ${ARC_RADIUS} 0 0 0 ${ARC_RADIUS} 0`;

interface CertificateSealProps {
  className?: string;
}

export function CertificateSeal({ className }: CertificateSealProps) {
  // Os ids precisam ser únicos no documento: a página pública chega a montar o
  // certificado mais de uma vez.
  const uid = React.useId().replace(/:/g, "");
  const topId = `${uid}-top`;
  const bottomId = `${uid}-bottom`;

  return (
    <svg
      viewBox="-100 -100 200 200"
      className={className}
      role="img"
      aria-label="Selo oficial de emissão da Easy English Language Academy"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <path id={topId} d={TOP_ARC} />
        <path id={bottomId} d={BOTTOM_ARC} />
      </defs>

      {/* Anéis externos */}
      <circle r="97" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.85" />
      <circle r="90" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <circle r="64" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />

      {/* Dizeres curvados na borda */}
      {/* O comprimento do arco e pi*76 = 239: a fonte e o espacejamento sao
          calculados para os dizeres caberem inteiros, sem corte. */}
      <text fill="currentColor" fontSize="10" fontWeight="700" letterSpacing="1.5" opacity="0.95">
        <textPath href={`#${topId}`} startOffset="50%" textAnchor="middle">
          EASY ENGLISH LANGUAGE ACADEMY
        </textPath>
      </text>
      <text fill="currentColor" fontSize="9" fontWeight="600" letterSpacing="1.6" opacity="0.8">
        <textPath href={`#${bottomId}`} startOffset="50%" textAnchor="middle">
          SELO OFICIAL DE EMISSÃO
        </textPath>
      </text>

      {/* Estrelas separando os dois dizeres */}
      <g fill="currentColor" opacity="0.8">
        <circle cx="-80" cy="0" r="3.4" />
        <circle cx="80" cy="0" r="3.4" />
      </g>

      {/* Roseta guilhoché no miolo */}
      <path
        d={SEAL_ROSETTE}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.35"
        vectorEffect="non-scaling-stroke"
      />

      {/* Marca da plataforma ao centro — as três ondas do logotipo */}
      <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.95">
        <path d="M-24 -13c6-7 12-7 18 0s12 7 18 0 12-7 18 0" transform="translate(-6 0)" />
        <path d="M-24 1c6-7 12-7 18 0s12 7 18 0 12-7 18 0" transform="translate(-6 0)" />
        <path d="M-24 15c6-7 12-7 18 0s12 7 18 0 12-7 18 0" transform="translate(-6 0)" />
      </g>
    </svg>
  );
}
