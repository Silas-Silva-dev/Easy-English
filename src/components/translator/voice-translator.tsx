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
 * constante: 2.375ms para um áudio de 1,6s, 2.670ms para um de 16,4s. Você
 * fala dois segundos e espera outros dois olhando para a tela.
 *
 * A Web Speech API resolve o reconhecimento fora do nosso caminho: o texto
 * aparece enquanto a pessoa fala, sem consumir a nossa cota e sem passar pelo
 * nosso servidor. (No Chrome do computador o áudio vai para o serviço de voz
 * do Google, não fica no aparelho — o que muda para nós é que não é a nossa
 * chave nem a nossa cota.)
 *
 * O Gemini entra só depois, para traduzir a frase já pronta: ~890ms sobre
 * texto, contra ~2.400ms sobre áudio.
 *
 * Efeito colateral bom: o texto é o que o reconhecedor OUVIU, então quem
 * pronuncia errado vê a palavra que falou, não a que quis falar.
 *
 * ===========================================================================
 * REQUISITOS QUE FALHAM CALADOS
 * ===========================================================================
 * A API exige contexto seguro (https, ou localhost) e permissão de microfone.
 * Faltando qualquer um dos dois, `start()` não reclama: o botão acende, o
 * aluno fala e nada acontece. Por isso o componente confere o contexto antes
 * de oferecer o botão e pede a permissão explicitamente pelo `getUserMedia`,
 * que é o único jeito de garantir que o navegador mostre o pedido.
 */

import { AlertCircle, Copy, Loader2, Mic, MicOff, RotateCw, Trash2, Volume2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { translateSpeechAction } from "@/app/app/tradutor/actions";
import { Button } from "@/components/ui/button";
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
  message?: string;
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
  onstart: (() => void) | null;
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

/** Por que o painel não pode funcionar aqui. Null = pode. */
type Impedimento = "sem-api" | "sem-https" | null;

function detectarImpedimento(): Impedimento {
  if (typeof window === "undefined") return null;
  // Contexto inseguro derruba a API antes de qualquer permissão. `localhost`
  // conta como seguro; um IP da rede local em http, não — e é exatamente o
  // caso de quem testa o app pelo celular apontando para a máquina de casa.
  if (!window.isSecureContext) return "sem-https";
  if (!getRecognitionCtor()) return "sem-api";
  return null;
}

// ---------------------------------------------------------------------------

type Direction = "en→pt" | "pt→en";

interface Segment {
  id: number;
  source: string;
  translation: string | null;
  /** A mensagem real do servidor. Sem ela, todo defeito vira "não consegui". */
  error?: string;
  translating: boolean;
}

const LANG: Record<Direction, { recog: string; speak: string; de: string }> = {
  "en→pt": { recog: "en-US", speak: "pt-BR", de: "inglês" },
  "pt→en": { recog: "pt-BR", speak: "en-US", de: "português" },
};

export function VoiceTranslator() {
  const [impedimento, setImpedimento] = React.useState<Impedimento | "carregando">("carregando");
  const [listening, setListening] = React.useState(false);
  const [direction, setDirection] = React.useState<Direction>("en→pt");
  const [interim, setInterim] = React.useState("");
  const [segments, setSegments] = React.useState<Segment[]>([]);
  /** Erro do microfone em si, mostrado no painel em vez de num toast que some. */
  const [micError, setMicError] = React.useState<string | null>(null);

  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = React.useRef(false);
  const nextIdRef = React.useRef(0);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setImpedimento(detectarImpedimento());
  }, []);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [segments, interim]);

  /**
   * Traduz um trecho já finalizado.
   *
   * Cada trecho é uma requisição independente, identificada pelo id: duas falas
   * seguidas podem estar em tradução ao mesmo tempo, e a que responder primeiro
   * não pode escrever no lugar da outra.
   */
  const translate = React.useCallback(async (id: number, texto: string, dir: Direction) => {
    setSegments((atual) =>
      atual.map((s) => (s.id === id ? { ...s, translating: true, error: undefined } : s)),
    );

    let resultado: { translation?: string; error?: string };
    try {
      const resposta = await translateSpeechAction(texto, dir);
      resultado = resposta.ok
        ? { translation: resposta.translation }
        : { error: resposta.error };
    } catch (e) {
      // Server Action que estoura (sessão expirada, rede caída) rejeita a
      // promessa. Sem este catch o trecho ficava em "traduzindo…" para sempre.
      resultado = { error: e instanceof Error ? e.message : "Falha de conexão com o servidor." };
    }

    setSegments((atual) =>
      atual.map((s) =>
        s.id === id
          ? { ...s, translating: false, translation: resultado.translation ?? null, error: resultado.error }
          : s,
      ),
    );
  }, []);

  const stop = React.useCallback(() => {
    wantListeningRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  const start = React.useCallback(async () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    setMicError(null);

    /**
     * Pede o microfone ANTES de ligar o reconhecimento.
     *
     * O `start()` da Web Speech API não espera permissão nem avisa quando ela
     * falta: acende o botão e fica mudo. `getUserMedia` força o navegador a
     * mostrar o pedido e devolve um erro nomeado quando o aluno nega ou quando
     * não existe microfone.
     */
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Solta na hora: quem abre o microfone de verdade é o reconhecedor, e
      // deixar esta trilha viva mantém o indicador de gravação aceso à toa.
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      const nome = e instanceof DOMException ? e.name : "";
      setMicError(
        nome === "NotAllowedError"
          ? "Permissão de microfone negada. Libere o microfone para este site nas configurações do navegador e tente de novo."
          : nome === "NotFoundError"
            ? "Nenhum microfone encontrado neste dispositivo."
            : `Não consegui abrir o microfone${nome ? ` (${nome})` : ""}.`,
      );
      return;
    }

    const recognition = new Ctor();
    recognition.lang = LANG[direction].recog;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let parcial = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const resultado = event.results[i];
        const texto = resultado[0]?.transcript ?? "";
        if (resultado.isFinal) {
          const limpo = texto.trim();
          if (!limpo) continue;
          const id = nextIdRef.current++;
          setSegments((atual) => [
            ...atual,
            { id, source: limpo, translation: null, translating: true },
          ]);
          void translate(id, limpo, direction);
        } else {
          parcial += texto;
        }
      }
      setInterim(parcial);
    };

    recognition.onerror = (event) => {
      // `no-speech` e `aborted` são rotina: silêncio e parada manual.
      if (event.error === "no-speech" || event.error === "aborted") return;

      wantListeningRef.current = false;
      setListening(false);
      setMicError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "O navegador bloqueou o microfone para este site."
          : event.error === "network"
            ? "O reconhecimento de voz precisa de internet e a conexão falhou."
            : `O reconhecimento falhou (${event.error}).`,
      );
    };

    // O Chrome encerra sozinho depois de alguns segundos de silêncio, mesmo com
    // `continuous`. Sem religar aqui, o microfone morre calado no meio do uso.
    recognition.onend = () => {
      if (!wantListeningRef.current) return;
      try {
        recognition.start();
      } catch {
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    wantListeningRef.current = true;
    try {
      recognition.start();
      setListening(true);
    } catch (e) {
      setMicError(`Não consegui iniciar o reconhecimento: ${e instanceof Error ? e.message : e}`);
    }
  }, [direction, translate]);

  // Trocar de idioma no meio da escuta exige recriar o reconhecedor: `lang` só
  // é lido no `start()`.
  React.useEffect(() => {
    if (!listening) return;
    stop();
    const t = setTimeout(() => void start(), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  React.useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      recognitionRef.current?.abort();
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

  const temConteudo = segments.length > 0 || interim.length > 0;

  return (
    <div className="border-border bg-card space-y-4 rounded-xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Fale à vontade: o texto aparece enquanto você fala.
        </p>

        <div className="flex items-center gap-2">
          <div className="border-border flex overflow-hidden rounded-lg border text-xs font-medium">
            {(["en→pt", "pt→en"] as Direction[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
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

          {segments.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSegments([]);
                setInterim("");
              }}
              aria-label="Limpar"
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {micError ? (
        <div className="border-destructive/40 bg-destructive/5 flex items-start gap-2.5 rounded-lg border p-3.5">
          <AlertCircle className="text-destructive mt-0.5 size-4 shrink-0" />
          <p className="text-destructive text-sm leading-relaxed">{micError}</p>
        </div>
      ) : null}

      <div
        className={cn(
          "bg-muted/20 max-h-[26rem] space-y-3 overflow-y-auto rounded-lg p-4",
          !temConteudo && "grid place-items-center py-10",
        )}
      >
        {!temConteudo ? (
          <p className="text-muted-foreground text-center text-sm">
            {listening ? "Ouvindo… pode falar." : "Toque no microfone e comece a falar."}
          </p>
        ) : null}

        {segments.map((s) => (
          <div key={s.id} className="border-border bg-card space-y-2 rounded-lg border p-3.5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[0.95rem] leading-snug font-medium">{s.source}</p>
              <button
                type="button"
                onClick={() => falar(s.source, LANG[direction].recog)}
                className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                aria-label="Ouvir o original"
              >
                <Volume2 className="size-4" />
              </button>
            </div>

            <div className="border-primary/30 border-t pt-2">
              {s.translation ? (
                <div className="flex items-start justify-between gap-3">
                  <p className="text-primary text-[0.95rem] leading-snug">{s.translation}</p>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => falar(s.translation!, LANG[direction].speak)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Ouvir a tradução"
                    >
                      <Volume2 className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(s.translation!);
                        toast.success("Tradução copiada.");
                      }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Copiar"
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                </div>
              ) : s.translating ? (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="size-3.5 animate-spin" />
                  traduzindo…
                </p>
              ) : (
                /*
                  A mensagem do servidor, inteira. A primeira versão mostrava
                  "Não consegui traduzir este trecho." para qualquer defeito, e
                  com isso um erro de sessão, um de cota e um de rede ficavam
                  indistinguíveis — inclusive para quem foi depurar.
                */
                <div className="space-y-1.5">
                  <p className="text-destructive text-sm leading-relaxed">
                    {s.error ?? "Não consegui traduzir este trecho."}
                  </p>
                  <button
                    type="button"
                    onClick={() => void translate(s.id, s.source, direction)}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
                  >
                    <RotateCw className="size-3.5" />
                    Tentar de novo
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* O que ainda está sendo dito: sem rede, aparece enquanto se fala. */}
        {interim ? (
          <div className="border-border/60 rounded-lg border border-dashed bg-transparent px-3.5 py-3">
            <p className="text-muted-foreground text-[0.95rem] leading-snug italic">{interim}</p>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => (listening ? stop() : void start())}
          disabled={impedimento === "carregando"}
          className={cn(
            "grid size-16 place-items-center rounded-full transition-all",
            listening
              ? "bg-destructive text-destructive-foreground scale-105 shadow-lg"
              : "bg-primary text-primary-foreground hover:scale-105",
            impedimento === "carregando" && "opacity-50",
          )}
          aria-label={listening ? "Parar de ouvir" : "Começar a falar"}
        >
          {listening ? <MicOff className="size-6" /> : <Mic className="size-6" />}
        </button>
        <p className="text-muted-foreground text-xs">
          {listening ? "Ouvindo — toque para parar" : `Falando em ${LANG[direction].de}`}
        </p>
      </div>
    </div>
  );
}
