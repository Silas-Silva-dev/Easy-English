"use client";

/**
 * Tradução de fala ao vivo.
 *
 * ===========================================================================
 * POR QUE O RECONHECIMENTO NÃO PASSA PELO NOSSO SERVIDOR
 * ===========================================================================
 * O caminho óbvio seria gravar o áudio e mandar para o Gemini transcrever e
 * traduzir numa chamada só. Funciona — o `flash-lite` transcreve e traduz
 * corretamente — mas custa ~2,4 segundos por fala, e a latência é quase
 * constante: 2.375ms para um áudio de 1,6s, 2.670ms para um de 16,4s. A pessoa
 * fala dois segundos e espera outros dois olhando para a tela.
 *
 * A Web Speech API resolve o reconhecimento fora do nosso caminho: o texto
 * aparece enquanto a pessoa fala, sem consumir a nossa cota. (No Chrome do
 * computador o áudio vai para o serviço de voz do Google, não fica no
 * aparelho — o que muda para nós é que não é a nossa chave nem a nossa cota.)
 *
 * O Gemini entra só depois, sobre a frase pronta: ~800ms sobre texto.
 *
 * ===========================================================================
 * UMA FALA POR VEZ (continuous = false)
 * ===========================================================================
 * A primeira versão usava `continuous = true` e religava o reconhecedor no
 * `onend`, para escutar sem parar. Isso trouxe dois problemas:
 *
 *   1. O botão nunca se desligava sozinho. Quem terminava de falar precisava
 *      lembrar de tocar de novo.
 *   2. O religamento em rajada é o suspeito do microfone mudo no Chrome de
 *      computador: `onend` dispara, religa, dispara de novo, e o reconhecedor
 *      passa a nunca acumular resultado nenhum. O painel dizia "Ouvindo" e não
 *      reconhecia uma palavra.
 *
 * Com `continuous = false` o próprio Chrome detecta o fim da fala, entrega o
 * resultado e encerra. O botão desliga sozinho, não há laço para flapar, e o
 * ciclo fica igual ao do Google Tradutor: toca, fala, solta.
 *
 * ===========================================================================
 * ABRIR O MICROFONE A CADA FALA — NÃO É OPCIONAL
 * ===========================================================================
 * Antes de cada `start()` este componente chama `getUserMedia` e mantém a
 * trilha aberta enquanto escuta. Parece redundante quando a permissão já foi
 * concedida, e não é: sem essa chamada, o Chrome do Android grava a PRIMEIRA
 * fala e emudece em todas as seguintes — reconhecedor de pé, botão aceso,
 * nenhum áudio. Já foi removido duas vezes, em nome de duas teorias
 * diferentes, e reprovado em produção nas duas. Ver o `streamRef`.
 */

import { AlertCircle, Copy, Loader2, Mic, RotateCw, Volume2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { translateSpeechAction } from "@/app/app/tradutor/actions";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipos da Web Speech API
//
// Não estão no lib.dom padrão do TypeScript porque a API nunca saiu de rascunho
// no W3C, mesmo com quinze anos de uso em produção. Declaramos só o que usamos.
// ---------------------------------------------------------------------------

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Impedimento = "sem-api" | "sem-https" | null;

function detectarImpedimento(): Impedimento {
  if (typeof window === "undefined") return null;
  // Contexto inseguro derruba a API antes de qualquer permissão. `localhost`
  // conta como seguro; um IP da rede local em http, não.
  if (!window.isSecureContext) return "sem-https";
  if (!getRecognitionCtor()) return "sem-api";
  return null;
}

// ---------------------------------------------------------------------------

type Direction = "en→pt" | "pt→en";

const LANG: Record<Direction, { recog: string; speak: string; de: string }> = {
  "en→pt": { recog: "en-US", speak: "pt-BR", de: "inglês" },
  "pt→en": { recog: "pt-BR", speak: "en-US", de: "português" },
};

/** Sem nenhum áudio chegando neste tempo, algo está errado e é preciso dizer. */
const SEM_AUDIO_MS = 7000;

export function VoiceTranslator() {
  const [impedimento, setImpedimento] = React.useState<Impedimento | "carregando">("carregando");
  const [listening, setListening] = React.useState(false);
  const [direction, setDirection] = React.useState<Direction>("en→pt");

  const [interim, setInterim] = React.useState("");
  const [source, setSource] = React.useState("");
  const [translation, setTranslation] = React.useState("");
  const [translating, setTranslating] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const semAudioRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * A trilha do microfone é aberta A CADA fala e fica viva enquanto escuta.
   *
   * ISTO NÃO É PRECAUÇÃO — É O QUE FAZ O CELULAR FUNCIONAR. Está verificado
   * em produção, nas duas direções:
   *
   *   - com `getUserMedia` antes de cada `start()`: grava quantas vezes quiser;
   *   - sem ele a partir da segunda fala: o reconhecedor sobe, o botão acende,
   *     e nenhum áudio chega. Exatamente a primeira gravação funciona, porque
   *     nela o pedido de permissão ainda abre o dispositivo.
   *
   * O segundo caso foi entregue duas vezes e reprovado duas vezes. Não trocar
   * esta chamada por uma consulta de permissão: `permissions.query()` responde
   * "granted" e não abre dispositivo nenhum — foi essa a substituição que
   * quebrou a gravação repetida no Android.
   */
  const streamRef = React.useRef<MediaStream | null>(null);

  /**
   * Teste de microfone: nível de áudio ao vivo e o nome do dispositivo.
   *
   * `SpeechRecognition` NÃO deixa escolher o microfone — usa sempre o padrão
   * do navegador. Então, quando ele não ouve nada, a pergunta que importa é
   * "o padrão do navegador está captando?", e essa pergunta não se responde
   * pela tela de tradução: ela responde igual para "microfone mudo" e para
   * "reconhecedor sem rede".
   *
   * O medidor separa os dois casos em cinco segundos. Barra parada com você
   * falando: o dispositivo padrão está errado ou mudo. Barra mexendo e o
   * reconhecimento sem ouvir: o problema é do serviço de voz, não do aparelho.
   *
   * Fica num botão à parte, e nunca junto do reconhecimento, para não recriar
   * a disputa pelo dispositivo que este commit está removendo.
   */
  const [testando, setTestando] = React.useState(false);
  const [nivel, setNivel] = React.useState(0);
  const [dispositivo, setDispositivo] = React.useState<string | null>(null);
  const testeRef = React.useRef<{ stream: MediaStream; ctx: AudioContext; raf: number } | null>(null);

  React.useEffect(() => {
    setImpedimento(detectarImpedimento());
  }, []);

  const soltarMicrofone = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (semAudioRef.current) {
      clearTimeout(semAudioRef.current);
      semAudioRef.current = null;
    }
  }, []);

  const pararTeste = React.useCallback(() => {
    const t = testeRef.current;
    if (!t) return;
    cancelAnimationFrame(t.raf);
    t.stream.getTracks().forEach((x) => x.stop());
    void t.ctx.close();
    testeRef.current = null;
    setTestando(false);
    setNivel(0);
  }, []);

  const testarMicrofone = React.useCallback(async () => {
    if (testando) return pararTeste();
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setDispositivo(stream.getAudioTracks()[0]?.label || "(sem nome)");

      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);

      const medir = () => {
        analyser.getByteTimeDomainData(buf);
        // Desvio médio em relação ao silêncio (128). Amplitude, não frequência:
        // é o que responde "está entrando som?".
        let soma = 0;
        for (const v of buf) soma += Math.abs(v - 128);
        setNivel(Math.min(100, Math.round((soma / buf.length / 40) * 100)));
        if (testeRef.current) testeRef.current.raf = requestAnimationFrame(medir);
      };

      testeRef.current = { stream, ctx, raf: requestAnimationFrame(medir) };
      setTestando(true);
    } catch (e) {
      const nome = e instanceof DOMException ? e.name : "";
      setErro(`Não consegui abrir o microfone para o teste${nome ? ` (${nome})` : ""}.`);
    }
  }, [testando, pararTeste]);

  const traduzir = React.useCallback(async (texto: string, dir: Direction) => {
    setTranslating(true);
    setErro(null);
    try {
      const resposta = await translateSpeechAction(texto, dir);
      if (resposta.ok) setTranslation(resposta.translation);
      else setErro(resposta.error);
    } catch (e) {
      // Server Action que estoura (sessão expirada, rede caída) rejeita a
      // promessa. Sem este catch o trecho ficaria em "traduzindo…" para sempre.
      setErro(e instanceof Error ? e.message : "Falha de conexão com o servidor.");
    } finally {
      setTranslating(false);
    }
  }, []);

  const stop = React.useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    soltarMicrofone();
    setListening(false);
    setInterim("");
  }, [soltarMicrofone]);

  /**
   * Cria e liga o reconhecedor. Sempre com a trilha do microfone JÁ ABERTA.
   *
   * Só chame depois do `getUserMedia` da fala atual: é a abertura do
   * dispositivo que faz o reconhecedor do Android receber áudio na segunda
   * gravação e nas seguintes.
   */
  const iniciarReconhecimento = React.useCallback(() => {
    const Ctor = getRecognitionCtor();
    // A tela nem chega a mostrar o botão sem reconhecedor, mas sair daqui sem
    // devolver o microfone deixaria o aparelho aberto sem nada escutando.
    if (!Ctor) {
      soltarMicrofone();
      return;
    }

    const recognition = new Ctor();
    recognition.lang = LANG[direction].recog;
    // Uma fala por vez: o Chrome detecta o fim e encerra sozinho. Ver o
    // cabeçalho deste arquivo.
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // Chegou áudio: o microfone está mesmo entregando. Cancela o alarme.
    const cancelarAlarme = () => {
      if (semAudioRef.current) {
        clearTimeout(semAudioRef.current);
        semAudioRef.current = null;
      }
    };
    recognition.onaudiostart = cancelarAlarme;
    recognition.onspeechstart = cancelarAlarme;

    recognition.onresult = (event) => {
      cancelarAlarme();
      let parcial = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const resultado = event.results[i];
        const texto = resultado[0]?.transcript ?? "";
        if (resultado.isFinal) {
          const limpo = texto.trim();
          if (!limpo) continue;
          setSource(limpo);
          setInterim("");
          void traduzir(limpo, direction);
        } else {
          parcial += texto;
        }
      }
      if (parcial) setInterim(parcial);
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      // `no-speech` acontece quando o silêncio estoura o tempo do Chrome. Não
      // é defeito, mas o aluno precisa saber por que o botão apagou.
      setErro(
        event.error === "no-speech"
          ? "Não ouvi nada. Toque no microfone e fale mais perto do aparelho."
          : event.error === "not-allowed" || event.error === "service-not-allowed"
            ? "O navegador bloqueou o microfone para este site."
            : event.error === "network"
              ? "O reconhecimento de voz precisa de internet e a conexão falhou."
              : `O reconhecimento falhou (${event.error}).`,
      );
    };

    // Fim natural da fala. É aqui que o botão se desliga sozinho.
    recognition.onend = () => {
      recognitionRef.current = null;
      soltarMicrofone();
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);

      // Rede de segurança: reconhecedor que sobe mas nunca recebe áudio falha
      // calado. Sem isto o painel fica "Ouvindo" para sempre.
      semAudioRef.current = setTimeout(() => {
        setErro(
          "O microfone abriu mas nenhum áudio chegou. Confira se o microfone certo está selecionado no navegador e se outro aplicativo não está usando ele.",
        );
        recognition.abort();
      }, SEM_AUDIO_MS);
    } catch (e) {
      soltarMicrofone();
      recognitionRef.current = null;
      setErro(`Não consegui iniciar o reconhecimento: ${e instanceof Error ? e.message : e}`);
    }
  }, [direction, traduzir, soltarMicrofone]);

  const start = React.useCallback(async () => {
    /**
     * Limpa a tradução anterior ao começar uma nova fala.
     *
     * A tela mostra UMA fala por vez. Acumular vira rolagem infinita numa
     * ferramenta que se usa em pé, no meio de uma conversa.
     */
    setSource("");
    setTranslation("");
    setInterim("");
    setErro(null);

    // O teste de microfone segura o dispositivo: deixá-lo aberto aqui criaria
    // duas capturas concorrentes na mesma página.
    pararTeste();

    /**
     * Abre o microfone ANTES de ligar o reconhecedor — toda vez, mesmo com a
     * permissão já concedida, e sem encerrar a trilha em seguida.
     *
     * A trilha aberta é o que sustenta a segunda gravação e as próximas no
     * Android. Ver o comentário do `streamRef`: pular esta chamada quando a
     * permissão já existe é o defeito, não a otimização.
     */
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const nome = e instanceof DOMException ? e.name : "";
      setErro(
        nome === "NotAllowedError"
          ? "Permissão de microfone negada. Libere o microfone para este site nas configurações do navegador."
          : nome === "NotFoundError"
            ? "Nenhum microfone encontrado neste dispositivo."
            : `Não consegui abrir o microfone${nome ? ` (${nome})` : ""}.`,
      );
      return;
    }

    iniciarReconhecimento();
  }, [iniciarReconhecimento, pararTeste]);

  React.useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      // Sair da tela com uma trilha aberta deixaria o indicador de gravação do
      // navegador aceso para sempre. São duas: a da fala e a do teste.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const t = testeRef.current;
      if (t) {
        cancelAnimationFrame(t.raf);
        t.stream.getTracks().forEach((x) => x.stop());
        void t.ctx.close();
      }
      if (semAudioRef.current) clearTimeout(semAudioRef.current);
    };
  }, []);

  function falar(texto: string, lang: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = lang;
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }

  if (impedimento === "sem-api" || impedimento === "sem-https") {
    return (
      <div className="border-border bg-muted/30 flex items-start gap-3 rounded-xl border p-5">
        <AlertCircle className="text-muted-foreground mt-0.5 size-5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">
            {impedimento === "sem-https"
              ? "A tradução por voz precisa de uma conexão segura"
              : "Seu navegador não reconhece voz"}
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {impedimento === "sem-https"
              ? "O navegador só libera o microfone em https (ou em localhost). Abra o site pelo endereço https e o painel funciona."
              : "A voz precisa do Chrome, Edge ou Safari — no computador ou no celular. No Firefox, use a aba Digitar: a tradução é a mesma, com IPA e exemplos."}
          </p>
        </div>
      </div>
    );
  }

  const textoNaTela = source || interim;

  return (
    <div className="border-border bg-card space-y-5 rounded-xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Toque, fale, e solte: o painel para sozinho quando você termina.
        </p>
        <div className="border-border flex overflow-hidden rounded-lg border text-xs font-medium">
          {(["en→pt", "pt→en"] as Direction[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDirection(d);
                if (listening) stop();
              }}
              className={cn(
                "px-3 py-1.5 transition-colors",
                direction === d
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {d === "en→pt" ? "EN → PT" : "PT → EN"}
            </button>
          ))}
        </div>
      </div>

      {/* Origem */}
      <div className="min-h-[5rem] space-y-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {direction === "en→pt" ? "Inglês" : "Português"}
        </p>
        {textoNaTela ? (
          <div className="flex items-start justify-between gap-3">
            <p
              className={cn(
                "text-xl leading-snug font-medium",
                !source && "text-muted-foreground italic",
              )}
            >
              {textoNaTela}
            </p>
            {source ? (
              <button
                type="button"
                onClick={() => falar(source, LANG[direction].recog)}
                className="text-muted-foreground hover:text-foreground mt-1 shrink-0 transition-colors"
                aria-label="Ouvir o original"
              >
                <Volume2 className="size-5" />
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-xl">
            {listening ? "Pode falar…" : "Toque no microfone"}
          </p>
        )}
      </div>

      <div className="border-border border-t" />

      {/* Destino */}
      <div className="min-h-[5rem] space-y-2">
        <p className="text-primary text-xs font-semibold tracking-wide uppercase">
          {direction === "en→pt" ? "Português (Brasil)" : "Inglês"}
        </p>

        {translating ? (
          <p className="text-muted-foreground flex items-center gap-2 text-lg">
            <Loader2 className="size-4 animate-spin" />
            traduzindo…
          </p>
        ) : translation ? (
          <div className="flex items-start justify-between gap-3">
            <p className="text-primary text-xl leading-snug">{translation}</p>
            <div className="mt-1 flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => falar(translation, LANG[direction].speak)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Ouvir a tradução"
              >
                <Volume2 className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(translation);
                  toast.success("Tradução copiada.");
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Copiar"
              >
                <Copy className="size-5" />
              </button>
            </div>
          </div>
        ) : erro ? (
          <div className="space-y-2">
            <div className="border-destructive/40 bg-destructive/5 flex items-start gap-2.5 rounded-lg border p-3.5">
              <AlertCircle className="text-destructive mt-0.5 size-4 shrink-0" />
              <p className="text-destructive text-sm leading-relaxed">{erro}</p>
            </div>
            {source ? (
              <button
                type="button"
                onClick={() => void traduzir(source, direction)}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
              >
                <RotateCw className="size-3.5" />
                Tentar traduzir de novo
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-xl">—</p>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => (listening ? stop() : void start())}
          disabled={impedimento === "carregando"}
          className={cn(
            "grid size-16 place-items-center rounded-full transition-all",
            listening
              ? "bg-destructive text-destructive-foreground animate-pulse shadow-lg"
              : "bg-primary text-primary-foreground hover:scale-105",
            impedimento === "carregando" && "opacity-50",
          )}
          aria-label={listening ? "Parar de ouvir" : "Começar a falar"}
        >
          <Mic className="size-6" />
        </button>
        <p className="text-muted-foreground text-xs">
          {listening ? "Ouvindo — pare de falar e ele encerra" : `Falando em ${LANG[direction].de}`}
        </p>

        {/*
          O teste fica fora do fluxo normal — só aparece quando é preciso
          descobrir POR QUE não ouviu. Junto do botão principal viraria ruído
          para as pessoas em que já funciona.
        */}
        {!listening ? (
          <button
            type="button"
            onClick={() => void testarMicrofone()}
            className="text-muted-foreground hover:text-foreground mt-1 text-xs underline underline-offset-4 transition-colors"
          >
            {testando ? "Parar o teste" : "Não está ouvindo? Testar microfone"}
          </button>
        ) : null}

        {testando ? (
          <div className="border-border bg-muted/20 mt-2 w-full space-y-2 rounded-lg border p-3.5">
            <p className="text-xs font-semibold">Fale agora — a barra tem que mexer</p>
            <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-75",
                  nivel > 6 ? "bg-primary" : "bg-muted-foreground/40",
                )}
                style={{ width: `${Math.max(2, nivel)}%` }}
              />
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Captando por: <strong className="text-foreground">{dispositivo}</strong>
              <br />
              Barra parada enquanto você fala? O microfone padrão do navegador é outro. Troque em{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-[0.7rem]">
                chrome://settings/content/microphone
              </code>{" "}
              — o reconhecimento de voz usa sempre o padrão e não deixa escolher.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
