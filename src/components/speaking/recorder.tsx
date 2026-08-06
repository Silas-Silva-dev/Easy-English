"use client";

import { AlertCircle, Loader2, Mic, RotateCcw, Send, Square } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { SpeakingResult } from "./feedback-panel";

const MAX_SECONDS = 180;

type Phase = "idle" | "recording" | "recorded" | "analyzing";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Mensagem útil quando o servidor NÃO devolveu JSON (HTML de proxy, 413 do
 * edge, 504 da plataforma). Sem isso o aluno via "Unexpected token '<'".
 */
function httpErrorMessage(status: number): string {
  if (status === 401) return "Sua sessão expirou. Entre novamente para enviar a gravação.";
  if (status === 402 || status === 403) return "Seu acesso não está liberado para a correção de fala.";
  if (status === 413) return "Áudio muito longo. Grave no máximo 5 minutos.";
  if (status === 429) return "A tutora está sobrecarregada agora. Tente de novo em alguns instantes.";
  if (status >= 500) return "A tutora não respondeu desta vez. Seu áudio continua aqui: toque em Enviar para correção.";
  return "Não foi possível enviar seu áudio. Tente novamente.";
}

/** Escolhe o melhor container suportado pelo navegador atual. */
function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function SpeakingRecorder({
  prompt,
  lessonId,
  onResult,
  className,
}: {
  prompt: string;
  lessonId?: string;
  onResult: (result: SpeakingResult) => void;
  className?: string;
}) {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [seconds, setSeconds] = React.useState(0);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [level, setLevel] = React.useState(0);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const blobRef = React.useRef<Blob | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const startedAtRef = React.useRef(0);
  // `onstop` é criado uma única vez, no render em que a gravação começou: ler
  // `seconds` de dentro dele devolvia sempre 0 e a duração chegava zerada ao
  // banco. A duração fechada no stop vive numa ref, imune a closure obsoleta.
  const durationRef = React.useRef(0);
  // `audioUrl` também é lido por closures antigos (o `onstop` e o cleanup de
  // unmount, ambos com deps vazias): só um ref revoga a URL certa e evita
  // segurar o blob na memória depois de trocar de gravação.
  const audioUrlRef = React.useRef<string | null>(null);

  const setAudio = React.useCallback((url: string | null) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = url;
    setAudioUrl(url);
  }, []);

  const cleanup = React.useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    timerRef.current = null;
    rafRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  React.useEffect(() => {
    return () => {
      cleanup();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Seu navegador não suporta gravação de áudio. Use Chrome, Edge, Firefox ou Safari atualizado.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      // Medidor de volume: feedback visual de que o microfone está captando.
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += (v - 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / data.length) / 40));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        durationRef.current = Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000),
        );
        setSeconds(durationRef.current);

        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        blobRef.current = blob;
        setAudio(URL.createObjectURL(blob));
        cleanup();
        void submitBlob(blob);
      };

      recorder.start(250);
      startedAtRef.current = Date.now();
      durationRef.current = 0;
      setSeconds(0);
      setPhase("recording");

      // Relógio de parede: o setInterval sozinho atrasa quando a aba perde foco,
      // e a duração exibida deixaria de bater com a enviada.
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setSeconds(elapsed);
        // O timer só é limpo no `cleanup()` de dentro do `onstop`: sem checar o
        // estado, o tique seguinte chamaria `stop()` num recorder já inativo
        // (InvalidStateError) e repetiria o toast.
        if (elapsed >= MAX_SECONDS && recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
          toast.info("Tempo máximo de gravação atingido (3 minutos).");
        }
      }, 1000);
    } catch (err) {
      cleanup();
      const name = err instanceof Error ? err.name : "";
      setError(
        name === "NotAllowedError"
          ? "Permissão de microfone negada. Autorize o acesso nas configurações do navegador e tente de novo."
          : name === "NotFoundError"
            ? "Nenhum microfone encontrado. Conecte um dispositivo de áudio."
            : "Não foi possível acessar o microfone.",
      );
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function reset() {
    blobRef.current = null;
    durationRef.current = 0;
    setAudio(null);
    setSeconds(0);
    setError(null);
    setPhase("idle");
  }

  async function submitBlob(blobToSubmit?: Blob) {
    const blob = blobToSubmit ?? blobRef.current;
    if (!blob) return;

    setPhase("analyzing");
    setError(null);

    const formData = new FormData();
    const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    formData.append("audio", blob, `pratica.${extension}`);
    formData.append("prompt", prompt);
    formData.append("duration", String(durationRef.current));
    if (lessonId) formData.append("lessonId", lessonId);

    try {
      const response = await fetch("/api/speaking/analyze", { method: "POST", body: formData });

      // Lê como texto antes de parsear: chamar `.json()` sem checar `ok` virava
      // SyntaxError em toda resposta não-JSON (HTML de proxy, 504 da
      // plataforma) e apagava o status real, que é o que permite diagnosticar.
      const rawBody = await response.text();
      let payload: (SpeakingResult & { error?: string }) | null = null;
      try {
        payload = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        console.error("[speaking] envio falhou", response.status, rawBody.slice(0, 300));
        throw new Error(payload?.error ?? httpErrorMessage(response.status));
      }
      if (!payload) throw new Error(httpErrorMessage(response.status));

      if (payload.audible === false) {
        // Vai para "recorded", não "idle": o aluno precisa ouvir justamente a
        // gravação que o sistema disse não ter entendido para descobrir o
        // problema do microfone. Em "idle" o blob seguia vivo em memória mas
        // sumia da tela.
        setError(
          "Não consegui ouvir sua voz nesta gravação. Ouça o áudio abaixo, verifique o microfone e grave de novo.",
        );
        toast.warning("Não consegui ouvir sua voz. Verifique o microfone e grave novamente.");
        setPhase("recorded");
        return;
      } else if (payload.languageDetected === "pt") {
        toast.warning("Você falou em português. Tente responder em inglês: mesmo com erros.");
      } else {
        toast.success("Correção da tutora pronta!");
      }

      onResult(payload);
      reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      setError(message);
      toast.error(message);
      setPhase("recorded");
    }
  }

  return (
    <div className={cn("space-y-5", className)}>
      {error ? (
        <p className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="bg-muted/40 flex flex-col items-center gap-5 rounded-xl border border-dashed px-6 py-9">
        {/* ------------------------------------------------- Botão principal */}
        {phase === "idle" ? (
          <>
            <Button
              type="button"
              size="icon"
              onClick={startRecording}
              className="size-20 rounded-full shadow-lg"
              aria-label="Iniciar gravação"
            >
              <Mic className="size-8" />
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              Toque para gravar sua resposta em inglês
              <br />
              <span className="text-xs">Até 3 minutos · o áudio fica privado na sua conta</span>
            </p>
          </>
        ) : null}

        {phase === "recording" ? (
          <>
            <button
              type="button"
              onClick={stopRecording}
              className="bg-destructive text-destructive-foreground animate-pulse-ring grid size-20 place-items-center rounded-full shadow-lg transition-transform hover:scale-105"
              style={{ transform: `scale(${1 + level * 0.12})` }}
              aria-label="Parar gravação"
            >
              <Square className="size-7 fill-current" />
            </button>

            <div className="flex flex-col items-center gap-2">
              <span className="text-2xl font-semibold tabular-nums">{formatTime(seconds)}</span>
              <div className="flex h-6 items-end gap-1" aria-hidden>
                {Array.from({ length: 13 }, (_, i) => {
                  const distance = Math.abs(i - 6) / 6;
                  const height = 4 + level * 22 * (1 - distance * 0.65);
                  return (
                    <span
                      key={i}
                      className="bg-destructive w-1 rounded-full transition-[height] duration-75"
                      style={{ height: `${Math.max(4, height)}px` }}
                    />
                  );
                })}
              </div>
              <p className="text-muted-foreground text-xs">Gravando… toque no quadrado para parar</p>
            </div>
          </>
        ) : null}

        {phase === "recorded" && audioUrl ? (
          <div className="w-full max-w-md space-y-4">
            <p className="text-center text-sm font-medium">
              Gravação de {formatTime(seconds)} pronta
            </p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={audioUrl} controls className="w-full" />
            {/* "Regravar" + "Enviar para correção" só cabem lado a lado a
                partir de ~440px; abaixo disso vazavam para fora do card. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button type="button" variant="outline" onClick={reset}>
                <RotateCcw className="size-4" /> Regravar
              </Button>
              <Button type="button" variant="gradient" onClick={() => submitBlob()}>
                <Send className="size-4" /> Enviar para correção
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "analyzing" ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="text-primary size-9 animate-spin" />
            <p className="text-sm font-medium">A tutora está ouvindo sua gravação…</p>
            <p className="text-muted-foreground max-w-xs text-center text-xs">
              Transcrevendo, comparando com a pronúncia alvo e preparando as correções. Costuma levar
              de 10 a 30 segundos.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
