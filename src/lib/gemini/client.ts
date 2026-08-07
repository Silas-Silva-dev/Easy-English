import "server-only";

import { GoogleGenAI } from "@google/genai";

import { serverEnv } from "@/lib/env";

let cached: GoogleGenAI | null = null;

/** Instancia unica do SDK do Gemini. Somente servidor: a chave nunca vai ao browser. */
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

/**
 * Achata a cadeia de causas de um erro numa linha so.
 *
 * O `fetch` do Node (undici) resume qualquer falha de transporte como a
 * mensagem inutil "fetch failed" e guarda o motivo de verdade em
 * `error.cause` — as vezes dois niveis abaixo. Sem achatar, tanto a decisao de
 * retentar quanto o `error_message` gravado no banco ficam cegos.
 */
export function descreverErro(error: unknown): string {
  const partes: string[] = [];
  let atual: unknown = error;

  for (let nivel = 0; atual != null && nivel < 5; nivel++) {
    if (atual instanceof Error) {
      const codigo = (atual as { code?: unknown }).code;
      partes.push(typeof codigo === "string" ? `${atual.message} [${codigo}]` : atual.message);
      atual = atual.cause;
    } else {
      partes.push(String(atual));
      break;
    }
  }

  return partes.join(" <- ");
}

/**
 * A requisicao nao chegou a virar resposta: caiu no caminho.
 *
 * Isto NAO e a mesma coisa que um 500 do outro lado — ali houve resposta. Aqui
 * o socket morreu, o DNS falhou ou o handshake nao fechou, e nenhum codigo
 * HTTP existe para reconhecer.
 *
 * O caso que domina a producao e a conexao reaproveitada: o pool guarda o
 * socket aberto, o Google fecha por ociosidade, e a requisicao seguinte
 * escreve num cano morto. Falha em segundos, e a repeticao imediata — que
 * abre outro socket — funciona. Era exatamente isso que o aluno fazia a mao,
 * clicando em "Enviar para correcao" de novo ate passar.
 */
export function erroDeRede(error: unknown): boolean {
  return /fetch failed|socket hang up|other side closed|network error|terminated|ECONNRESET|ECONNREFUSED|ECONNABORTED|ETIMEDOUT|EPIPE|EAI_AGAIN|ENOTFOUND|EHOSTUNREACH|ENETUNREACH|UND_ERR|ERR_STREAM_PREMATURE_CLOSE/i.test(
    descreverErro(error),
  );
}

/**
 * Retenta chamadas que falharam por rate limit ou indisponibilidade temporaria.
 *
 * Alem dos erros de transporte, retenta tambem as duas falhas de FORMATO que os
 * modelos com raciocinio produzem de vez em quando: candidato sem texto (so com
 * "thought parts") e JSON malformado. Nenhuma das duas e permanente — a mesma
 * chamada repetida costuma responder certo —, e tratar as duas como fatais era
 * o que derrubava a analise de fala na primeira tentativa.
 *
 * Para que isso funcione, o `fn` precisa incluir o PARSE da resposta, nao so a
 * chamada de rede: parsear depois do withRetry deixa a falha fora do alcance
 * dele.
 */
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
      // Falha de transporte primeiro: ela nao traz codigo HTTP nenhum, entao
      // a regra abaixo — que so conhece codigos — nunca a reconheceria.
      const rede = erroDeRede(error);
      const retriable =
        rede ||
        /\b(429|500|502|503|504)\b|overloaded|rate.?limit|unavailable|deadline/i.test(message) ||
        /resposta vazia|interpretar o json/i.test(message);
      if (!retriable || attempt === attempts - 1) break;
      // Socket morto nao melhora com espera — o que resolve e abrir outro.
      // Esperar em progressao geometrica so faria o aluno olhar para a tela.
      await new Promise((r) => setTimeout(r, rede ? 250 : baseDelayMs * 2 ** attempt));
    }
  }

  throw lastError;
}
