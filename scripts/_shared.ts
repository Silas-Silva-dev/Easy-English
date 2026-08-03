/**
 * Infraestrutura comum dos scripts de CLI.
 *
 * Os scripts rodam fora do Next (via tsx), então NÃO podem importar os módulos
 * marcados com "server-only". Aqui montamos os clientes na mão.
 */

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

import type { Database } from "@/lib/types/database";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

export const EMBEDDING_DIMENSIONS = 768;

export function env(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  console.error(
    `\n✗ Variável de ambiente ausente: ${name}\n  Copie .env.example para .env.local e preencha os valores.\n`,
  );
  process.exit(1);
}

export function supabaseAdmin() {
  return createClient<Database>(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export function genai() {
  return new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
}

export const MODELS = {
  // Só embedding: os scripts não geram conteúdo, apenas indexam o que já existe.
  embedding: () => env("GEMINI_MODEL_EMBEDDING", "gemini-embedding-001"),
};

/** Barra de progresso simples para operações longas em lote. */
export function progress(done: number, total: number, label = "") {
  const width = 28;
  const filled = Math.round((done / total) * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  const pct = String(Math.round((done / total) * 100)).padStart(3);
  process.stdout.write(`\r  ${bar} ${pct}%  ${done}/${total}  ${label.slice(0, 40).padEnd(40)}`);
  if (done === total) process.stdout.write("\n");
}

export async function withRetry<T>(fn: () => Promise<T>, attempts = 4, baseDelayMs = 1200): Promise<T> {
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
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }

  throw lastError;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Executa tarefas com limite de concorrência, preservando a ordem do resultado. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}
