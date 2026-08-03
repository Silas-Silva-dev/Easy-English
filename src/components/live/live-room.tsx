"use client";

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { AlertCircle, Loader2, Mic, MicOff, PhoneOff, Radio } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { saveLiveSessionAction } from "@/app/app/ao-vivo/actions";

/** O Live API recebe PCM 16-bit a 16 kHz e devolve PCM 16-bit a 24 kHz. */
const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;

/**
 * Worklet de captura: converte Float32 do microfone em PCM 16-bit e envia
 * ao thread principal em blocos de ~64 ms.
 *
 * Vai como blob para não precisar de arquivo estático servido separadamente.
 */
const CAPTURE_WORKLET = `
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = [];
    this._size = 0;
    this._target = 1024;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channel = input[0];
    const pcm = new Int16Array(channel.length);
    let peak = 0;
    for (let i = 0; i < channel.length; i++) {
      const s = Math.max(-1, Math.min(1, channel[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      const a = Math.abs(s);
      if (a > peak) peak = a;
    }
    this._buf.push(pcm);
    this._size += pcm.length;
    if (this._size >= this._target) {
      const merged = new Int16Array(this._size);
      let offset = 0;
      for (const part of this._buf) { merged.set(part, offset); offset += part.length; }
      this.port.postMessage({ pcm: merged.buffer, peak }, [merged.buffer]);
      this._buf = [];
      this._size = 0;
    }
    return true;
  }
}
registerProcessor('capture-processor', CaptureProcessor);
`;

type Phase = "idle" | "connecting" | "live" | "closing";

interface Turn {
  role: "user" | "model";
  text: string;
  at: number;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function fromBase64(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export function LiveRoom({
  lessonId,
  scenario,
  circuitNumber,
  title,
}: {
  lessonId?: string;
  scenario?: string;
  circuitNumber?: number;
  title?: string;
}) {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [muted, setMuted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [seconds, setSeconds] = React.useState(0);
  const [level, setLevel] = React.useState(0);
  const [speaking, setSpeaking] = React.useState(false);

  const sessionRef = React.useRef<Session | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const inCtxRef = React.useRef<AudioContext | null>(null);
  const outCtxRef = React.useRef<AudioContext | null>(null);
  const workletUrlRef = React.useRef<string | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const mutedRef = React.useRef(false);
  const playHeadRef = React.useRef(0);
  const startedAtRef = React.useRef(0);

  // Buffers de transcrição parcial — o Live API manda em pedaços.
  const partialUserRef = React.useRef("");
  const partialModelRef = React.useRef("");

  React.useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const cleanup = React.useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void inCtxRef.current?.close().catch(() => {});
    void outCtxRef.current?.close().catch(() => {});
    inCtxRef.current = null;
    outCtxRef.current = null;
    if (workletUrlRef.current) URL.revokeObjectURL(workletUrlRef.current);
    workletUrlRef.current = null;
    playHeadRef.current = 0;
    setLevel(0);
    setSpeaking(false);
  }, []);

  React.useEffect(() => cleanup, [cleanup]);

  /** Enfileira o áudio recebido para tocar sem sobreposição nem lacuna. */
  const enqueueAudio = React.useCallback((pcm: Int16Array) => {
    const ctx = outCtxRef.current;
    if (!ctx) return;

    const float = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) float[i] = pcm[i] / 32768;

    const buffer = ctx.createBuffer(1, float.length, OUTPUT_RATE);
    buffer.copyToChannel(float, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, playHeadRef.current);
    source.start(startAt);
    playHeadRef.current = startAt + buffer.duration;

    setSpeaking(true);
    source.onended = () => {
      if (ctx.currentTime >= playHeadRef.current - 0.05) setSpeaking(false);
    };
  }, []);

  const handleMessage = React.useCallback(
    (message: LiveServerMessage) => {
      const content = message.serverContent;
      if (!content) return;

      // Áudio da tutora
      for (const part of content.modelTurn?.parts ?? []) {
        const data = part.inlineData?.data;
        if (data) enqueueAudio(fromBase64(data));
      }

      // Transcrições (chegam fatiadas)
      const inputText = content.inputTranscription?.text;
      if (inputText) partialUserRef.current += inputText;

      const outputText = content.outputTranscription?.text;
      if (outputText) partialModelRef.current += outputText;

      if (content.turnComplete) {
        const user = partialUserRef.current.trim();
        const model = partialModelRef.current.trim();
        partialUserRef.current = "";
        partialModelRef.current = "";

        setTurns((prev) => {
          const next = [...prev];
          if (user) next.push({ role: "user", text: user, at: Date.now() });
          if (model) next.push({ role: "model", text: model, at: Date.now() });
          return next;
        });
      }

      if (content.interrupted) {
        // O aluno falou por cima: descarta o que estava na fila.
        playHeadRef.current = outCtxRef.current?.currentTime ?? 0;
        setSpeaking(false);
      }
    },
    [enqueueAudio],
  );

  async function start() {
    setError(null);
    setPhase("connecting");
    setTurns([]);
    setSeconds(0);

    try {
      // 1. Token efêmero — a chave real nunca chega ao browser.
      const tokenResponse = await fetch("/api/live/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, scenario }),
      });
      const tokenPayload = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenPayload?.error ?? "Falha ao obter acesso");

      // 2. Microfone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      // 3. Contextos de áudio
      const inCtx = new AudioContext({ sampleRate: INPUT_RATE });
      const outCtx = new AudioContext({ sampleRate: OUTPUT_RATE });
      inCtxRef.current = inCtx;
      outCtxRef.current = outCtx;
      await outCtx.resume();

      const blob = new Blob([CAPTURE_WORKLET], { type: "application/javascript" });
      const workletUrl = URL.createObjectURL(blob);
      workletUrlRef.current = workletUrl;
      await inCtx.audioWorklet.addModule(workletUrl);

      // 4. Sessão ao vivo
      const ai = new GoogleGenAI({
        apiKey: tokenPayload.token,
        httpOptions: { apiVersion: "v1alpha" },
      });

      const session = await ai.live.connect({
        model: tokenPayload.model,
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onopen: () => setPhase("live"),
          onmessage: handleMessage,
          onerror: (event: ErrorEvent) => {
            setError(event.message || "Erro na conexão de voz");
            void stop();
          },
          onclose: () => {
            setPhase((p) => (p === "closing" ? p : "idle"));
            cleanup();
          },
        },
      });
      sessionRef.current = session;

      // 5. Microfone -> sessão
      const source = inCtx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(inCtx, "capture-processor");

      node.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; peak: number }>) => {
        setLevel(Math.min(1, event.data.peak * 2.2));
        if (mutedRef.current) return;
        try {
          sessionRef.current?.sendRealtimeInput({
            audio: {
              data: toBase64(event.data.pcm),
              mimeType: `audio/pcm;rate=${INPUT_RATE}`,
            },
          });
        } catch {
          // A sessão pode fechar entre dois blocos — ignorar.
        }
      };

      source.connect(node);
      // Destino mudo: mantém o grafo ativo sem devolver o próprio áudio.
      const sink = inCtx.createGain();
      sink.gain.value = 0;
      node.connect(sink).connect(inCtx.destination);

      startedAtRef.current = Date.now();
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      const message =
        name === "NotAllowedError"
          ? "Permissão de microfone negada. Autorize o acesso e tente de novo."
          : name === "NotFoundError"
            ? "Nenhum microfone encontrado."
            : err instanceof Error
              ? err.message
              : "Não foi possível iniciar a conversa";
      setError(message);
      setPhase("idle");
      cleanup();
    }
  }

  async function stop() {
    setPhase("closing");
    const duration = Math.round((Date.now() - startedAtRef.current) / 1000);

    try {
      sessionRef.current?.close();
    } catch {
      // já fechada
    }
    sessionRef.current = null;
    cleanup();

    const finalTurns = turns;
    if (finalTurns.length >= 2) {
      const result = await saveLiveSessionAction({
        lessonId: lessonId ?? null,
        circuitNumber: circuitNumber ?? null,
        scenario: scenario ?? null,
        durationSeconds: duration,
        transcript: finalTurns,
      });

      if (result.ok) toast.success("Conversa salva. A tutora avaliou seu desempenho.");
      else toast.error(result.error ?? "Não foi possível salvar a conversa");
    }

    setPhase("idle");
  }

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      {error ? (
        <p className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="bg-card overflow-hidden rounded-xl border">
        <div className="from-primary/10 bg-gradient-to-b to-transparent px-6 py-10 text-center">
          <div
            className={cn(
              "mx-auto grid size-24 place-items-center rounded-full transition-all duration-200",
              phase === "live"
                ? speaking
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground",
            )}
            style={
              phase === "live" && !speaking
                ? { transform: `scale(${1 + level * 0.18})` }
                : undefined
            }
          >
            {phase === "connecting" ? (
              <Loader2 className="size-9 animate-spin" />
            ) : phase === "live" ? (
              <Radio className="size-9" />
            ) : (
              <Mic className="size-9" />
            )}
          </div>

          <div className="mt-5">
            {phase === "live" ? (
              <>
                <p className="text-2xl font-semibold tabular-nums">{mmss}</p>
                <Badge variant={speaking ? "default" : "neutral"} className="mt-2">
                  {speaking ? "Emma está falando" : "Sua vez — fale"}
                </Badge>
              </>
            ) : phase === "connecting" ? (
              <p className="text-sm font-medium">Abrindo a sala…</p>
            ) : (
              <>
                <p className="font-medium">{title ?? "Conversa ao vivo"}</p>
                <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-xs leading-relaxed">
                  Voz em tempo real, sem roteiro e sem pausa para pensar. É o treino que mais se
                  parece com falar com um americano de verdade.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Empilha no celular: os dois botões somam mais que 320px e o pai é
            overflow-hidden — "Encerrar" saía decepado, sem rolagem que o
            recuperasse. */}
        <div className="flex flex-col items-stretch justify-center gap-3 border-t p-4 sm:flex-row sm:items-center sm:p-5">
          {phase === "idle" ? (
            <Button size="lg" variant="gradient" onClick={start}>
              <Mic className="size-4" /> Iniciar conversa
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                variant={muted ? "destructive" : "outline"}
                onClick={() => setMuted((m) => !m)}
                disabled={phase !== "live"}
              >
                {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                {muted ? "Microfone mudo" : "Mudo"}
              </Button>
              <Button size="lg" variant="destructive" onClick={stop} loading={phase === "closing"}>
                <PhoneOff className="size-4" /> Encerrar
              </Button>
            </>
          )}
        </div>
      </div>

      {turns.length ? (
        <div className="bg-card rounded-xl border p-5">
          <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
            Transcrição
          </p>
          <div className="max-h-80 space-y-2.5 overflow-y-auto">
            {turns.map((turn, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg px-4 py-2.5 text-sm",
                  turn.role === "user"
                    ? "bg-primary/8 border-primary/20 ml-8 border"
                    : "bg-muted mr-8",
                )}
              >
                <span className="text-muted-foreground mb-0.5 block text-[10px] font-medium tracking-wide uppercase">
                  {turn.role === "user" ? "Você" : "Emma"}
                </span>
                {turn.text}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
