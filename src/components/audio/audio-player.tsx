"use client";

import { AlertTriangle, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  cancelSpeech,
  isSpeechSupported,
  parseScript,
  speakLines,
  type SpeakLine,
} from "@/lib/speech";
import { cn } from "@/lib/utils";

/**
 * Velocidades de treino.
 *
 * 0,75x existe para a primeira escuta de iniciante; 1,25x e 1,5x existem
 * porque depois de treinar acelerado a velocidade normal do nativo soa
 * devagar — é o mesmo princípio de treinar com peso e competir sem.
 */
const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

export interface AudioPlayerProps {
  /** O texto a falar. Diálogos usam o formato "NOME: fala / NOME: fala". */
  text: string;
  /** Diálogo alterna duas vozes; single usa uma só. */
  mode?: "single" | "dialogue";
  label?: string;
  /** Esconde o seletor de velocidade (blocos curtos não precisam). */
  compact?: boolean;
  /** Repete indefinidamente — usado no shadowing. */
  loop?: boolean;
  className?: string;
  onEnded?: () => void;
  onPlayCountChange?: (count: number) => void;
}

export function AudioPlayer({
  text,
  mode = "single",
  label,
  compact = false,
  loop = false,
  className,
  onEnded,
  onPlayCountChange,
}: AudioPlayerProps) {
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState<number>(1);
  const [plays, setPlays] = React.useState(0);
  const [lineIndex, setLineIndex] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [supported, setSupported] = React.useState(true);

  const lines: SpeakLine[] = React.useMemo(
    () => (mode === "dialogue" ? parseScript(text) : [{ text }]),
    [text, mode],
  );

  React.useEffect(() => setSupported(isSpeechSupported()), []);

  // Sair da página no meio de uma fala deixaria a voz tocando sozinha.
  React.useEffect(() => cancelSpeech, []);

  React.useEffect(() => {
    cancelSpeech();
    setPlaying(false);
    setLineIndex(0);
  }, [text]);

  const start = React.useCallback(() => {
    setError(null);
    setPlaying(true);
    setPlays((p) => {
      const next = p + 1;
      onPlayCountChange?.(next);
      return next;
    });

    void speakLines(lines, {
      rate: speed,
      onLine: setLineIndex,
      onEnd: () => {
        setLineIndex(0);
        if (loop) {
          start();
        } else {
          setPlaying(false);
          onEnded?.();
        }
      },
      onError: (message) => {
        setError(message);
        setPlaying(false);
      },
    });
  }, [lines, speed, loop, onEnded, onPlayCountChange]);

  function toggle() {
    if (playing) {
      cancelSpeech();
      setPlaying(false);
      setLineIndex(0);
      return;
    }
    start();
  }

  function restart() {
    cancelSpeech();
    setLineIndex(0);
    start();
  }

  // A velocidade não muda no meio de uma fala já em curso — reiniciamos.
  function changeSpeed(next: number) {
    setSpeed(next);
    if (playing) {
      cancelSpeech();
      setPlaying(false);
      setLineIndex(0);
    }
  }

  const progressPct = lines.length > 1 ? ((lineIndex + (playing ? 1 : 0)) / lines.length) * 100 : playing ? 100 : 0;

  if (!supported) {
    return (
      <div className={cn("bg-muted/40 rounded-xl border border-dashed p-4", className)}>
        <p className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="text-streak size-4 shrink-0" /> Áudio indisponível neste navegador
        </p>
        <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
          A fala do curso é sintetizada pelo próprio navegador. Chrome, Edge e Safari funcionam; alguns
          navegadores alternativos não. O texto abaixo continua disponível.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-xl border p-4", className)}>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          variant={playing ? "secondary" : "default"}
          onClick={toggle}
          aria-label={playing ? "Parar" : "Ouvir"}
          className="shrink-0"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Volume2 className="text-muted-foreground size-3.5 shrink-0" />
            <span className="truncate text-sm font-medium">{label ?? "Ouvir"}</span>
            {plays > 0 ? (
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{plays}x</span>
            ) : null}
          </div>

          <div className="bg-muted mt-2 h-1 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {plays > 0 ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={restart}
            aria-label="Recomeçar"
            className="shrink-0"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        ) : null}
      </div>

      {!compact ? (
        // flex-wrap: em 320px os quatro botões não cabem ao lado do rótulo.
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Velocidade</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeSpeed(s)}
              className={cn(
                // min-h/min-w 10: errar o vizinho reinicia a fala em curso.
                "inline-flex min-h-10 min-w-10 items-center justify-center rounded-md px-2.5 text-xs font-medium tabular-nums transition-colors",
                speed === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent",
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-destructive mt-3 text-xs leading-relaxed">{error}</p> : null}
    </div>
  );
}

/**
 * Portão de imersão do dia 1: o texto só destrava depois de N escutas.
 *
 * Não é gamificação — é o método. Ler antes de ouvir cola a pronúncia do
 * português nas letras, e isso é bem mais difícil de desfazer depois.
 */
export function ImmersionGate({
  text,
  requiredPlays = 3,
  children,
}: {
  text: string;
  requiredPlays?: number;
  children: React.ReactNode;
}) {
  const [plays, setPlays] = React.useState(0);
  const [forced, setForced] = React.useState(false);
  const unlocked = plays >= requiredPlays || forced;

  return (
    <div className="space-y-4">
      <AudioPlayer
        text={text}
        mode="dialogue"
        label={
          unlocked
            ? "Diálogo completo"
            : `Escuta ${Math.min(plays + 1, requiredPlays)} de ${requiredPlays}`
        }
        onPlayCountChange={setPlays}
      />

      {unlocked ? (
        <div className="animate-in-up space-y-4">{children}</div>
      ) : (
        <div className="border-border/70 rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm font-medium">O texto aparece depois de {requiredPlays} escutas</p>
          <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-xs leading-relaxed">
            Ouvir antes de ler não é firula: se você lê primeiro, seu cérebro cola a pronúncia do
            português nas letras — e depois é bem mais trabalhoso desfazer.
          </p>
          <div className="text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
            {Array.from({ length: requiredPlays }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "size-2 rounded-full transition-colors",
                  i < plays ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setForced(true)}
            className="text-muted-foreground/70 hover:text-foreground mt-4 text-xs underline underline-offset-4"
          >
            Mostrar o texto agora
          </button>
        </div>
      )}
    </div>
  );
}
