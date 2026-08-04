"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Inclina o cartão na direção do mouse.
 *
 * Mesmo mecanismo da cena do hero: o ângulo vai para `--rx`/`--ry` direto no
 * nó, e a regra `.tilt-3d` só existe sob `(hover: hover) and (pointer: fine)`.
 * Em celular isto é um `div` comum, sem listener ativo, sem custo.
 *
 * `intensity` fica baixo de propósito — 6° já dá a sensação de placa física.
 * Acima de uns 10° o texto começa a borrar na diagonal e o cartão vira truque.
 */
export function TiltCard({
  children,
  className,
  intensity = 6,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  const handleMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "mouse") return;

      const node = ref.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      node.style.setProperty("--rx", `${(y * -intensity).toFixed(2)}deg`);
      node.style.setProperty("--ry", `${(x * intensity).toFixed(2)}deg`);
    },
    [intensity],
  );

  const handleLeave = React.useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.style.removeProperty("--rx");
    node.style.removeProperty("--ry");
  }, []);

  return (
    <div className="scene-3d flex">
      <div
        ref={ref}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        className={cn("tilt-3d layer-3d flex w-full", className)}
      >
        {children}
      </div>
    </div>
  );
}
