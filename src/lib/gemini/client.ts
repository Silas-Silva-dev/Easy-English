import "server-only";

import { GoogleGenAI } from "@google/genai";

import { serverEnv } from "@/lib/env";

let cached: GoogleGenAI | null = null;

/** Instancia unica do SDK do Gemini. Somente servidor — a chave nunca vai ao browser. */
export function gemini(): GoogleGenAI {
  cached ??= new GoogleGenAI({ apiKey: serverEnv.geminiApiKey });
  return cached;
}

/**
 * Extrai o JSON de uma resposta estruturada, tolerando cercas markdown que o
 * modelo eventualmente adiciona mesmo com responseMimeType JSON.
 */
export function parseJsonResponse<T>(raw: string | undefined): T {
  if (!raw) throw new Error("Resposta vazia do Gemini");

  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error(`Nao foi possivel interpretar o JSON retornado pelo Gemini: ${raw.slice(0, 200)}`);
  }
}

/** Retenta chamadas que falharam por rate limit ou indisponibilidade temporaria. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, baseDelayMs = 800 }: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retriable = /\b(429|500|502|503|504)\b|overloaded|rate.?limit|unavailable|deadline/i.test(
        message,
      );
      if (!retriable || attempt === attempts - 1) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }

  throw lastError;
}
