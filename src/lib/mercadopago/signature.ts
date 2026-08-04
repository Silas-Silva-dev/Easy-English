import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { mercadoPagoEnv } from "@/lib/env";

export type SignatureResult =
  | { ok: true; skipped?: "sandbox" }
  | { ok: false; reason: string };

/** Janela de tolerância do timestamp. Fora dela, a notificação é replay. */
const MAX_AGE_SECONDS = 15 * 60;

function parseSignatureHeader(header: string): { ts?: string; v1?: string } {
  const parts: { ts?: string; v1?: string } = {};
  for (const piece of header.split(",")) {
    const [rawKey, ...rest] = piece.split("=");
    const key = rawKey?.trim();
    const value = rest.join("=").trim();
    if (key === "ts") parts.ts = value;
    if (key === "v1") parts.v1 = value;
  }
  return parts;
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // timingSafeEqual joga se os tamanhos diferem — o que já vaza a diferença.
  // Comparar o tamanho antes é seguro: ele não é segredo.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Valida a assinatura HMAC do webhook do Mercado Pago.
 *
 * Por que isso não é opcional: `/api/pagamentos/webhook` é uma rota pública
 * que libera acesso pago. Sem a validação, um POST forjado com
 * `{"data":{"id":"…"}}` faria a aplicação buscar um pagamento qualquer e
 * conceder o curso. A assinatura prova que a notificação saiu do Mercado
 * Pago, e o `ts` impede que uma notificação legítima e antiga seja reenviada.
 *
 * O manifesto é fixado pelo Mercado Pago, incluindo os pontos-e-vírgulas
 * finais:
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 */
export function verifyWebhookSignature(params: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
}): SignatureResult {
  const { signatureHeader, requestId, dataId } = params;
  const secret = mercadoPagoEnv.webhookSecret;

  if (!secret) {
    /**
     * Sem segredo configurado a rota fica aberta. Em sandbox isso é aceitável
     * (nenhum dinheiro se move e o token de teste não libera nada de real);
     * em produção é uma porta destrancada, então recusamos.
     */
    if (mercadoPagoEnv.isSandbox) return { ok: true, skipped: "sandbox" };
    return { ok: false, reason: "MERCADOPAGO_WEBHOOK_SECRET nao configurado" };
  }

  if (!signatureHeader) return { ok: false, reason: "cabecalho x-signature ausente" };
  if (!dataId) return { ok: false, reason: "data.id ausente" };

  const { ts, v1 } = parseSignatureHeader(signatureHeader);
  if (!ts || !v1) return { ok: false, reason: "x-signature malformado" };

  const timestamp = Number(ts);
  if (!Number.isFinite(timestamp)) return { ok: false, reason: "ts invalido" };

  // O `ts` vem em milissegundos em algumas contas e em segundos em outras.
  const seconds = timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;
  const age = Math.abs(Math.floor(Date.now() / 1000) - seconds);
  if (age > MAX_AGE_SECONDS) return { ok: false, reason: `notificacao expirada (${age}s)` };

  // O Mercado Pago normaliza o id para minúsculas ao assinar.
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId ?? ""};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  if (!safeCompare(expected, v1)) return { ok: false, reason: "assinatura nao confere" };

  return { ok: true };
}
