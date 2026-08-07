"use server";

import { Type, type Schema } from "@google/genai";
import { z } from "zod";

import { requireActiveUser } from "@/lib/auth/guards";
import { geminiModels } from "@/lib/env";
import { gemini, parseJsonResponse, withRetry } from "@/lib/gemini/client";

// ---------------------------------------------------------------------------
// Schemas de validação
// ---------------------------------------------------------------------------

const DIRECTIONS = ["en→pt", "pt→en"] as const;
type Direction = (typeof DIRECTIONS)[number];

const inputSchema = z.object({
  text: z.string().min(1).max(1000),
  direction: z.enum(DIRECTIONS),
});

// ---------------------------------------------------------------------------
// Schema de resposta do Gemini
// ---------------------------------------------------------------------------

const TRANSLATION_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["translation", "examples"],
  properties: {
    translation: {
      type: Type.STRING,
      description: "The translated text",
    },
    phonetic_pt: {
      type: Type.STRING,
      description:
        "Phonetic pronunciation spelled out intuitively for a native Brazilian Portuguese speaker (e.g., 'tu-guÉ-der' for 'together'). Capitalize the stressed syllable.",
    },
    ipa: {
      type: Type.STRING,
      description:
        "IPA pronunciation of the SOURCE text (only when source is English). Empty string otherwise.",
    },
    examples: {
      type: Type.ARRAY,
      description: "1 to 3 short example sentences showing the source word/phrase in context",
      items: {
        type: Type.OBJECT,
        required: ["source", "translated"],
        properties: {
          source: { type: Type.STRING },
          translated: { type: Type.STRING },
        },
      },
    },
  },
};

interface TranslationResult {
  translation: string;
  phonetic_pt?: string;
  ipa?: string;
  examples: { source: string; translated: string }[];
}

export interface TranslateResponse {
  ok: true;
  translation: string;
  phonetic_pt: string;
  ipa: string;
  examples: { source: string; translated: string }[];
}

export interface TranslateErrorResponse {
  ok: false;
  error: string;
}

// ---------------------------------------------------------------------------
// Action principal
// ---------------------------------------------------------------------------

/**
 * Traduz um texto usando o Gemini e devolve tradução, IPA e exemplos.
 *
 * O modelo `tutor` (flash-lite) é deliberadamente leve: tradução é uma tarefa
 * simples e não precisa do modelo mais forte. Para um aluno que usa o tradutor
 * dezenas de vezes ao dia, manter o custo baixo é importante.
 */
export async function translateAction(
  text: string,
  direction: Direction,
): Promise<TranslateResponse | TranslateErrorResponse> {
  // Autenticação: o tradutor é funcionalidade do app, não pública.
  await requireActiveUser("/app/tradutor");

  const parsed = inputSchema.safeParse({ text, direction });
  if (!parsed.success) {
    return { ok: false, error: "Texto inválido ou muito longo (máximo 1000 caracteres)." };
  }

  const { text: sourceText, direction: dir } = parsed.data;
  const isEnToPt = dir === "en→pt";
  const sourceLang = isEnToPt ? "English" : "Brazilian Portuguese";
  const targetLang = isEnToPt ? "Brazilian Portuguese" : "English";

  const systemInstruction = `
You are a professional translator specializing in ${sourceLang} to ${targetLang} translation
for Brazilian English learners.

Return a JSON object with:
- "translation": the translated text, natural and idiomatic
- "phonetic_pt": intuitive phonetic pronunciation spelled out for a Brazilian Portuguese native speaker (e.g., for "together" return "tu-guÉ-der", for "apple" return "É-pou"). Always mark the stressed syllable with UPPERCASE and accents if needed. If source is Portuguese or text is a long paragraph, return empty string.
- "ipa": IPA transcription of the SOURCE text (only when source is English). Empty string otherwise.
- "examples": 1 to 3 short example sentences using the source word/phrase in context,
  each with "source" (${sourceLang}) and "translated" (${targetLang}).
  Keep examples brief and practical. If the input is a long paragraph, return an empty array.

Be accurate. Prefer natural phrasing over word-for-word translation.
`.trim();

  try {
    const response = await withRetry(() =>
      gemini().models.generateContent({
        model: geminiModels.tutor,
        contents: [
          {
            role: "user",
            parts: [{ text: `Translate from ${sourceLang} to ${targetLang}:\n\n${sourceText}` }],
          },
        ],
        config: {
          systemInstruction,
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: TRANSLATION_SCHEMA,
        },
      }),
    );

    const result = parseJsonResponse<TranslationResult>(response.text);

    if (!result?.translation) {
      return { ok: false, error: "Não foi possível obter a tradução. Tente novamente." };
    }

    return {
      ok: true,
      translation: result.translation,
      phonetic_pt: result.phonetic_pt ?? "",
      ipa: result.ipa ?? "",
      examples: Array.isArray(result.examples) ? result.examples.slice(0, 3) : [],
    };
  } catch (error) {
    console.error("[tradutor] falha na tradução:", error instanceof Error ? error.message : error);
    return {
      ok: false,
      error: "Erro ao traduzir. Verifique sua conexão e tente novamente.",
    };
  }
}

// ---------------------------------------------------------------------------
// Tradução da fala ao vivo
// ---------------------------------------------------------------------------

export interface SpeechTranslateResponse {
  ok: true;
  translation: string;
}

/** Um campo só: é o que segura o modelo no assunto. Ver o comentário abaixo. */
const SPEECH_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["translation"],
  properties: { translation: { type: Type.STRING } },
};

/**
 * Traduz um trecho reconhecido pelo microfone. Só a tradução, nada mais.
 *
 * Existe separada de `translateAction` por causa da LATÊNCIA, não do custo. A
 * action completa pede IPA, fonética e exemplos: são 353 tokens por chamada,
 * medidos, contra 27 desta — e o que o modelo demora para responder é
 * proporcional ao que ele precisa escrever. Numa tela em que a pessoa fala e
 * espera ver a tradução aparecer, cada palavra a mais na resposta é atraso
 * visível.
 *
 * O aluno que quiser IPA e exemplos digita a palavra no tradutor de cima, que
 * continua completo.
 */
export async function translateSpeechAction(
  text: string,
  direction: Direction,
): Promise<SpeechTranslateResponse | TranslateErrorResponse> {
  await requireActiveUser("/app/tradutor");

  const parsed = inputSchema.safeParse({ text, direction });
  if (!parsed.success) {
    return { ok: false, error: "Trecho inválido ou muito longo." };
  }

  const { text: sourceText, direction: dir } = parsed.data;
  const [de, para] =
    dir === "en→pt" ? ["English", "Brazilian Portuguese"] : ["Brazilian Portuguese", "English"];

  try {
    const response = await withRetry(() =>
      gemini().models.generateContent({
        model: geminiModels.tutor,
        contents: [{ role: "user", parts: [{ text: sourceText }] }],
        config: {
          // A instrução vive aqui, e não no `contents`, para o texto do aluno
          // chegar limpo: fala reconhecida já vem sem pontuação confiável, e
          // misturar instrução com transcrição fazia o modelo às vezes traduzir
          // a própria instrução.
          /**
           * A ordem de pontuar não é firula. A fala reconhecida chega crua —
           * "hi im ana nice to meet you" — e o modelo espelhava isso na
           * resposta, devolvendo "oi, eu sou a ana" em caixa baixa. Frases
           * longas ele pontuava, curtas não: a tela ficava com dois padrões.
           */
          systemInstruction:
            `Translate from ${de} to ${para}. Natural, spoken register. ` +
            `The input comes from speech recognition, so it has no punctuation ` +
            `or capitalization — your output must have both, written properly.`,
          /**
           * Saída estruturada, e não texto puro com "responda só a tradução".
           *
           * Medido contra o modelo: em texto puro ele ignorava a instrução e
           * respondia "Aqui estão algumas opções, da mais comum para a mais
           * informal...", e numa frase comum devolvia `MALFORMED_RESPONSE`
           * três vezes em três tentativas. O schema resolve por construção —
           * um campo, uma string — e ainda saiu MAIS rápido (871ms contra
           * 973ms), porque o modelo não escreve preâmbulo.
           */
          responseMimeType: "application/json",
          responseSchema: SPEECH_SCHEMA,
          /**
           * Sem raciocínio: traduzir uma frase falada não precisa, e ele
           * custava ~110ms por chamada numa tela em que a pessoa espera olhando.
           */
          thinkingConfig: { thinkingBudget: 0 },
          temperature: 0,
        },
      }),
    );

    const translation = parseJsonResponse<{ translation?: string }>(response.text)?.translation?.trim();
    if (!translation) return { ok: false, error: "Não consegui traduzir esse trecho." };

    return { ok: true, translation };
  } catch (error) {
    console.error("[tradutor] falha na fala:", error instanceof Error ? error.message : error);
    return { ok: false, error: "Erro ao traduzir. Verifique sua conexão." };
  }
}
