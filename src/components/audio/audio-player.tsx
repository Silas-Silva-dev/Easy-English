"use client";

import { AlertTriangle, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { audioSrc } from "@/lib/audio-id";
import {
  cancelSpeech,
  isSpeechSupported,
  parseScript,
  primeVoices,
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

/** Segundos em m:ss. Faixa nenhuma do curso passa de uma hora. */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

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
  // O contador tambem vive num ref: avisar o pai (o portao de escuta) de dentro
  // do updater do setState conta escuta dobrada em StrictMode.
  const playsRef = React.useRef(0);
  const [lineIndex, setLineIndex] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [supported, setSupported] = React.useState(true);

  const lines: SpeakLine[] = React.useMemo(
    () => (mode === "dialogue" ? parseScript(text) : [{ text }]),
    [text, mode],
  );

  /**
   * Áudio pré-gerado, quando existir.
   *
   * `scripts/generate-audio.ts` grava os diálogos e blocos em `public/audio/`
   * com voz neural — fala conectada de verdade, que a voz do sistema
   * operacional não produz. Enquanto o lote não termina, cada arquivo que já
   * existe passa a ser usado e o resto continua na voz do navegador, sem o
   * aluno perceber a transição.
   */
  const src = React.useMemo(() => audioSrc(text), [text]);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [hasFile, setHasFile] = React.useState(false);
  /** 0 a 1. Vale para os dois caminhos — tempo no arquivo, fala na síntese. */
  const [progress, setProgress] = React.useState(0);
  /** Segundos. Zero quando não há arquivo: a síntese não sabe a duração. */
  const [duration, setDuration] = React.useState(0);

  // As vozes precisam estar em cache ANTES do clique: no Safari e no Chrome do
  // celular, o play só produz som se `speak()` for chamado dentro do gesto,
  // sem espera pelo meio. Ver `primeVoices` em @/lib/speech.
  React.useEffect(() => {
    setSupported(isSpeechSupported());
    primeVoices();
  }, []);

  // Sair da página no meio de uma fala deixaria a voz tocando sozinha.
  React.useEffect(() => cancelSpeech, []);

  /**
   * Sonda o arquivo na montagem, não no clique: assim, quando o aluno aperta o
   * play, já sabemos qual caminho tomar e o `play()` sai dentro do gesto —
   * exigência do Safari, a mesma que `@/lib/speech` documenta.
   */
  React.useEffect(() => {
    setHasFile(false);
    setProgress(0);
    setDuration(0);
    if (!src) return;

    const audio = new Audio();
    audio.preload = "metadata";

    const found = () => {
      setHasFile(true);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const missing = () => setHasFile(false);
    // O progresso é escutado aqui, e não em `play()`: assim a barra também
    // acompanha quando o aluno arrasta com o áudio pausado.
    const tick = () => setProgress(audio.duration ? audio.currentTime / audio.duration : 0);

    audio.addEventListener("loadedmetadata", found);
    audio.addEventListener("error", missing);
    audio.addEventListener("timeupdate", tick);
    audio.addEventListener("seeked", tick);
    audio.src = src;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", found);
      audio.removeEventListener("error", missing);
      audio.removeEventListener("timeupdate", tick);
      audio.removeEventListener("seeked", tick);
      audioRef.current = null;
    };
  }, [src]);

  React.useEffect(() => {
    cancelSpeech();
    audioRef.current?.pause();
    setPlaying(false);
    setLineIndex(0);
    setProgress(0);
  }, [text]);

  /**
   * Fala a partir de uma linha, no ritmo pedido.
   *
   * A síntese do navegador não tem linha do tempo: não dá para buscar o
   * segundo 12. A fala é a menor unidade que dá para retomar, e é ela que
   * sustenta tanto o "voltar um trecho" quanto a troca de velocidade sem
   * perder o lugar.
   */
  const speakFrom = React.useCallback(
    (index: number, rate = speed) => {
      speakLines(lines, {
        rate,
        startAt: index,
        onLine: (i, total) => {
          setLineIndex(i);
          setProgress(total ? (i + 1) / total : 0);
        },
        onEnd: () => {
          setLineIndex(0);
          setProgress(0);
          setPlaying(false);
          onEnded?.();
        },
        onError: (message) => {
          setError(message);
          setPlaying(false);
        },
      });
    },
    [lines, speed, onEnded],
  );

  /**
   * Prepara o elemento e toca. Usado por `play` e por `restart`, para o
   * `onended` nunca ficar sem dono — sem ele o áudio acaba e o botão fica
   * preso em "pausar" para sempre.
   */
  const playFile = React.useCallback(
    (audio: HTMLAudioElement, resumeLine: number) => {
      audio.playbackRate = speed;
      audio.loop = loop;
      audio.onended = () => {
        // Rebobina para o próximo play, mas só DEPOIS de ter tocado inteiro —
        // é isso que separa "acabou" de "pausei".
        audio.currentTime = 0;
        setProgress(0);
        setPlaying(false);
        onEnded?.();
      };
      void audio.play().catch(() => {
        setHasFile(false);
        speakFrom(resumeLine);
      });
    },
    [speed, loop, onEnded, speakFrom],
  );

  /** Toca de onde parou. NÃO rebobina — quem rebobina é `restart`. */
  const play = React.useCallback(() => {
    setError(null);
    setPlaying(true);

    const audio = audioRef.current;
    if (hasFile && audio) {
      playFile(audio, lineIndex);
      return;
    }

    speakFrom(lineIndex);
  }, [hasFile, lineIndex, playFile, speakFrom]);

  /** Uma escuta a mais. Só conta quando começa do zero, nunca ao retomar. */
  function countListen() {
    const next = playsRef.current + 1;
    playsRef.current = next;
    setPlays(next);
    onPlayCountChange?.(next);
  }

  function pause() {
    setPlaying(false);
    const audio = audioRef.current;
    if (hasFile && audio) {
      // `pause()` puro: a posição fica onde está e o próximo play continua dali.
      audio.pause();
      return;
    }
    // Na voz do navegador, `speechSynthesis.pause()` é irregular entre
    // navegadores. Paramos e guardamos a LINHA — retomar refala a partir dela,
    // que é previsível em todo lugar.
    cancelSpeech();
  }

  function toggle() {
    if (playing) {
      pause();
      return;
    }
    if (progress === 0) countListen();
    play();
  }

  function restart() {
    cancelSpeech();
    const audio = audioRef.current;
    if (audio) audio.currentTime = 0;
    setLineIndex(0);
    setProgress(0);
    countListen();
    // O estado de `lineIndex` só chega no próximo render; `play` ainda leria o
    // valor antigo. Por isso o caminho da voz do navegador é chamado direto.
    setError(null);
    setPlaying(true);
    if (hasFile && audio) playFile(audio, 0);
    else speakFrom(0);
  }

  /** Vai para um ponto da faixa. `fraction` é 0 a 1. */
  function seek(fraction: number) {
    const f = Math.min(Math.max(fraction, 0), 1);
    const audio = audioRef.current;

    if (hasFile && audio) {
      if (audio.duration) audio.currentTime = f * audio.duration;
      setProgress(f);
      return;
    }

    // Sem arquivo, o alvo é a fala mais próxima.
    if (!lines.length) return;
    const line = Math.min(lines.length - 1, Math.floor(f * lines.length));
    setLineIndex(line);
    setProgress((line + 1) / lines.length);
    if (playing) speakFrom(line);
  }

  function changeSpeed(next: number) {
    setSpeed(next);

    const audio = audioRef.current;
    if (hasFile && audio) {
      // Com arquivo a velocidade muda AO VIVO, tocando ou pausado — que é o
      // ponto do dia 12 (escuta acelerada): ouvir o efeito na mesma passagem.
      audio.playbackRate = next;
      return;
    }

    // Na voz do navegador a fala em curso já foi enfileirada no ritmo antigo.
    // Refalamos da MESMA linha no ritmo novo, em vez de largar o aluno parado.
    if (playing) speakFrom(lineIndex, next);
  }

  const progressPct = progress * 100;
  const elapsed = duration ? duration * progress : 0;

  // Só é "indisponível" quando não há NEM arquivo NEM síntese: com o áudio
  // pré-gerado a lição funciona até em navegador sem Web Speech.
  if (!supported && !hasFile) {
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
          aria-label={playing ? "Pausar" : progress > 0 ? "Continuar" : "Ouvir"}
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

          {/* Barra clicável e arrastável. É um `input range` de verdade, e não
              uma div pintada, para funcionar também no teclado (setas) e para
              o leitor de tela anunciar a posição. O preenchimento vem de um
              gradiente sobre a própria trilha — ver `.seek` em globals.css. */}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={1000}
              step={1}
              value={Math.round(progressPct * 10)}
              onChange={(e) => seek(Number(e.target.value) / 1000)}
              aria-label="Posição na faixa"
              aria-valuetext={
                duration
                  ? `${formatTime(elapsed)} de ${formatTime(duration)}`
                  : `${Math.round(progressPct)}%`
              }
              className="seek min-w-0 flex-1"
              style={{ "--seek": `${progressPct}%` } as React.CSSProperties}
            />
            {duration ? (
              <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                {formatTime(elapsed)} / {formatTime(duration)}
              </span>
            ) : null}
          </div>
        </div>

        {plays > 0 || progress > 0 ? (
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
