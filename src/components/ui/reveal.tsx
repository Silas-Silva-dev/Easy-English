"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Revela o bloco quando ele entra na tela.
 *
 * A landing tinha `animate-in-up`, que é uma animação de ENTRADA: dispara uma
 * vez, na montagem. Quando a página cresceu (trilhas + preço), quase tudo
 * passou a nascer abaixo da dobra — a animação já tinha terminado antes de o
 * visitante rolar até lá, e o resto da página ficou parado.
 *
 * É um componente de cliente de propósito estreito: só ele hidrata, e os
 * `children` continuam sendo renderizados no servidor. A landing segue sendo
 * Server Component estático (`○` no build), que é o que os cabeçalhos de cache
 * do next.config pressupõem.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Atraso em ms — escalona os cartões de uma grade em vez de piscar todos juntos. */
  delay?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Navegador sem IntersectionObserver não fica com a página em branco.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setShown(true);
        // Anima uma vez só: reanimar a cada rolagem cansa e atrapalha quem
        // volta para reler um trecho.
        observer.disconnect();
      },
      // Recuo embaixo para o bloco entrar já "dentro" da tela, e não colado na
      // borda, onde a animação passa despercebida.
      { rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", className)}
      data-shown={shown ? "" : undefined}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
