"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * O rosto da Emma.
 *
 * ===========================================================================
 * POR QUE DESENHADO, E NÃO UMA FOTO
 * ===========================================================================
 * A tela pede uma foto de perfil, do jeito que um aplicativo de mensagem tem.
 * Só que a Emma não é uma pessoa: pôr o rosto de alguém real ali — banco de
 * imagens ou não — é apresentar uma pessoa que não existe como se existisse,
 * e o produto inteiro é construído sobre dizer a verdade ao aluno (o portão
 * que não tranca, o limite honesto de cada trilha, a nota que não infla).
 *
 * Então é uma silhueta: reconhecível como retrato, sem fingir fotografia. O
 * gradiente sai da paleta do sistema, não de uma cor nova.
 *
 * ===========================================================================
 * O ANEL DIZ O ESTADO
 * ===========================================================================
 * Num aplicativo de voz, o que o usuário precisa saber a todo instante é de
 * quem é a vez. O anel responde isso sem texto:
 *
 *   parado      sala fechada
 *   pulsando    a Emma está falando
 *   reagindo    ela está ouvindo, e o anel cresce com o volume da SUA voz
 *
 * O `nivel` (0 a 1) vem do medidor de entrada do microfone, então o anel é uma
 * leitura direta do que está entrando — não uma animação decorativa que roda
 * igual com o microfone mudo.
 */
export function EmmaAvatar({
  estado,
  nivel = 0,
  className,
}: {
  estado: "parada" | "conectando" | "falando" | "ouvindo";
  /** 0 a 1: volume da voz do aluno, para o anel reagir. */
  nivel?: number;
  className?: string;
}) {
  const ativa = estado === "falando" || estado === "ouvindo";

  return (
    <div className={cn("relative grid place-items-center", className)}>
      {/* Anel externo: reage à voz do aluno enquanto ela ouve. Fica fora do
          fluxo para não empurrar nada quando cresce. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full transition-all duration-150",
          estado === "falando" && "bg-primary/20 animate-pulse",
          estado === "ouvindo" && "bg-primary/15",
          estado === "conectando" && "bg-muted-foreground/10 animate-pulse",
        )}
        style={
          estado === "ouvindo"
            ? { transform: `scale(${1 + Math.min(nivel, 1) * 0.22})` }
            : undefined
        }
      />

      <div
        className={cn(
          "relative grid size-full place-items-center overflow-hidden rounded-full ring-4 transition-colors",
          ativa ? "ring-primary/45" : "ring-border",
        )}
      >
        <svg
          viewBox="0 0 128 128"
          className="size-full"
          role="img"
          aria-label="Emma"
        >
          <defs>
            <linearGradient id="emma-fundo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.9" />
              <stop
                offset="100%"
                stopColor="var(--primary)"
                stopOpacity="0.55"
              />
            </linearGradient>
          </defs>

          <rect width="128" height="128" fill="url(#emma-fundo)" />

          {/* Silhueta: ombros, pescoço, cabeça e cabelo. Um retrato de contorno,
              claro o bastante para ler sobre o gradiente em qualquer tema. */}
          <g fill="var(--primary-foreground)" fillOpacity="0.92">
            <path d="M64 74c-19.9 0-36 13.4-36 30v24h72v-24c0-16.6-16.1-30-36-30z" />
            <circle cx="64" cy="52" r="22" />
          </g>
          <path
            d="M64 24c-14.4 0-25 9.7-25 24 0 5.2 1.2 9.3 2.7 12.2.8-8.3 3.6-12.7 7.4-15 5.3-3.2 10.9-3.6 14.9-3.6 6.6 0 12.2 1.6 15.6 5.1 2.6 2.7 4 7 4.5 13.5C85.7 57.3 87 53.2 87 48c0-14.3-8.6-24-23-24z"
            fill="var(--primary-foreground)"
            fillOpacity="0.55"
          />
        </svg>
      </div>
    </div>
  );
}
