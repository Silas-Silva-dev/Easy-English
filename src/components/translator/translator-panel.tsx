"use client";

import {
  AlertCircle,
  ArrowLeftRight,
  BookOpen,
  Copy,
  Eraser,
  Languages,
  Loader2,
  Volume2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { translateAction, type TranslateResponse } from "@/app/app/tradutor/actions";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Direction = "en→pt" | "pt→en";

interface HistoryEntry {
  id: number;
  source: string;
  direction: Direction;
  result: TranslateResponse;
}

interface Suggestion {
  word: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Datamuse API — sugestões de palavras (gratuita, sem chave, <50ms)
// https://www.datamuse.com/api/
// ---------------------------------------------------------------------------

const DATAMUSE_CACHE = new Map<string, Suggestion[]>();

async function fetchSuggestions(
  query: string,
  lang: "en" | "pt",
): Promise<Suggestion[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed || trimmed.length < 2) return [];

  const cacheKey = `${lang}:${trimmed}`;
  if (DATAMUSE_CACHE.has(cacheKey)) return DATAMUSE_CACHE.get(cacheKey)!;

  try {
    const langParam = lang === "pt" ? "&v=pt" : "";
    const url = `https://api.datamuse.com/sug?s=${encodeURIComponent(trimmed)}&max=8${langParam}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { word: string; score: number }[];
    const suggestions = data.map((d) => ({ word: d.word, score: d.score }));
    DATAMUSE_CACHE.set(cacheKey, suggestions);
    return suggestions;
  } catch {
    return [];
  }
}

/**
 * Verifica se uma palavra existe no dicionário.
 * Retorna `true` se for encontrada com score alto (palavra real).
 */
async function checkWordExists(word: string, lang: "en" | "pt"): Promise<boolean> {
  const trimmed = word.trim().toLowerCase();
  if (!trimmed || trimmed.split(/\s+/).length > 1) return true; // não valida frases
  try {
    const langParam = lang === "pt" ? "&v=pt" : "";
    const url = `https://api.datamuse.com/words?sp=${encodeURIComponent(trimmed)}&max=1${langParam}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return true;
    const data = (await res.json()) as { word: string; score: number }[];
    // Aceita se existe uma palavra com ortografia idêntica
    return data.some((d) => d.word.toLowerCase() === trimmed);
  } catch {
    return true; // em caso de falha de rede, não exibe erro falso
  }
}

// ---------------------------------------------------------------------------
// Hook de sugestões com debounce
// ---------------------------------------------------------------------------

function useSuggestions(text: string, direction: Direction) {
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [wordInvalid, setWordInvalid] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lang = direction === "en→pt" ? "en" : "pt";

  // Extrai a última palavra sendo digitada
  const lastWord = text.trimEnd().split(/\s+/).pop() ?? "";
  const isSingleWord = text.trim().split(/\s+/).length === 1;

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Reseta estados quando campo vazio
    if (!lastWord || lastWord.length < 2) {
      setSuggestions([]);
      setWordInvalid(false);
      setChecking(false);
      return;
    }

    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      const [sugs, exists] = await Promise.all([
        fetchSuggestions(lastWord, lang),
        isSingleWord ? checkWordExists(lastWord, lang) : Promise.resolve(true),
      ]);

      setSuggestions(sugs);
      // Só marca como inválida palavras únicas que não existem e sem sugestão exata
      setWordInvalid(!exists && isSingleWord);
      setChecking(false);
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [lastWord, lang, isSingleWord]);

  return { suggestions, wordInvalid, checking, lastWord };
}

// ---------------------------------------------------------------------------
// Hook de Web Speech API
// ---------------------------------------------------------------------------

function useSpeech() {
  const speak = React.useCallback((text: string, lang: "en-US" | "pt-BR") => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Seu navegador não suporta síntese de fala.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const native = voices.find((v) => v.lang.startsWith(lang.split("-")[0]) && v.localService);
    if (native) utterance.voice = native;
    window.speechSynthesis.speak(utterance);
  }, []);
  return { speak };
}

// ---------------------------------------------------------------------------
// Dropdown de sugestões
// ---------------------------------------------------------------------------

function SuggestionsDropdown({
  suggestions,
  visible,
  onSelect,
}: {
  suggestions: Suggestion[];
  visible: boolean;
  onSelect: (word: string) => void;
}) {
  if (!visible || suggestions.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Sugestões"
      className="bg-popover border-border absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
    >
      {suggestions.map((sug, i) => (
        <button
          key={sug.word}
          role="option"
          aria-selected={false}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); // evita que o textarea perca o foco
            onSelect(sug.word);
          }}
          className={cn(
            "hover:bg-accent flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm transition-colors",
            i !== 0 && "border-t border-border/50",
          )}
        >
          <span className="font-medium">{sug.word}</span>
          {i === 0 && (
            <Badge variant="neutral" className="ml-auto text-[9px]">
              melhor
            </Badge>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seletor de direção
// ---------------------------------------------------------------------------

function DirectionToggle({
  direction,
  onToggle,
}: {
  direction: Direction;
  onToggle: () => void;
}) {
  const [animating, setAnimating] = React.useState(false);

  function handleToggle() {
    setAnimating(true);
    onToggle();
    setTimeout(() => setAnimating(false), 300);
  }

  const [srcLabel, tgtLabel] =
    direction === "en→pt" ? ["Inglês", "Português"] : ["Português", "Inglês"];

  return (
    <div className="flex items-center gap-2">
      <Badge variant="neutral" className="min-w-[80px] justify-center text-xs font-medium">
        {srcLabel}
      </Badge>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        aria-label="Inverter idiomas"
        className="text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftRight
          className={cn(
            "size-4 transition-transform duration-300",
            animating && "rotate-180",
          )}
        />
      </Button>

      <Badge variant="neutral" className="min-w-[80px] justify-center text-xs font-medium">
        {tgtLabel}
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Botões de ação
// ---------------------------------------------------------------------------

function SpeakButton({
  text,
  lang,
  label,
}: {
  text: string;
  lang: "en-US" | "pt-BR";
  label: string;
}) {
  const { speak } = useSpeech();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => speak(text, lang)}
      aria-label={label}
      className="text-muted-foreground hover:text-foreground gap-1.5"
    >
      <Volume2 className="size-3.5" />
      Ouvir
    </Button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground gap-1.5"
    >
      <Copy className="size-3.5" />
      {copied ? "Copiado!" : "Copiar"}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Painel de resultado
// ---------------------------------------------------------------------------

function ResultPanel({
  source,
  direction,
  result,
}: {
  source: string;
  direction: Direction;
  result: TranslateResponse;
}) {
  const srcLang = direction === "en→pt" ? "en-US" : "pt-BR";
  const tgtLang = direction === "en→pt" ? "pt-BR" : "en-US";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 pb-4">
          <p className="text-lg leading-relaxed font-medium">{result.translation}</p>

          {result.phonetic_pt || result.ipa ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">Como se lê:</span>
              {result.phonetic_pt ? (
                <code className="text-primary bg-primary/10 border-primary/20 border inline-block rounded px-2.5 py-1 font-semibold text-sm">
                  {result.phonetic_pt}
                </code>
              ) : null}
              {result.ipa ? (
                <code className="text-muted-foreground bg-muted inline-block rounded px-2 py-0.5 font-mono text-xs">
                  IPA: {result.ipa}
                </code>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-1 border-t pt-3">
            <SpeakButton text={source} lang={srcLang} label="Ouvir texto original" />
            <SpeakButton text={result.translation} lang={tgtLang} label="Ouvir tradução" />
            <CopyButton text={result.translation} />
          </div>
        </CardContent>
      </Card>

      {result.examples.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpen className="text-primary size-4" />
              Exemplos de uso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.examples.map((ex, i) => (
              <div key={i} className="bg-muted/50 rounded-lg p-3.5">
                <p className="text-sm font-medium">{ex.source}</p>
                <p className="text-muted-foreground mt-0.5 text-sm">{ex.translated}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ResultSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
        <div className="bg-muted h-4 w-1/2 animate-pulse rounded" />
        <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
        <div className="mt-4 flex gap-2 border-t pt-3">
          <div className="bg-muted h-7 w-16 animate-pulse rounded" />
          <div className="bg-muted h-7 w-16 animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Painel principal
// ---------------------------------------------------------------------------

export function TranslatorPanel() {
  const [text, setText] = React.useState("");
  const [direction, setDirection] = React.useState<Direction>("en→pt");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<TranslateResponse | null>(null);
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const historyCounter = React.useRef(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const { suggestions, wordInvalid, checking } = useSuggestions(text, direction);

  const MAX_CHARS = 1000;
  const placeholder =
    direction === "en→pt"
      ? "Digite uma palavra, frase ou parágrafo em inglês…"
      : "Digite uma palavra, frase ou parágrafo em português…";

  function handleToggleDirection() {
    setDirection((d) => (d === "en→pt" ? "pt→en" : "en→pt"));
    setResult(null);
    setSuggestionsClosed(false);
  }

  // Fecha dropdown quando o resultado é exibido
  const [suggestionsClosed, setSuggestionsClosed] = React.useState(false);

  const showDropdown =
    dropdownOpen &&
    !suggestionsClosed &&
    suggestions.length > 0 &&
    text.trim().length >= 2;

  /**
   * Substitui a última palavra digitada pela sugestão selecionada.
   */
  function handleSelectSuggestion(word: string) {
    const words = text.split(/(\s+)/); // preserva espaços
    // Encontra o último token que não é espaço
    let lastNonSpaceIdx = words.length - 1;
    while (lastNonSpaceIdx >= 0 && words[lastNonSpaceIdx].trim() === "") {
      lastNonSpaceIdx--;
    }
    if (lastNonSpaceIdx >= 0) {
      words[lastNonSpaceIdx] = word;
    }
    const newText = words.join("");
    setText(newText);
    setSuggestionsClosed(true);
    setDropdownOpen(false);
    textareaRef.current?.focus();
  }

  function handleClear() {
    setText("");
    setResult(null);
    setSuggestionsClosed(true);
    setDropdownOpen(false);
    textareaRef.current?.focus();
  }

  async function handleTranslate() {
    if (!text.trim()) return;
    setSuggestionsClosed(true);
    setDropdownOpen(false);
    setLoading(true);
    setResult(null);

    const response = await translateAction(text.trim(), direction);
    setLoading(false);

    if (!response.ok) {
      toast.error(response.error);
      return;
    }

    setResult(response);
    setHistory((prev) => {
      const entry: HistoryEntry = {
        id: ++historyCounter.current,
        source: text.trim(),
        direction,
        result: response,
      };
      return [entry, ...prev].slice(0, 10);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      void handleTranslate();
    }
    // Esc fecha o dropdown
    if (e.key === "Escape") {
      setSuggestionsClosed(true);
      setDropdownOpen(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value.slice(0, MAX_CHARS));
    setSuggestionsClosed(false); // reativa sugestões ao digitar de novo
    setDropdownOpen(true);
  }

  const srcLang = direction === "en→pt" ? "en" : "pt";
  const invalidLabel =
    srcLang === "en"
      ? "Palavra não encontrada no dicionário de inglês"
      : "Palavra não encontrada no dicionário de português";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Controles de direção */}
      <div className="flex items-center justify-between gap-3">
        <DirectionToggle direction={direction} onToggle={handleToggleDirection} />
        <span className="text-muted-foreground hidden text-xs sm:inline">
          Ctrl + Enter para traduzir
        </span>
      </div>

      {/* Entrada com sugestões */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          id="translator-input"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => {
            // pequeno delay para permitir o clique na sugestão
            setTimeout(() => setDropdownOpen(false), 150);
          }}
          placeholder={placeholder}
          rows={5}
          // Define o idioma para que o spell-check nativo do navegador
          // use a língua correta. Desativamos o spell-check do browser
          // porque já usamos o Datamuse como sistema próprio — sem isso,
          // palavras inglesas ficam sublinhadas como erro em browsers PT-BR.
          lang={direction === "en→pt" ? "en" : "pt-BR"}
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          className={cn(
            "bg-card w-full resize-none rounded-xl border px-4 py-3.5 text-sm leading-relaxed shadow-sm outline-none transition-colors",
            "placeholder:text-muted-foreground/60",
            wordInvalid
              ? "border-destructive/60 focus:border-destructive focus:ring-2 focus:ring-destructive/20"
              : "focus:border-primary focus:ring-2 focus:ring-primary/20",
          )}
        />

        {/* Contador + indicadores de estado */}
        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          {checking && (
            <Loader2 className="text-muted-foreground size-3 animate-spin" />
          )}
          {wordInvalid && !checking && (
            <AlertCircle className="text-destructive size-3.5" aria-hidden />
          )}
          <span
            className={cn(
              "text-xs tabular-nums",
              text.length >= MAX_CHARS
                ? "text-destructive font-medium"
                : "text-muted-foreground",
            )}
          >
            {text.length}/{MAX_CHARS}
          </span>
        </div>

        {/* Aviso de palavra inválida */}
        {wordInvalid && !checking && (
          <p className="text-destructive mt-1.5 flex items-center gap-1.5 text-xs">
            <AlertCircle className="size-3 shrink-0" />
            {invalidLabel}
          </p>
        )}

        {/* Dropdown de sugestões */}
        <SuggestionsDropdown
          suggestions={suggestions}
          visible={showDropdown}
          onSelect={handleSelectSuggestion}
        />
      </div>

      {/* Botões de ação */}
      <div className="flex items-center gap-3">
        <Button
          size="lg"
          variant="outline"
          onClick={handleClear}
          disabled={(!text && !result) || loading}
          className="shrink-0"
        >
          <Eraser className="size-4" /> Limpar
        </Button>

        <Button
          size="lg"
          variant="gradient"
          className="flex-1"
          onClick={handleTranslate}
          disabled={!text.trim() || loading}
          loading={loading}
        >
          {loading ? (
            "Traduzindo…"
          ) : (
            <>
              <Languages className="size-4" /> Traduzir
            </>
          )}
        </Button>
      </div>

      {/* Resultado */}
      {loading ? <ResultSkeleton /> : null}
      {!loading && result ? (
        <ResultPanel source={text.trim()} direction={direction} result={result} />
      ) : null}

      {/* Histórico da sessão */}
      {history.length > 0 ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Histórico desta sessão
          </p>
          <div className="space-y-2">
            {history.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setText(entry.source);
                  setDirection(entry.direction);
                  setResult(entry.result);
                  setSuggestionsClosed(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="bg-card hover:bg-accent w-full rounded-lg border px-4 py-3 text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="neutral" className="text-[10px]">
                    {entry.direction}
                  </Badge>
                  <span className="text-sm font-medium truncate">{entry.source}</span>
                </div>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {entry.result.translation}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
