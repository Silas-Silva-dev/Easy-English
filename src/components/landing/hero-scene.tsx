"use client";

import * as React from "react";

export interface SceneCard {
  code: string;
  /** Nome curto — "Destravar", não "Canto 1: Destravar". A placa é estreita. */
  title: string;
  level: string;
  /** Quanto da barra pintar. É ilustrativo: a cena é decorativa. */
  fill: number;
}

/**
 * Os 4 Cantos como uma escada que se afasta.
 *
 * A cena é `aria-hidden`: a mesma informação está, completa e navegável, na
 * seção #cantos logo abaixo. Repeti-la aqui só encheria o leitor de tela de
 * ruído decorativo.
 *
 * Cada placa vive em dois nós: o de fora carrega a posição 3D, o de dentro a
 * flutuação. Fosse tudo no mesmo elemento, a animação sobrescreveria o
 * `transform` do posicionamento e as placas desabariam para o centro.
 */
export function HeroScene({ cards }: { cards: SceneCard[] }) {
  const ref = React.useRef<HTMLDivElement>(null);

  const handleMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Ponteiro grosso (dedo) não move a cena: em toque o efeito ficaria
      // escondido embaixo da própria mão.
      if (event.pointerType !== "mouse") return;

      const node = ref.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      // Escrita direta no nó, não `setState`: um re-render do React a cada
      // pixel do mouse derrubaria os 60 fps por nada.
      node.style.setProperty("--rx", `${(y * -11).toFixed(2)}deg`);
      node.style.setProperty("--ry", `${(x * 15).toFixed(2)}deg`);
    },
    [],
  );

  const handleLeave = React.useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.style.removeProperty("--rx");
    node.style.removeProperty("--ry");
  }, []);

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      aria-hidden="true"
      className="scene-3d relative mx-auto h-[290px] w-full max-w-[420px] select-none sm:h-[360px] lg:h-[470px] lg:max-w-none"
    >
      <div className="tilt-3d layer-3d absolute inset-0">
        {/* Halo no fundo da cena: dá ao conjunto um ponto de luz para onde as
            placas parecem se afastar. */}
        <div
          className="bg-primary/25 pointer-events-none absolute top-1/2 left-1/2 size-[260px] rounded-full blur-[70px] sm:size-[320px]"
          style={{ transform: "translate3d(-50%, -50%, calc(var(--u) * -34))" }}
        />

        {cards.map((card, index) => {
          const x = index * 3 - 4;
          const y = 9 - index * 6;
          const z = index * -6;

          return (
            <div
              key={card.code}
              className="layer-3d absolute top-1/2 left-1/2"
              style={{
                transform:
                  `translate3d(calc(-50% + var(--u) * ${x}), calc(-50% + var(--u) * ${y}), calc(var(--u) * ${z}))` +
                  " rotateY(-22deg) rotateX(10deg)",
                zIndex: cards.length - index,
              }}
            >
              <div
                className="float-3d"
                // Escalonado para as quatro placas não subirem em bloco, que
                // pareceria um elevador em vez de flutuação.
                style={{ animationDelay: `${index * -1.4}s` }}
              >
                <div className="glass-3d w-[186px] rounded-2xl border p-3.5 sm:w-[224px] sm:p-4 lg:w-[262px]">
                  <div className="flex items-center gap-2.5">
                    <span className="bg-primary/15 text-primary grid size-8 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold sm:size-9 sm:text-sm">
                      {card.code}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold sm:text-base">
                        {card.title}
                      </p>
                      <p className="text-muted-foreground truncate text-[10px] sm:text-xs">
                        {card.level}
                      </p>
                    </div>
                  </div>

                  <div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="from-primary h-full rounded-full bg-gradient-to-r to-orange-400"
                      style={{ width: `${card.fill}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
