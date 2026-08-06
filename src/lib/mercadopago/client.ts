import "server-only";

import { mercadoPagoEnv } from "@/lib/env";

const API = "https://api.mercadopago.com";

export class MercadoPagoError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  /**
   * Chave de idempotência. O Mercado Pago devolve a MESMA resposta para a
   * mesma chave: é o que impede que um duplo clique (ou um retry do Next em
   * cima de uma Server Action lenta) crie duas cobranças.
   */
  idempotencyKey?: string;
  signal?: AbortSignal;
  /**
   * Segundos de cache no Data Cache do Next. Só para leitura de dado público
   * e estável (a tabela de parcelamento).
   *
   * Omitir significa `no-store`, e `no-store` CONTAMINA a rota: uma página que
   * chama este fetch deixa de ser pré-renderizável e passa a ser dinâmica. A
   * landing e o /cadastro dependem de continuar estáticas — é o que os
   * cabeçalhos de cache do next.config pressupõem.
   */
  revalidate?: number;
}

/**
 * Chamada crua à API do Mercado Pago.
 *
 * Sem SDK de propósito: são três endpoints, e o pacote oficial arrasta uma
 * dependência que precisaria acompanhar cada bump do Node no deploy.
 */
export async function mpFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, idempotencyKey, signal, revalidate } = options;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${mercadoPagoEnv.accessToken}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;

  // A rede do Mercado Pago cai eventualmente. Sem timeout, a Server Action do
  // checkout fica pendurada até o limite da plataforma e o aluno vê a tela
  // travada sem saber se pagou.
  const timeout = AbortSignal.timeout(15_000);

  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      // Pagamento e preferência nunca são cacheados: um pedido é um evento.
      ...(revalidate === undefined
        ? { cache: "no-store" as const }
        : { next: { revalidate } }),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new MercadoPagoError(`Falha de rede ao falar com o Mercado Pago: ${reason}`, 0, null);
  }

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const detail =
      (payload as { message?: string; error?: string } | null)?.message ??
      (payload as { error?: string } | null)?.error ??
      response.statusText;
    throw new MercadoPagoError(detail || "Erro no Mercado Pago", response.status, payload);
  }

  return payload as T;
}

/** Converte centavos para o número decimal que a API espera (29700 → 297.0). */
export function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Converte o decimal da API para centavos.
 *
 * `Math.round` é obrigatório: `29.7 * 100` dá 2969.9999999999995 em ponto
 * flutuante IEEE-754, e um `Math.trunc` transformaria R$ 29,70 em R$ 29,69.
 */
export function amountToCents(amount: number | null | undefined): number | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}
