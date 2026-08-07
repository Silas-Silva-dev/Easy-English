"use client";

/**
 * Tradução de fala ao vivo.
 *
 * ===========================================================================
 * POR QUE O RECONHECIMENTO NÃO PASSA PELO SERVIDOR
 * ===========================================================================
 * O caminho óbvio seria gravar o áudio e mandar para o Gemini transcrever e
 * traduzir numa chamada só. Funciona — testei, o `flash-lite` transcreve e
 * traduz corretamente — mas custa ~2,4 segundos por fala, e a latência é
 * quase constante: 2.375ms para um áudio de 1,6s, 2.670ms para um de 16,4s.
 * Ou seja, você fala dois segundos e espera outros dois olhando para a tela.
 *
 * O Google Tradutor parece instantâneo porque NÃO manda áudio para lugar
 * nenhum: reconhece a fala no próprio aparelho e vai escrevendo enquanto a
 * pessoa fala. É o que este componente faz, pela Web Speech API. O texto em
 * inglês aparece com zero rede, zero cota e zero custo.
 *
 * O Gemini entra só depois, para traduzir a frase já pronta: ~700ms sobre
 * texto, contra ~2.400ms sobre áudio.
 *
 * Efeito colateral bom: o inglês é o que o navegador ouviu, então quando o
 * aluno pronuncia errado ele VÊ o erro — a tela mostra a palavra que ele
 * falou, não a que ele quis falar.
 *
 * ===========================================================================
 * SUPORTE
 * ===========================================================================
 * Chrome, Edge e Safari, incluindo Chrome no Android. O Firefox não implementa
 * a API: lá o painel avisa e o aluno usa o tradutor de texto acima, em vez de
 * ficar com um botão que não faz nada.
 */

import { AlertCircle, Copy, Loader2, Mic, MicOff, Trash2, Volume2 } from "lucide-react";
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

// ---------------------------------------------------------------------------

type Direction = "en→pt" | "pt→en";

interface Segment {
  id: number;
  source: string;
  translation: string | null;
  failed?: boolean;
}

const LANG: Record<Direction, { recog: string; speak: string; de: string; para: string }> = {
  "en→pt": { recog: "en-US", speak: "pt-BR", de: "Inglês", para: "Português (Brasil)" },
  "pt→en": { recog: "pt-BR", speak: "en-US", de: "Português (Brasil)", para: "Inglês" },
};

export function VoiceTranslator() {
  const [supported, setSupported] = React.useState<boolean | null>(null);
  const [listening, setListening] = React.useState(false);
  const [direction, setDirection] = React.useState<Direction>("en→pt");
  const [interim, setInterim] = React.useState("");
  const [segments, setSegments] = React.useState<Segment[]>([]);

  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  /** O usuário ainda quer ouvir? Sobrevive ao `onend` automático do Chrome. */
  const wantListeningRef = React.useRef(false);
  const nextIdRef = React.useRef(0);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [segments, interim]);

  /**
   * Traduz um trecho já finalizado.
   *
   * Cada trecho vira uma requisição independente, identificada pelo id: duas
   * falas seguidas podem estar em tradução ao mesmo tempo, e a que responder
   * primeiro não pode escrever no lugar da outra.
   */
  const translate = React.useCallback(
    async (id: number, texto: string, dir: Direction) => {
      const resposta = await translateSpeechAction(texto, dir);
      setSegments((atual) =>
        atual.map((s) =>
          s.id === id
            ? resposta.ok
              ? { ...s, translation: resposta.translation }
              : { ...s, translation: null, failed: true }
            : s,
        ),
      );
    },
    [],
  );

  const stop = React.useCallback(() => {
    wantListeningRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  const start = React.useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = LANG[direction].recog;
    // `continuous` mantém a escuta entre frases; `interimResults` é o que faz
    // a palavra aparecer enquanto ainda está sendo dita.
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
          setSegments((atual) => [...atual, { id, source: limpo, translation: null }]);
          void translate(id, limpo, direction);
        } else {
          parcial += texto;
        }
      }
      setInterim(parcial);
    };

    recognition.onerror = (event) => {
      // `no-speech` e `aborted` são rotina: silêncio e parada manual. Avisar
      // seria ruído. Permissão negada precisa de texto, senão o botão parece
      // quebrado.
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast.error("Permita o acesso ao microfone para usar a tradução por voz.");
        wantListeningRef.current = false;
        setListening(false);
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        toast.error("O reconhecimento de voz falhou. Tente de novo.");
      }
    };

    // O Chrome encerra sozinho depois de alguns segundos de silêncio, mesmo com
    // `continuous`. Sem religar aqui, o microfone morre calado no meio do uso.
    recognition.onend = () => {
      if (wantListeningRef.current) {
        try {
          recognition.start();
        } catch {
          setListening(false);
        }
      }
    };

    recognitionRef.current = recognition;
    wantListeningRef.current = true;
    try {
      recognition.start();
      setListening(true);
    } catch {
      toast.error("Não consegui iniciar o microfone.");
    }
  }, [direction, translate]);

  // Trocar de idioma no meio da escuta exige recriar o reconhecedor: `lang` só
  // é lido no `start()`.
  React.useEffect(() => {
    if (!listening) return;
    stop();
    const t = setTimeout(start, 120);
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

  if (supported === false) {
    return (
      <div className="border-border bg-muted/30 flex items-start gap-3 rounded-xl border p-5">
        <AlertCircle className="text-muted-foreground mt-0.5 size-5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Seu navegador não reconhece voz</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            A tradução por voz precisa do Chrome, Edge ou Safari — no computador ou no celular. No
            Firefox, use o tradutor de texto acima: ele faz a mesma tradução, com IPA e exemplos.
          </p>
        </div>
      </div>
    );
  }

  const temConteudo = segments.length > 0 || interim.length > 0;

  return (
    <div className="border-border bg-card space-y-4 rounded-xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Falar e traduzir</p>
          <p className="text-muted-foreground text-xs">
            Fale à vontade: o texto aparece enquanto você fala.
          </p>
        </div>

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
              ) : s.failed ? (
                <p className="text-destructive text-sm">Não consegui traduzir este trecho.</p>
              ) : (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="size-3.5 animate-spin" />
                  traduzindo…
                </p>
              )}
            </div>
          </div>
        ))}

        {/* O que ainda está sendo dito: sem rede, aparece letra a letra. */}
        {interim ? (
          <div className="border-border/60 border border-dashed bg-transparent px-3.5 py-3 rounded-lg">
            <p className="text-muted-foreground text-[0.95rem] leading-snug italic">{interim}</p>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={listening ? stop : start}
          disabled={supported === null}
          className={cn(
            "grid size-16 place-items-center rounded-full transition-all",
            listening
              ? "bg-destructive text-destructive-foreground scale-105 shadow-lg"
              : "bg-primary text-primary-foreground hover:scale-105",
            supported === null && "opacity-50",
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
