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
