import { NextResponse, type NextRequest } from "next/server";

import { getPayment, normalizePayment } from "@/lib/mercadopago/payments";
import { verifyWebhookSignature } from "@/lib/mercadopago/signature";
import { applyPaymentToOrder } from "@/lib/orders";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Nunca cacheado: cada notificação é um evento único.
export const dynamic = "force-dynamic";

/**
 * Webhook de pagamentos do Mercado Pago.
 *
 * É a fonte da verdade sobre quem pagou — o retorno pelo navegador é só
 * conveniência e desaparece se o aluno fechar a aba. Quem paga no PIX e some
 * só é liberado por aqui.
 *
 * SEMPRE responde 200, mesmo quando algo dá errado do nosso lado. O Mercado
 * Pago reenvia por horas o que não recebeu 200 e desativa a URL depois de
 * falhas seguidas: um 500 nosso derrubaria a integração inteira. Erro real vai
 * para o log, e o pedido continua reconciliável pelo painel e pela tela de
 * retorno.
 *
 * A única exceção é a assinatura inválida, que responde 401: aí não é o
 * Mercado Pago falando.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);

  let body: {
    type?: string;
    action?: string;
    data?: { id?: string | number };
  } = {};

  try {
    body = await request.json();
  } catch {
    // Notificação sem corpo: os dados vêm todos na query string.
  }

  // O id do recurso chega ora no corpo, ora na query, conforme o tipo de
  // notificação (`webhooks` novo vs `IPN` legado).
  const dataId =
    (body.data?.id !== undefined ? String(body.data.id) : null) ??
    url.searchParams.get("data.id") ??
    url.searchParams.get("id");

  const topic = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");

  const signature = verifyWebhookSignature({
    signatureHeader: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
  });

  if (!signature.ok) {
    console.error("[webhook] assinatura recusada:", signature.reason, { topic, dataId });
    return NextResponse.json({ error: "assinatura invalida" }, { status: 401 });
  }

  if (signature.skipped === "sandbox") {
    console.warn("[webhook] rodando sem validacao de assinatura (token de teste)");
  }

  // Só pagamento interessa. `merchant_order`, `plan`, `subscription` e afins
  // chegam na mesma URL e são descartados com 200 para não gerar reentrega.
  if (topic !== "payment") {
    return NextResponse.json({ ignored: topic ?? "sem topico" });
  }

  if (!dataId) {
    console.error("[webhook] notificacao de pagamento sem id");
    return NextResponse.json({ ok: true });
  }

  try {
    const payment = normalizePayment(await getPayment(dataId));

    if (!payment.externalReference) {
      console.error("[webhook] pagamento sem external_reference:", payment.paymentId);
      return NextResponse.json({ ok: true });
    }

    const supabase = createAdminSupabase();
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("external_reference", payment.externalReference)
      .maybeSingle();

    if (!order) {
      /**
       * Pagamento sem pedido local. Acontece quando o token de produção é
       * compartilhado com outra integração da mesma conta Mercado Pago — o
       * webhook é por conta, não por aplicação. Ignorar é o certo: liberar
       * acesso a partir de um pagamento que não é deste sistema seria pior.
       */
      console.warn(
        "[webhook] pagamento sem pedido correspondente:",
        payment.paymentId,
        payment.externalReference,
      );
      return NextResponse.json({ ok: true });
    }

    const updated = await applyPaymentToOrder(order, payment);

    console.info("[webhook] pedido atualizado:", {
      orderId: updated.id,
      status: updated.status,
      paymentId: payment.paymentId,
    });

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (error) {
    console.error("[webhook] falha ao processar notificacao:", dataId, error);
    // 200 de propósito: ver o comentário no topo.
    return NextResponse.json({ ok: true, deferred: true });
  }
}

/** O Mercado Pago faz um GET de teste ao salvar a URL no painel. */
export async function GET() {
  return NextResponse.json({ status: "ok", service: "mercadopago-webhook" });
}
