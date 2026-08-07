/**
 * Infraestrutura comum dos scripts de CLI.
 *
 * Os scripts rodam fora do Next (via tsx), então NÃO podem importar os módulos
 * marcados com "server-only". Aqui montamos os clientes na mão.
 */

import { readFileSync } from "node:fs";

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

/**
 * Cliente da geração de áudio, com chave PRÓPRIA quando houver.
 *
 * Ativar cobrança num projeto do Google apaga o nível gratuito dele inteiro —
 * e o app usa a mesma chave para a tutora ao vivo, o retorno de pronúncia e os
 * embeddings. Pagar pelo TTS não pode custar o gratuito de tudo mais.
 *
 * Com `GEMINI_TTS_API_KEY` apontando para um SEGUNDO projeto (esse sim com
 * cobrança), o lote de áudio roda no nível pago e o app continua no gratuito.
 * Sem ela, cai na chave normal e nada muda.
 */
export function genaiTts() {
  const dedicated = process.env.GEMINI_TTS_API_KEY?.trim();
  return new GoogleGenAI({ apiKey: dedicated || env("GEMINI_API_KEY") });
}

/** True quando a geração de áudio está usando a chave dedicada. */
export function usingDedicatedTtsKey(): boolean {
  return Boolean(process.env.GEMINI_TTS_API_KEY?.trim());
}

/**
 * Cliente de TTS pelo Vertex AI — os MESMOS modelos, outra contabilidade.
 *
 * A Gemini API limita os modelos de TTS por REQUISIÇÕES POR DIA: 100 no
 * nível 1, conforme o painel de limites. São 500 áudios no curso, então o lote
 * levava dias — e comprar mais crédito não muda nada, porque o teto conta
 * chamadas, não dinheiro.
 *
 * O Vertex serve os mesmos modelos contando por minuto em vez de por dia.
 * Medido contra este projeto: 20 chamadas simultâneas passaram em 2,8s
 * enquanto a chave de API já recusava havia horas.
 *
 * Autentica por conta de serviço (`VERTEX_CREDENTIALS` aponta o JSON) ou pelas
 * credenciais padrão do ambiente. Sem nenhuma das duas devolve null e o lote
 * segue pela chave de API, como antes.
 */
export function vertexTts(): GoogleGenAI | null {
  const configured = process.env.VERTEX_CREDENTIALS?.trim();
  const keyFile = configured || process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!keyFile) return null;

  // A biblioteca de autenticação lê esta variável; VERTEX_CREDENTIALS existe
  // só para dar um nome próprio ao arquivo do TTS e não brigar com outra
  // credencial que o ambiente já use.
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFile;

  let project = process.env.VERTEX_PROJECT?.trim();
  if (!project) {
    // Sem cair de volta na chave de API em silêncio: quem apontou uma
    // credencial quer o Vertex, e degradar sem avisar devolveria o lote ao
    // teto diário sem nenhum sinal de que foi isso que aconteceu.
    try {
      project = JSON.parse(readFileSync(keyFile, "utf8")).project_id;
    } catch (error) {
      console.error(
        `\n✗ Não consegui ler a credencial do Vertex em ${keyFile}\n` +
          `  ${(error as Error).message}\n` +
          `  Corrija o caminho em VERTEX_CREDENTIALS ou informe VERTEX_PROJECT.\n`,
      );
      process.exit(1);
    }
  }
  if (!project) {
    console.error(
      `\n✗ ${keyFile} não traz "project_id".\n  Informe o projeto em VERTEX_PROJECT.\n`,
    );
    process.exit(1);
  }

  return new GoogleGenAI({
    vertexai: true,
    project,
    // "global" reparte a carga entre regiões — é o que aguentou a rajada sem
    // recusar nenhuma das 20 chamadas.
    location: process.env.VERTEX_LOCATION?.trim() || "global",
  });
}

/** True quando o lote de áudio está indo pelo Vertex. */
export function usingVertexTts(): boolean {
  return Boolean(
    process.env.VERTEX_CREDENTIALS?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
  );
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
