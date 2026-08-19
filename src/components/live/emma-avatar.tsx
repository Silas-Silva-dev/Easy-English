"use client";

import Image from "next/image";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface EmmaAvatarProps {
  estado: "parada" | "conectando" | "falando" | "ouvindo";
  /** 0 a 1: volume da voz do aluno, para o anel reagir. */
  nivel?: number;
  /** Modo da Emma: foto com blazer no modo professora ou sweater casual no modo conversa. */
  modo?: "professora" | "conversa";
  className?: string;
}

/**
 * O rosto da Emma com transição suave (cross-fade) entre os modos Professora e Conversa.
 * Mantém o anel reativo a áudio e estados da sala de voz em tempo real.
 */
export function EmmaAvatar({
  estado,
  nivel = 0,
  modo = "professora",
  className,
}: EmmaAvatarProps) {
  const ativa = estado === "falando" || estado === "ouvindo";

  return (
    <div className={cn("relative grid place-items-center", className)}>
      {/* Anel externo: reage à voz do aluno enquanto ela ouve */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full transition-all duration-150 pointer-events-none",
          estado === "falando" && "bg-primary/25 animate-pulse shadow-lg shadow-primary/30",
          estado === "ouvindo" && "bg-primary/20",
          estado === "conectando" && "bg-muted-foreground/15 animate-pulse",
        )}
        style={
          estado === "ouvindo"
            ? { transform: `scale(${1 + Math.min(nivel, 1) * 0.25})` }
            : undefined
        }
      />

      {/* Segundo anel sutil de respiração quando falando */}
      {estado === "falando" && (
        <div
          aria-hidden
          className="absolute -inset-2 rounded-full border-2 border-primary/40 animate-ping opacity-35 pointer-events-none"
        />
      )}

      {/* Container da foto com anel e borda */}
      <div
        className={cn(
          "relative size-full overflow-hidden rounded-full ring-4 shadow-xl transition-all duration-500 bg-muted",
          ativa ? "ring-primary shadow-primary/25" : "ring-border/80",
        )}
      >
        {/* Foto do Modo Professora */}
        <Image
          src="/images/emma-teacher.jpg"
          alt="Emma (Professora)"
          fill
          priority
          sizes="(max-width: 768px) 176px, 220px"
          className={cn(
            "object-cover transition-all duration-700 ease-in-out",
            modo === "professora"
              ? cn("opacity-100", estado === "falando" ? "scale-105" : "scale-100")
              : "opacity-0 scale-95 pointer-events-none",
          )}
        />

        {/* Foto do Modo Conversa */}
        <Image
          src="/images/emma-conversation.jpg"
          alt="Emma (Conversa)"
          fill
          priority
          sizes="(max-width: 768px) 176px, 220px"
          className={cn(
            "object-cover transition-all duration-700 ease-in-out",
            modo === "conversa"
              ? cn("opacity-100", estado === "falando" ? "scale-105" : "scale-100")
              : "opacity-0 scale-95 pointer-events-none",
          )}
        />
      </div>
    </div>
  );
}
