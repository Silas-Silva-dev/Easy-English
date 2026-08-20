import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Revela o bloco quando ele entra na tela.
 *
 * ===========================================================================
 * POR QUE DEIXOU DE SER COMPONENTE DE CLIENTE
 * ===========================================================================
 * Era um `"use client"` com `IntersectionObserver`: cada bloco montava um
 * observador e trocava um `data-shown` quando aparecia. Funcionava, e custava
 * duas coisas medidas no celular.
 *
 * A primeira é que `.reveal` nascia com `opacity: 0`. São dezessete blocos só
 * na landing — quase tudo abaixo do cabeçalho. Até o JavaScript baixar,
 * hidratar e os observadores dispararem, aquilo era uma página em branco com
 * um cabeçalho em cima. Quem tem 4G ruim vê exatamente isso, e quem tem o
 * JavaScript bloqueado vê isso para sempre.
 *
 * A segunda é o preço de dezessete fronteiras de cliente: cada uma vira
 * referência de módulo no payload RSC e trabalho de hidratação na thread
 * principal, que era onde estavam 624 ms do carregamento móvel.
 *
 * A animação agora é do CSS, presa à rolagem (`animation-timeline: view()`),
 * e o componente voltou a ser de servidor: zero JavaScript, zero hidratação.
 * O bloco `@supports` em `globals.css` garante que navegador sem animação de
 * rolagem — Safari e Firefox, hoje — mostre o conteúdo direto, visível, sem
 * animação. Perder a animação é aceitável; perder o conteúdo não era.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /**
   * Atraso em ms — escalona os cartões de uma grade em vez de revelar todos
   * juntos. As chamadas continuam passando ms (`index * 70`); aqui isso vira
   * um passo em pontos percentuais da faixa de rolagem, porque é assim que
   * `animation-range` mede. Dividir por 30 mantém o escalonamento no mesmo
   * tamanho de antes: 70 ms viram pouco mais de 2 pontos.
   */
  delay?: number;
}) {
  const passo = delay ? Math.min(12, Math.round((delay / 30) * 10) / 10) : 0;

  return (
    <div
      className={cn("reveal", className)}
      style={
        passo ? ({ "--reveal-passo": passo } as React.CSSProperties) : undefined
      }
    >
      {children}
    </div>
  );
}
