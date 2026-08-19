"use client";

import type { LiveServerMessage, Session } from "@google/genai";
import { AlertCircle, Loader2, Mic, MicOff, PhoneOff } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { EmmaAvatar } from "@/components/live/emma-avatar";
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
 * Quanto tempo uma conexão nova precisa ficar de pé para valer como boa.
 *
 * Sem isto o contador de tentativas zerava assim que o `connect` resolvia — e
 * `connect` resolve quando o WebSocket ABRE, não quando a sessão se prova viva.
 * Quando o servidor derruba a sessão logo após abrir (cota estourada, teto de
 * gastos, credencial recusada), cada tentativa "abria" com sucesso, zerava a
 * conta e caía de novo: o laço nunca alcançava MAX_RECONEXOES e o aluno ficava
 * preso no "Reconectando…" para sempre, sem mensagem nenhuma.
 */
const MS_CONEXAO_ESTAVEL = 8000;

/**
 * Traduz o motivo da queda quando reconectar não adianta: a próxima tentativa
 * devolveria exatamente o mesmo erro. O texto chega em inglês, cru, no `reason`
 * do CloseEvent — e é a única pista que o servidor dá de que o problema está na
 * conta do serviço, e não na rede do aluno.
 *
 * Devolve `null` para queda comum (rede, GoAway, inatividade), que reconecta.
 */
function falhaDefinitiva(motivo: string): string | null {
  const t = motivo.toLowerCase();

  // Ancorado no texto exato do servidor: "exceeded" sozinho também aparece em
  // "deadline exceeded", que é queda passageira e PRECISA reconectar.
  if (
    /spend(ing)? cap|billing|quota|resource has been exhausted|rate.?limit|\b429\b/.test(
      t,
    )
  ) {
    return "A sala de voz está indisponível: a conta do serviço atingiu o limite de uso contratado. Não é problema do seu computador nem da sua internet — avise o suporte.";
  }

  if (
    /api key|api_key|unauthenticated|unauthorized|permission|forbidden|\b401\b|\b403\b/.test(
      t,
    )
  ) {
    return "A sala de voz recusou a credencial de acesso. Não há nada para você ajustar aqui — avise o suporte.";
  }

  return null;
}

/**
 * Worklet de captura: converte Float32 do microfone em PCM 16-bit e envia
 * ao thread principal em blocos de ~16 ms (256 amostras a 16 kHz).
 *
 * Blocos menores dão ao VAD do servidor matéria-prima mais frequente para
 * detectar silêncio — e é isso que encurta o tempo entre o aluno parar de
 * falar e a Emma começar a responder.
 *
 * O AudioContext de entrada roda a 16 kHz (`sampleRate: INPUT_RATE`), então
 * o worklet recebe os dados já na taxa certa, sem reamostragem.
 *
 * Vai como blob para não precisar de arquivo estático servido separadamente.
 */
const CAPTURE_WORKLET = `
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = [];
    this._size = 0;
    this._target = 256;
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

/**
 * ===========================================================================
 * DE QUEM É A PALAVRA — e por que isso não pode sair da fila de áudio
 * ===========================================================================
 * A Emma chega como PCM cru de 24 kHz em 16 bits: 384 kbps, que viram ~512
 * kbps depois do base64 do protocolo. Num enlace que sustente isso com folga o
 * áudio chega adiantado — medido aqui: 21,7 s de fala entregues em 5,6 s de
 * rede, 3,9x o tempo real, com a fila ganhando 16 s de dianteira.
 *
 * Num enlace apertado, não. Medido com a banda limitada a 300 kbps: 11,6 s de
 * fala arrastados por 48,8 s de rede — 0,24x o tempo real — e 36 dos 45 blocos
 * chegando com a FILA JÁ VAZIA.
 *
 * O estado "a Emma está falando" era lido da fila: havia buffer tocando, era a
 * vez dela; a fila secava, era a vez do aluno. Com a fila secando entre um
 * bloco e outro isso virou um pisca-pisca — 21 idas e voltas dentro de UMA
 * frase, "falando" e "sua vez" trocando a cada 300 ms. E como é esse mesmo
 * estado que fecha o microfone (a sala é half-duplex de propósito), cada
 * piscada reabria o microfone no meio da fala dela: 21 janelas para o
 * alto-falante voltar pelo microfone, o VAD do servidor ouvir isso como o
 * aluno falando por cima, mandar `interrupted` — e o resto da frase da Emma
 * ser jogado fora. Era esse o áudio cortado.
 *
 * Quem sabe se ela terminou é o SERVIDOR, e ele avisa: manda
 * `generationComplete` quando acaba de produzir o turno. A fila secar não quer
 * dizer que ela parou de falar — quer dizer que a rede não acompanhou. Então a
 * palavra é dela enquanto a geração estiver aberta OU houver áudio na fila, e
 * só volta ao aluno quando as duas coisas acabarem, depois de um rabo de
 * silêncio.
 */

/** Almofada inicial da fila, em segundos, antes de tocar o primeiro bloco. */
const FOLGA_INICIAL = 0.18;
/** Teto da almofada: acima disto a Emma demoraria demais a começar. */
const FOLGA_MAXIMA = 0.9;
/** Quanto a almofada cresce a cada vez que a fila seca no meio da fala. */
const FOLGA_PASSO = 0.18;
/**
 * Silêncio depois que a Emma termina de fato, antes de devolver a palavra.
 * Cobre o rabo de reverberação da sala e o tempo de o cancelador de eco do
 * navegador se assentar — é a janela em que o microfone ainda ouviria ela.
 */
const RABO_DO_TURNO_MS = 500;
/**
 * Válvula de segurança: geração aberta, fila vazia e nada chegando por tanto
 * tempo quer dizer que o turno morreu sem aviso. Sem isto o microfone ficaria
 * fechado para sempre e a conversa travaria em silêncio. Generoso de
 * propósito: no enlace de 300 kbps medido aqui houve intervalo de 4,4 s entre
 * dois blocos de uma frase que estava perfeitamente viva.
 */
const CAO_DE_GUARDA_MS = 10000;
/**
 * Só o aluno interrompe. Se o microfone está fechado há mais que isto, não
 * houve fala dele para o servidor ouvir — o que o VAD pegou foi eco ou ruído,
 * e o `interrupted` correspondente é para ignorar. A janela cobre o áudio que
 * ainda estava em trânsito quando o portão fechou, que é o caso legítimo.
 */
const JANELA_DE_INTERRUPCAO_MS = 1500;

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
  const activeSourcesRef = React.useRef<AudioBufferSourceNode[]>([]);
  /**
   * "A Emma tem a palavra": comanda o rótulo E o portão do microfone. Deriva
   * de `geracaoAbertaRef` mais a fila, nunca só da fila. Ver o bloco no topo.
   */
  const speakingRef = React.useRef(false);
  /** O servidor ainda está produzindo este turno — só ele sabe disso. */
  const geracaoAbertaRef = React.useRef(false);
  /** Rabo de silêncio antes de devolver a palavra ao aluno. */
  const speakingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  /** Almofada adaptativa da fila: cresce quando o enlace se mostra apertado. */
  const folgaRef = React.useRef(FOLGA_INICIAL);
  /** Quando o microfone de fato mandou áudio, para validar `interrupted`. */
  const ultimoEnvioRef = React.useRef(0);
  /** Destrava a sala se o turno da Emma morrer sem o servidor avisar. */
  const caoDeGuardaRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const levelRef = React.useRef(0);
  const rafLevelRef = React.useRef<number | null>(null);
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
  /** Zera `tentativasRef` só depois que a conexão nova se sustenta de pé. */
  const estabilidadeRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
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
  const reconectarRef = React.useRef<
    ((motivo: string) => Promise<void>) | null
  >(null);
  const quedaRef = React.useRef<((motivo: string) => Promise<void>) | null>(
    null,
  );
  const stopRef = React.useRef<(() => Promise<void>) | null>(null);

  React.useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const stopActiveAudio = React.useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // nó já finalizado
      }
    }
    activeSourcesRef.current = [];
    playHeadRef.current = 0;
    geracaoAbertaRef.current = false;
    if (caoDeGuardaRef.current) clearTimeout(caoDeGuardaRef.current);
    caoDeGuardaRef.current = null;
    if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    speakingTimeoutRef.current = null;
    if (speakingRef.current) {
      speakingRef.current = false;
      setSpeaking(false);
    }
  }, []);

  /**
   * Recalcula de quem é a palavra, e é o ÚNICO lugar que mexe em
   * `speakingRef` no caminho normal.
   *
   * A palavra é da Emma enquanto o servidor estiver produzindo o turno ou
   * ainda houver áudio dela na fila. Só quando as duas coisas acabam é que ela
   * volta ao aluno — e mesmo aí depois do rabo de silêncio, porque o eco do
   * alto-falante ainda está no ar.
   *
   * Chamada de todo lugar que muda uma das duas condições: chegou áudio, a
   * fila esvaziou, o servidor fechou a geração.
   */
  const avaliarTurno = React.useCallback(() => {
    const daEmma =
      geracaoAbertaRef.current || activeSourcesRef.current.length > 0;

    if (daEmma) {
      // Qualquer sinal de vida cancela a devolução em curso: era só a fila
      // secando entre dois blocos, não o fim da fala.
      if (speakingTimeoutRef.current) {
        clearTimeout(speakingTimeoutRef.current);
        speakingTimeoutRef.current = null;
      }
      if (!speakingRef.current) {
        speakingRef.current = true;
        setSpeaking(true);
      }
      return;
    }

    if (!speakingRef.current || speakingTimeoutRef.current) return;

    speakingTimeoutRef.current = setTimeout(() => {
      speakingTimeoutRef.current = null;
      if (geracaoAbertaRef.current || activeSourcesRef.current.length > 0)
        return;
      // A almofada volta ao começo junto com a palavra: o próximo turno é uma
      // fala nova, não a continuação de uma fila que secou.
      playHeadRef.current = 0;
      speakingRef.current = false;
      setSpeaking(false);
    }, RABO_DO_TURNO_MS);
  }, []);

  /**
   * Rearma o cão de guarda. Sem ele, um turno que morresse sem
   * `generationComplete` — servidor engasgado, quadro perdido — deixaria o
   * microfone fechado para sempre e a conversa travaria em silêncio absoluto.
   */
  const rearmarCaoDeGuarda = React.useCallback(() => {
    const rearmar = () => {
      if (caoDeGuardaRef.current) clearTimeout(caoDeGuardaRef.current);
      caoDeGuardaRef.current = setTimeout(() => {
        caoDeGuardaRef.current = null;
        if (!geracaoAbertaRef.current) return;
        // Ainda há áudio dela tocando: o turno está vivo, só adiantado. Volta a
        // armar em vez de desistir, senão a válvula sumiria justo nas conexões
        // boas, que são as que enchem a fila.
        if (activeSourcesRef.current.length > 0) {
          rearmar();
          return;
        }
        console.warn(
          "[live] turno da Emma sem sinal por " +
            CAO_DE_GUARDA_MS / 1000 +
            "s: devolvendo a palavra ao aluno",
        );
        geracaoAbertaRef.current = false;
        avaliarTurno();
      }, CAO_DE_GUARDA_MS);
    };
    rearmar();
  }, [avaliarTurno]);

  const cleanup = React.useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (estabilidadeRef.current) clearTimeout(estabilidadeRef.current);
    estabilidadeRef.current = null;
    if (rafLevelRef.current) cancelAnimationFrame(rafLevelRef.current);
    rafLevelRef.current = null;
    if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    speakingTimeoutRef.current = null;
    if (caoDeGuardaRef.current) clearTimeout(caoDeGuardaRef.current);
    caoDeGuardaRef.current = null;
    stopActiveAudio();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void inCtxRef.current?.close().catch(() => {});
    void outCtxRef.current?.close().catch(() => {});
    inCtxRef.current = null;
    outCtxRef.current = null;
    if (workletUrlRef.current) URL.revokeObjectURL(workletUrlRef.current);
    workletUrlRef.current = null;
    playHeadRef.current = 0;
    levelRef.current = 0;
    setLevel(0);
  }, [stopActiveAudio]);

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
  const enqueueAudio = React.useCallback(
    (pcm: Int16Array) => {
      const ctx = outCtxRef.current;
      if (!ctx || ctx.state === "closed") return;
      // Garante que o contexto não está suspenso (pode acontecer entre turnos).
      if (ctx.state === "suspended") void ctx.resume();

      const float = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) float[i] = pcm[i] / 32768;

      // O buffer declara 24 kHz: se o contexto roda a outra taxa, o WebAudio
      // reamostra automaticamente com filtro de qualidade.
      const buffer = ctx.createBuffer(1, float.length, OUTPUT_RATE);
      buffer.copyToChannel(float, 0);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      let startAt = playHeadRef.current;

      /**
       * A fila secou e este bloco chega atrasado. Tocá-lo em `now`, colado, é o
       * que a versão anterior fazia — e garantia a próxima seca, porque sem
       * almofada nenhuma o bloco seguinte só tem a duração deste para chegar.
       *
       * Aqui a almofada é reconstruída, e um degrau maior a cada seca: um enlace
       * que já não acompanhou uma vez não vai acompanhar na próxima. Ela cresce
       * só até FOLGA_MAXIMA, que é o atraso máximo aceitável para a resposta
       * dela, e volta ao começo quando a palavra volta ao aluno.
       *
       * `playHeadRef` zerado quer dizer turno novo, não seca: aí a almofada é a
       * que a sessão já aprendeu, sem degrau.
       */
      if (startAt < now) {
        if (playHeadRef.current > 0) {
          folgaRef.current = Math.min(
            FOLGA_MAXIMA,
            folgaRef.current + FOLGA_PASSO,
          );
        }
        startAt = now + folgaRef.current;
      }

      source.start(startAt);
      playHeadRef.current = startAt + buffer.duration;

      activeSourcesRef.current.push(source);
      avaliarTurno();

      source.onended = () => {
        // CRÍTICO: desconectar o nó terminado do grafo. Sem isto, centenas de
        // AudioBufferSourceNodes "mortos" acumulam no destino e o mixer do
        // browser degrada a reprodução progressivamente.
        try {
          source.disconnect();
        } catch {
          /* já desconectado */
        }
        const idx = activeSourcesRef.current.indexOf(source);
        if (idx !== -1) activeSourcesRef.current.splice(idx, 1);
        // A fila esvaziar NÃO quer dizer que ela parou de falar: pode ser a rede
        // que não acompanhou. Quem decide é `avaliarTurno`, olhando também se a
        // geração ainda está aberta no servidor.
        if (activeSourcesRef.current.length === 0) avaliarTurno();
      };
    },
    [avaliarTurno],
  );

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

      // Áudio da tutora. O primeiro bloco de um turno é o que abre a geração:
      // daqui até `generationComplete` a palavra é dela, doa o que doer à fila.
      let chegouAudio = false;
      for (const part of content.modelTurn?.parts ?? []) {
        const data = part.inlineData?.data;
        if (!data) continue;
        chegouAudio = true;
        geracaoAbertaRef.current = true;
        enqueueAudio(fromBase64(data));
      }
      if (chegouAudio) rearmarCaoDeGuarda();

      // Transcrições (chegam fatiadas)
      const inputText = content.inputTranscription?.text;
      if (inputText) partialUserRef.current += inputText;

      const outputText = content.outputTranscription?.text;
      if (outputText) partialModelRef.current += outputText;

      if (content.turnComplete) flushParciais();

      /**
       * O servidor terminou de produzir o turno.
       *
       * É ESTE o sinal de que ela parou de falar — não a fila esvaziando.
       * Daqui em diante o que ainda houver na fila segura a palavra com ela até
       * tocar o último bloco, e só então a palavra volta ao aluno.
       *
       * Chega bem antes de `turnComplete` quando a rede está boa (medido: 16 s
       * antes, com a fila adiantada), e é por isso que os dois contam.
       */
      const fechouGeracao =
        (content as { generationComplete?: boolean }).generationComplete ||
        content.turnComplete;
      if (fechouGeracao && geracaoAbertaRef.current) {
        geracaoAbertaRef.current = false;
        if (caoDeGuardaRef.current) clearTimeout(caoDeGuardaRef.current);
        caoDeGuardaRef.current = null;
      }

      if (content.interrupted) {
        /**
         * `interrupted` quer dizer "o aluno falou por cima". Mas a sala é
         * half-duplex: enquanto a Emma fala o microfone está FECHADO e nada
         * sobe. Se faz mais que JANELA_DE_INTERRUPCAO_MS que não mandamos
         * áudio, não houve fala dele — o que o VAD do servidor ouviu foi eco do
         * alto-falante ou ruído da sala.
         *
         * Obedecer a isso era jogar fora o resto da frase da Emma por causa da
         * própria voz dela. A janela ainda deixa passar a interrupção legítima:
         * o áudio que já estava em trânsito quando o portão fechou.
         */
        const podeTerSidoOAluno =
          performance.now() - ultimoEnvioRef.current < JANELA_DE_INTERRUPCAO_MS;

        if (podeTerSidoOAluno) {
          stopActiveAudio();
        } else {
          console.warn(
            "[live] `interrupted` com o microfone fechado: ignorado (eco ou ruído, não o aluno)",
          );
        }
      }
    },
    [enqueueAudio, flushParciais, rearmarCaoDeGuarda, stopActiveAudio],
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
        body: JSON.stringify({
          lessonId,
          scenario,
          resumeHandle: handle,
          mode: modoRef.current,
        }),
      });
      const tokenPayload = await tokenResponse.json();
      if (!tokenResponse.ok)
        throw new Error(tokenPayload?.error ?? "Falha ao obter acesso");

      /**
       * O SDK entra aqui, e nao no topo do arquivo.
       *
       * Importado estaticamente ele viajava no pacote inicial da tela: ~320 KB
       * de JavaScript baixados e interpretados por quem só abriu a página para
       * ler o cenário do circuito. Num celular em rede móvel isso é tempo de
       * tela parada antes de qualquer coisa aparecer.
       *
       * Aqui dentro ele só é buscado quando o aluno toca em "Iniciar conversa".
       * Não há risco de gesto perdido: `start()` já pediu o microfone antes de
       * chegar nesta função, e conexão de WebSocket não exige ativação.
       */
      const { GoogleGenAI, Modality } = await import("@google/genai");

      const ai = new GoogleGenAI({
        apiKey: tokenPayload.token,
        httpOptions: { apiVersion: "v1alpha" },
      });

      const id = ++idCounterRef.current;

      /**
       * QUEM ABRE A BOCA PRIMEIRO.
       *
       * Numa sessão de voz o modelo não fala sozinho: ele espera um turno. Sem
       * isto, a sala abria em silêncio, o aluno dizia "hi" para preencher o
       * vazio, e a Emma respondia àquele "hi" — conversando. A abertura de aula
       * que o modo Professora define (dizer em português o que vão praticar,
       * quais expressões, como funciona) nunca acontecia, porque ela nunca
       * chegava a ter o primeiro turno.
       *
       * O empurrão vai como turno do aluno porque é o único canal que a sessão
       * tem; o texto avisa que é o sistema falando, para a Emma não responder
       * a ele como se fosse fala. E vai SÓ na primeira conexão: a reconexão dos
       * dez minutos retoma a conversa pelo handle, e reabrir a aula ali faria a
       * Emma se apresentar de novo no meio de um exercício.
       */
      const primeiraConexao = !handle;

      const sessao = await ai.live.connect({
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
          // O `reason` é o único lugar onde o servidor conta POR QUE derrubou
          // (cota, teto de gastos, credencial). Descartar isso, como antes,
          // transformava qualquer falha permanente em reconexão muda e eterna.
          onclose: (event: CloseEvent) => {
            if (id !== activeIdRef.current) return;
            void quedaRef.current?.(
              event.reason || "conexão encerrada pelo servidor",
            );
          },
        },
      });

      // Ver `primeiraConexao` acima: é este turno que faz a aula começar.
      if (primeiraConexao) {
        try {
          sessao.sendClientContent({
            turns: [
              {
                role: "user",
                parts: [
                  {
                    text: "[sistema] O aluno acabou de entrar na sala e ainda não falou. Comece a aula agora, do seu jeito, seguindo a instrução de abertura.",
                  },
                ],
              },
            ],
            turnComplete: true,
          });
        } catch (e) {
          // Falhar aqui custa a abertura, não a conversa: o aluno fala e a
          // sessão segue. Derrubar a sala por causa disso seria pior.
          console.warn("[live] não consegui pedir a abertura da aula:", e);
        }
      }

      return sessao;
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

      // Uma conexão que morre por motivo permanente não volta por insistência:
      // reconectar aqui só trocaria a mensagem de erro por um giro infinito.
      const definitiva = falhaDefinitiva(motivo);
      if (definitiva) {
        console.error(`[live] queda definitiva: ${motivo}`);
        setError(definitiva);
        await stopRef.current?.();
        return;
      }

      // A conexão anterior caiu: se ela ainda tinha um prazo de estabilidade
      // correndo, ele não vale mais — não foi de pé que ela saiu.
      if (estabilidadeRef.current) {
        clearTimeout(estabilidadeRef.current);
        estabilidadeRef.current = null;
      }

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

        // Aberta não é o mesmo que boa: o contador só volta a zero se esta
        // conexão passar de MS_CONEXAO_ESTAVEL viva. Zerar aqui, na hora,
        // fazia toda queda imediata parecer uma reconexão bem-sucedida.
        estabilidadeRef.current = setTimeout(() => {
          tentativasRef.current = 0;
          estabilidadeRef.current = null;
        }, MS_CONEXAO_ESTAVEL);
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

    // A almofada é aprendida por sessão: cada conversa começa do zero, sem
    // arrastar o atraso que a rede da conversa anterior obrigou a criar.
    geracaoAbertaRef.current = false;
    folgaRef.current = FOLGA_INICIAL;
    ultimoEnvioRef.current = 0;
    playHeadRef.current = 0;

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
      //    Entrada a 16 kHz: o browser reamostra do hardware com filtro anti-
      //    aliasing adequado, e o worklet recebe PCM limpo na taxa que o Gemini
      //    espera — sem reamostragem manual, sem artefatos.
      //    Saída na taxa nativa do hardware: o `createBuffer(…, OUTPUT_RATE)`
      //    diz ao WebAudio que os dados são 24 kHz, e ele reamostra para a
      //    taxa nativa com filtro de qualidade. Forçar 24 kHz no contexto
      //    causava acúmulo de artefatos no driver de áudio do Windows após
      //    a primeira resposta — era essa a causa do travamento progressivo.
      const inCtx = new AudioContext({ sampleRate: INPUT_RATE });
      const outCtx = new AudioContext();
      inCtxRef.current = inCtx;
      outCtxRef.current = outCtx;
      await outCtx.resume();

      const blob = new Blob([CAPTURE_WORKLET], {
        type: "application/javascript",
      });
      const workletUrl = URL.createObjectURL(blob);
      workletUrlRef.current = workletUrl;
      await inCtx.audioWorklet.addModule(workletUrl);

      // 3. Sessão ao vivo (o token efêmero é pedido dentro de `abrirSessao`,
      //    para que reconectar use exatamente o mesmo caminho da 1ª conexão).
      sessionRef.current = await abrirSessao(null);

      // 4. Microfone -> sessão
      const source = inCtx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(inCtx, "capture-processor");

      node.port.onmessage = (
        event: MessageEvent<{ pcm: ArrayBuffer; peak: number }>,
      ) => {
        // Atualiza o nível visual via ref — sem re-render direto. O `setLevel`
        // só é chamado uma vez por frame, via requestAnimationFrame.
        levelRef.current = Math.min(1, event.data.peak * 2.2);
        if (!rafLevelRef.current) {
          rafLevelRef.current = requestAnimationFrame(() => {
            rafLevelRef.current = null;
            setLevel(levelRef.current);
          });
        }
        // O aluno pediu explicitamente para não interromper a Emma enquanto ela
        // fala. Isso implementa um modo half-duplex (walkie-talkie), que
        // também resolve o problema de ecos do alto-falante acionarem o VAD
        // do servidor e cortarem a resposta da Emma no meio.
        if (mutedRef.current || speakingRef.current) return;

        // Marca ANTES de mandar: é o carimbo que valida (ou desmente) o
        // `interrupted` que o servidor mandar em seguida.
        ultimoEnvioRef.current = performance.now();

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

      if (result.ok)
        toast.success("Conversa salva. A tutora avaliou seu desempenho.");
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

  const estadoDoAvatar =
    phase === "connecting" || phase === "closing"
      ? ("conectando" as const)
      : phase === "live"
        ? speaking
          ? ("falando" as const)
          : ("ouvindo" as const)
        : ("parada" as const);

  /**
   * A tela é uma chamada, não um painel.
   *
   * Ela tinha um cartão com o cenário do circuito, um cartão de "como
   * aproveitar" com quatro parágrafos, um rodapé sobre calibragem de nível e a
   * lista das últimas cinco conversas — tudo acima e abaixo do botão que o
   * aluno veio apertar. Quem chega para falar não vem ler.
   *
   * Sobrou o que uma chamada tem: quem é do outro lado, em que estado ela está,
   * o modo, e um botão redondo. O histórico virou tela própria, a um toque no
   * canto. Nenhum texto explicativo: o que a Emma faz, ela faz na primeira
   * frase da conversa — e é em português, no modo Professora.
   */
  // Auto-scroll da transcrição: sempre que um turno novo chega, desce até o fim.
  const transcriptEndRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 md:flex-row md:items-start md:justify-center md:gap-8 lg:gap-12">
      {/* ─── Coluna esquerda: Emma, controles ─── */}
      <div className="flex w-full md:w-1/2 md:max-w-[400px] shrink-0 flex-col items-center">
        {error ? (
          <p className="bg-destructive/10 text-destructive mb-6 flex w-full items-start gap-2 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : null}

        {/* O halo fica atrás do avatar e não empurra nada: é ambiente. */}
        <div className="relative grid place-items-center">
          <div
            aria-hidden
            data-ativa={
              estadoDoAvatar === "falando" || estadoDoAvatar === "ouvindo"
            }
            className="ondas pointer-events-none absolute size-[26rem] max-sm:size-[22rem]"
          />
          <EmmaAvatar
            estado={estadoDoAvatar}
            nivel={level}
            modo={modo}
            className="relative size-36 sm:size-44"
          />
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Emma</h1>

        {/* Uma linha de estado, sempre no mesmo lugar: é o que o aluno olha para
            saber de quem é a vez. Altura fixa para o botão não pular quando o
            texto troca. */}
        <div className="mt-1.5 flex h-6 items-center gap-2">
          {phase === "live" ? (
            <>
              <span className="text-muted-foreground text-sm tabular-nums">
                {mmss}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span
                className={cn(
                  "text-sm font-medium",
                  speaking ? "text-primary" : "text-foreground",
                )}
              >
                {reconectando
                  ? "reconectando…"
                  : speaking
                    ? "falando"
                    : "sua vez"}
              </span>
            </>
          ) : phase === "connecting" ? (
            <span className="text-muted-foreground text-sm">chamando…</span>
          ) : phase === "closing" ? (
            <span className="text-muted-foreground text-sm">encerrando…</span>
          ) : (
            <span className="text-muted-foreground text-sm">
              {title ?? "sua professora de inglês"}
            </span>
          )}
        </div>

        {/* Os dois modos, sempre visíveis: é no meio da fala que o aluno descobre
            que quer desligar a correção. */}
        <div
          role="group"
          aria-label="Modo da Emma"
          // A borda laranja delimita o par no tema claro. Sem ela, o trilho
          // `bg-muted` fica a um passo do chão do app — os dois botões não têm
          // onde começar nem onde terminar, e o aluno não lê como um controle de
          // duas posições. No escuro a borda sai: ali o degrau de luminância
          // entre o trilho e o fundo já faz esse trabalho, e um anel laranja
          // sobre o preto vira brilho, não contorno.
          className="bg-muted border-primary/30 mt-8 flex w-full max-w-xs rounded-full border p-1 dark:border-transparent"
        >
          {(["professora", "conversa"] as Modo[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => trocarModo(m)}
              // Enquanto a sala abre, o token com o modo já foi pedido e a sessão
              // ainda não existe para receber o aviso: a troca cairia no vazio.
              disabled={phase === "connecting" || phase === "closing"}
              aria-pressed={modo === m}
              className={cn(
                "min-h-11 flex-1 rounded-full px-4 text-sm font-medium transition-all disabled:opacity-50",
                modo === m
                  ? // O selecionado sobe: papel branco com a borda da marca, para
                    // o par ler como interruptor de duas posições e não como duas
                    // abas soltas.
                    "bg-card text-foreground border-primary/45 shadow-sm dark:border-transparent border"
                  : "text-muted-foreground hover:text-foreground border border-transparent",
              )}
            >
              {m === "professora" ? "Professora" : "Conversa"}
            </button>
          ))}
        </div>

        {/* O botão. Redondo, grande, no centro — e é o único elemento da tela que
            o aluno precisa acertar. */}
        <div className="mt-10 flex items-center gap-5">
          {phase === "idle" ? (
            <button
              type="button"
              onClick={start}
              aria-label="Iniciar conversa"
              className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring grid size-20 place-items-center rounded-full shadow-lg transition-all hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95"
            >
              <Mic className="size-8" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                disabled={phase !== "live"}
                aria-label={
                  muted ? "Reativar microfone" : "Silenciar microfone"
                }
                aria-pressed={muted}
                className={cn(
                  "focus-visible:ring-ring grid size-14 place-items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-40",
                  muted
                    ? "bg-foreground text-background"
                    : "bg-muted text-foreground hover:bg-accent",
                )}
              >
                {muted ? (
                  <MicOff className="size-5" />
                ) : (
                  <Mic className="size-5" />
                )}
              </button>

              <button
                type="button"
                onClick={stop}
                aria-label="Encerrar conversa"
                className="bg-destructive text-primary-foreground focus-visible:ring-destructive grid size-20 place-items-center rounded-full shadow-lg transition-all hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95 disabled:opacity-60"
                disabled={phase === "closing"}
              >
                {phase === "closing" ? (
                  <Loader2 className="size-8 animate-spin" />
                ) : (
                  <PhoneOff className="size-8" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Coluna direita: transcrição lado a lado ─── */}
      {turns.length ? (
        <div className="bg-card/50 border-border/40 w-full md:w-1/2 min-w-0 flex-1 rounded-2xl border p-4 self-stretch">
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Transcrição
          </p>
          <div className="max-h-[28rem] space-y-2.5 overflow-y-auto pr-1 md:max-h-[32rem]">
            {turns.map((turn, i) => (
              <div
                key={i}
                className={cn(
                  "w-fit max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  turn.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md",
                )}
              >
                {turn.text}
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
