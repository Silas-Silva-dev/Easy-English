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
 * O servidor encerra a sessão sozinho por volta dos 10 minutos: manda `goAway`
 * avisando quantos segundos restam e, se o cliente não reabrir a conexão,
 * derruba com "client failed to close the connection after receiving a GoAway
 * signal". A mesma queda acontece por inatividade quando o aluno fica mudo por
 * ~3 minutos, aí sem aviso nenhum.
 *
 * Antes disto a aula simplesmente acabava: o `onclose` voltava a tela para
 * "idle" em silêncio, e o aluno achava que tinha travado. Agora abrimos a
 * conexão nova ANTES de fechar a velha (make-before-break) e retomamos o
 * contexto pelo handle de `sessionResumption`, de modo que a Emma continua a
 * conversa de onde parou.
 */
const MAX_RECONEXOES = 4;
const BACKOFF_RECONEXAO_MS = 800;

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

/**
 * Como a Emma se comporta: professora que corrige, ou parceira de conversa.
 *
 * O aluno troca de dois jeitos, e os dois precisam funcionar. Por voz, no meio
 * da frase — que é o pedido natural ("vamos só conversar agora") e quem entende
 * é a própria Emma. E por este botão, que existe porque um modo invisível é um
 * modo que ninguém sabe que pode desligar.
 */
type Modo = "professora" | "conversa";

const MODO_PADRAO: Modo = "professora";
const CHAVE_MODO = "easy-english:live-modo";

/** Preferência do aluno entre sessões. Storage bloqueado nunca derruba a sala. */
function lerModoSalvo(): Modo {
  try {
    const salvo = localStorage.getItem(CHAVE_MODO);
    return salvo === "conversa" || salvo === "professora" ? salvo : MODO_PADRAO;
  } catch {
    return MODO_PADRAO;
  }
}

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
  const [modo, setModo] = React.useState<Modo>(MODO_PADRAO);
  /**
   * O modo também numa ref porque `abrirSessao` é usada pela reconexão, que
   * roda a partir de callbacks presos ao render em que a conexão abriu. Ler o
   * estado ali devolveria o modo do começo da conversa.
   */
  const modoRef = React.useRef<Modo>(MODO_PADRAO);

  // Na montagem, não no `useState`: o servidor renderiza esta tela antes de
  // existir `localStorage`, e divergir do HTML entregue quebra a hidratação.
  React.useEffect(() => {
    const salvo = lerModoSalvo();
    modoRef.current = salvo;
    setModo(salvo);
  }, []);

  const sessionRef = React.useRef<Session | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const inCtxRef = React.useRef<AudioContext | null>(null);
  const outCtxRef = React.useRef<AudioContext | null>(null);
  const workletUrlRef = React.useRef<string | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const mutedRef = React.useRef(false);
  const playHeadRef = React.useRef(0);
  const startedAtRef = React.useRef(0);

  // Buffers de transcrição parcial: o Live API manda em pedaços.
  const partialUserRef = React.useRef("");
  const partialModelRef = React.useRef("");

  // ------------------------------------------------------------- reconexão
  const [reconectando, setReconectando] = React.useState(false);
  /** Handle devolvido pelo servidor para retomar o contexto da conversa. */
  const resumeHandleRef = React.useRef<string | null>(null);
  /** Só a sessão "ativa" processa callbacks: a antiga vira inerte na troca. */
  const activeIdRef = React.useRef(0);
  const idCounterRef = React.useRef(0);
  const reconectandoRef = React.useRef(false);
  const tentativasRef = React.useRef(0);
  /** O aluno pediu para encerrar: uma queda aqui não deve reconectar. */
  const encerrandoRef = React.useRef(false);
  /**
   * `stop()` é recriada a cada render, mas os callbacks da sessão guardam a
   * versão do render em que a conexão abriu. Sem espelhar em ref, o `turns`
   * lido no encerramento seria sempre o do início (vazio) e a conversa não
   * chegaria a ser salva.
   */
  const turnsRef = React.useRef<Turn[]>([]);
  /** Quebram o ciclo: `handleMessage` precisa reconectar, e reconectar usa `handleMessage`. */
  const reconectarRef = React.useRef<((motivo: string) => Promise<void>) | null>(null);
  const quedaRef = React.useRef<((motivo: string) => Promise<void>) | null>(null);
  const stopRef = React.useRef<(() => Promise<void>) | null>(null);

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

  React.useEffect(() => {
    return () => {
      // O aluno saiu da tela: encerra de vez. Sem marcar o encerramento, o
      // `onclose` da sessão entenderia isso como queda e tentaria reconectar
      // um componente que já não existe.
      encerrandoRef.current = true;
      activeIdRef.current = 0;
      try {
        sessionRef.current?.close();
      } catch {
        // já fechada
      }
      sessionRef.current = null;
      cleanup();
    };
  }, [cleanup]);

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

  /** Fecha os parciais pendentes como um turno, para não perder fala na troca. */
  const flushParciais = React.useCallback(() => {
    const user = partialUserRef.current.trim();
    const model = partialModelRef.current.trim();
    partialUserRef.current = "";
    partialModelRef.current = "";
    if (!user && !model) return;

    setTurns((prev) => {
      const next = [...prev];
      if (user) next.push({ role: "user", text: user, at: Date.now() });
      if (model) next.push({ role: "model", text: model, at: Date.now() });
      turnsRef.current = next;
      return next;
    });
  }, []);

  const handleMessage = React.useCallback(
    (message: LiveServerMessage) => {
      // Guardar o handle mais recente é o que permite retomar o contexto: sem
      // ele a reconexão abriria uma conversa em branco e a Emma "esqueceria"
      // tudo o que o aluno acabou de dizer.
      const resumo = message.sessionResumptionUpdate;
      if (resumo?.resumable && resumo.newHandle) {
        resumeHandleRef.current = resumo.newHandle;
      }

      // Aviso de que o servidor vai encerrar. Temos alguns segundos: usa-os
      // para abrir a próxima conexão antes que esta caia.
      if (message.goAway) {
        void reconectarRef.current?.("goAway");
      }

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

      if (content.turnComplete) flushParciais();

      if (content.interrupted) {
        // O aluno falou por cima: descarta o que estava na fila.
        playHeadRef.current = outCtxRef.current?.currentTime ?? 0;
        setSpeaking(false);
      }
    },
    [enqueueAudio, flushParciais],
  );

  /**
   * Abre uma sessão. O token efêmero é de uso único, então toda reconexão pede
   * um novo ao servidor — é uma chamada à nossa própria API, e o aviso de
   * `goAway` dá folga de sobra para fazer isso antes da queda.
   */
  const abrirSessao = React.useCallback(
    async (handle: string | null): Promise<Session> => {
      // O handle vai para o SERVIDOR, não para o `connect` abaixo: com token
      // efêmero é a config das `liveConnectConstraints` que vale, e um handle
      // enviado só daqui é silenciosamente ignorado.
      const tokenResponse = await fetch("/api/live/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // O modo vai em toda abertura, inclusive nas reconexões: a instrução de
        // sistema é montada no servidor, e sem ele a troca de conexão dos 10
        // minutos devolveria a Emma ao padrão no meio da conversa.
        body: JSON.stringify({ lessonId, scenario, resumeHandle: handle, mode: modoRef.current }),
      });
      const tokenPayload = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenPayload?.error ?? "Falha ao obter acesso");

      const ai = new GoogleGenAI({
        apiKey: tokenPayload.token,
        httpOptions: { apiVersion: "v1alpha" },
      });

      const id = ++idCounterRef.current;

      return ai.live.connect({
        model: tokenPayload.model,
        config: {
          responseModalities: [Modality.AUDIO],
          // Pedir resumption já na primeira sessão: é assim que o servidor
          // passa a emitir os handles que a próxima conexão vai usar. O handle
          // em si já foi aplicado no token, acima.
          sessionResumption: {},
        },
        callbacks: {
          onopen: () => {
            // A partir daqui esta é a sessão ativa; a anterior fica inerte.
            activeIdRef.current = id;
            setPhase("live");
          },
          onmessage: (message: LiveServerMessage) => {
            if (id !== activeIdRef.current) return;
            handleMessage(message);
          },
          onerror: (event: ErrorEvent) => {
            if (id !== activeIdRef.current) return;
            void quedaRef.current?.(event.message || "erro na conexão de voz");
          },
          onclose: () => {
            if (id !== activeIdRef.current) return;
            void quedaRef.current?.("conexão encerrada pelo servidor");
          },
        },
      });
    },
    [handleMessage, lessonId, scenario],
  );

  /**
   * Troca de conexão sem o aluno perceber: abre a nova, redireciona o
   * microfone (o worklet lê `sessionRef` a cada bloco) e só então fecha a
   * velha. Se a nova falhar, a antiga continua no ar.
   */
  const reconectar = React.useCallback(
    async (motivo: string): Promise<void> => {
      if (reconectandoRef.current || encerrandoRef.current) return;
      if (tentativasRef.current >= MAX_RECONEXOES) return;

      reconectandoRef.current = true;
      tentativasRef.current += 1;
      setReconectando(true);

      const anterior = sessionRef.current;

      try {
        // O que estava sendo dito fica registrado antes da troca.
        flushParciais();

        const nova = await abrirSessao(resumeHandleRef.current);
        sessionRef.current = nova;

        try {
          anterior?.close();
        } catch {
          // já fechada pelo servidor
        }

        tentativasRef.current = 0;
      } catch (error) {
        console.error(`[live] reconexão falhou (${motivo}):`, error);

        if (tentativasRef.current >= MAX_RECONEXOES) {
          setError(
            "A conexão de voz caiu e não voltou. Sua conversa até aqui foi salva: comece de novo quando quiser.",
          );
          reconectandoRef.current = false;
          setReconectando(false);
          await stopRef.current?.();
          return;
        }

        // Nova tentativa com espera crescente.
        const espera = BACKOFF_RECONEXAO_MS * 2 ** (tentativasRef.current - 1);
        reconectandoRef.current = false;
        setTimeout(() => void reconectarRef.current?.(motivo), espera);
        return;
      }

      reconectandoRef.current = false;
      setReconectando(false);
    },
    [abrirSessao, flushParciais],
  );

  /** Queda da sessão ativa: reconecta, a não ser que tenha sido o aluno. */
  const queda = React.useCallback(
    async (motivo: string): Promise<void> => {
      if (encerrandoRef.current) return;
      await reconectar(motivo);
    },
    [reconectar],
  );

  React.useEffect(() => {
    reconectarRef.current = reconectar;
    quedaRef.current = queda;
  }, [reconectar, queda]);

  /**
   * Troca o modo da Emma.
   *
   * Com a sessão no ar a instrução de sistema já foi entregue e não muda mais —
   * então o aviso vai pela conversa, exatamente como iria se o aluno tivesse
   * pedido por voz. É o mesmo caminho que a Emma já sabe atender, e não custa
   * uma reconexão no meio da frase.
   *
   * A ref é atualizada de qualquer jeito: é ela que a próxima abertura de
   * sessão vai ler, inclusive a reconexão automática.
   */
  const trocarModo = React.useCallback((novo: Modo) => {
    if (novo === modoRef.current) return;
    modoRef.current = novo;
    setModo(novo);

    try {
      localStorage.setItem(CHAVE_MODO, novo);
    } catch {
      // Navegação privada bloqueia a escrita: a preferência vale só a sessão.
    }

    const sessao = sessionRef.current;
    if (!sessao) return;

    try {
      sessao.sendClientContent({
        turns:
          novo === "professora"
            ? "Switch to TEACHER mode now: from here on, correct my English and explain the corrections in Portuguese. Confirm in one short sentence and carry on with the conversation."
            : "Switch to CONVERSATION mode now: stop correcting me and just talk with me. Confirm in one short sentence and carry on with the conversation.",
        turnComplete: true,
      });
    } catch (e) {
      // O botão já mudou o que vale na próxima conexão; perder o aviso só
      // atrasa o efeito, não pode derrubar a conversa.
      console.warn("[live] não consegui avisar a troca de modo:", e);
    }
  }, []);

  async function start() {
    setError(null);
    setPhase("connecting");
    setTurns([]);
    turnsRef.current = [];
    setSeconds(0);

    encerrandoRef.current = false;
    reconectandoRef.current = false;
    tentativasRef.current = 0;
    resumeHandleRef.current = null;
    partialUserRef.current = "";
    partialModelRef.current = "";

    try {
      // 1. Microfone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      // 2. Contextos de áudio
      const inCtx = new AudioContext({ sampleRate: INPUT_RATE });
      const outCtx = new AudioContext({ sampleRate: OUTPUT_RATE });
      inCtxRef.current = inCtx;
      outCtxRef.current = outCtx;
      await outCtx.resume();

      const blob = new Blob([CAPTURE_WORKLET], { type: "application/javascript" });
      const workletUrl = URL.createObjectURL(blob);
      workletUrlRef.current = workletUrl;
      await inCtx.audioWorklet.addModule(workletUrl);

      // 3. Sessão ao vivo (o token efêmero é pedido dentro de `abrirSessao`,
      //    para que reconectar use exatamente o mesmo caminho da 1ª conexão).
      sessionRef.current = await abrirSessao(null);

      // 4. Microfone -> sessão
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
          // A sessão pode fechar entre dois blocos: ignorar.
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
    // Sinaliza ANTES de fechar: sem isto o `onclose` da sessão entenderia o
    // encerramento como queda e abriria uma reconexão órfã.
    encerrandoRef.current = true;
    activeIdRef.current = 0;

    setPhase("closing");
    setReconectando(false);
    const duration = Math.round((Date.now() - startedAtRef.current) / 1000);

    try {
      sessionRef.current?.close();
    } catch {
      // já fechada
    }
    sessionRef.current = null;
    flushParciais();
    cleanup();

    // Da ref, não do estado: quando o encerramento parte de um callback da
    // sessão, o `turns` capturado no closure é o do início da conversa.
    const finalTurns = turnsRef.current;
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

  // Em efeito, não no corpo do render: escrever em ref durante a renderização
  // não é seguro sob renderização concorrente.
  React.useEffect(() => {
    stopRef.current = stop;
  });

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
                {reconectando ? (
                  // Discreto de propósito: a conversa não parou, só a conexão
                  // está sendo trocada por baixo.
                  <p className="text-muted-foreground mt-1 flex items-center justify-center gap-1.5 text-xs">
                    <Loader2 className="size-3 animate-spin" />
                    Reconectando… pode continuar falando
                  </p>
                ) : null}
                <Badge variant={speaking ? "default" : "neutral"} className="mt-2">
                  {speaking ? "Emma está falando" : "Sua vez: fale"}
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

        <div className="space-y-4 border-t p-4 sm:p-5">
          {/* Fica visível durante a conversa, e não só antes dela: é no meio da
              fala que o aluno descobre que quer desligar a correção. */}
          <div className="flex flex-col items-center gap-2">
            <div className="border-border flex overflow-hidden rounded-lg border text-xs font-medium">
              {(["professora", "conversa"] as Modo[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => trocarModo(m)}
                  // Enquanto a sala abre, o token com o modo já foi pedido e a
                  // sessão ainda não existe para receber o aviso: a troca cairia
                  // no vazio até a próxima reconexão.
                  disabled={phase === "connecting" || phase === "closing"}
                  className={cn(
                    "px-3.5 py-1.5 transition-colors disabled:opacity-50",
                    modo === m
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                  aria-pressed={modo === m}
                >
                  {m === "professora" ? "Professora" : "Só conversa"}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground max-w-sm text-center text-xs leading-relaxed">
              {modo === "professora"
                ? "A Emma corrige o que você falar e explica em português. Diga “vamos só conversar” quando quiser que ela pare."
                : "A Emma só conversa, sem corrigir. Diga “volta a corrigir” para ter as correções de volta."}
            </p>
          </div>

          {/* Empilha no celular: os dois botões somam mais que 320px e o pai é
              overflow-hidden: "Encerrar" saía decepado, sem rolagem que o
              recuperasse. */}
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
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
