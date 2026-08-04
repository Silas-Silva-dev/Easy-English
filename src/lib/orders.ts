import "server-only";

import type { NormalizedPayment } from "@/lib/mercadopago/payments";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Order, PaymentStatus } from "@/lib/types/database";

/** Estados em que o dinheiro saiu da mão do aluno e voltou. */
const REVERSALS: PaymentStatus[] = ["refunded", "charged_back", "cancelled"];

/**
 * Aplica ao pedido o que o Mercado Pago diz sobre o pagamento, e ajusta o
 * acesso do aluno de acordo.
 *
 * Chamado de dois lugares — o webhook e a tela de retorno — que disparam ao
 * mesmo tempo e na ordem que der. Por isso a função é idempotente e nunca
 * confia em "eu vi antes": ela decide olhando o par (estado atual, estado
 * novo), não a sequência de chamadas.
 */
export async function applyPaymentToOrder(
  order: Order,
  payment: NormalizedPayment,
): Promise<Order> {
  const supabase = createAdminSupabase();

  /**
   * Um pedido pago não volta atrás por causa de outra tentativa.
   *
   * Cenário real: o cartão é recusado, o aluno paga no PIX, e a notificação
   * atrasada da recusa chega depois. Os dois pagamentos carregam o mesmo
   * `external_reference`. Sem esta trava, a recusa sobrescreveria o pedido
   * aprovado e o aluno perderia o acesso que ele pagou.
   *
   * Estorno e chargeback do MESMO pagamento passam: aí a reversão é real.
   */
  if (order.status === "approved" && payment.status !== "approved") {
    const samePayment = order.payment_id === payment.paymentId;
    if (!samePayment || !REVERSALS.includes(payment.status)) {
      console.warn(
        `[orders] ignorando ${payment.status} do pagamento ${payment.paymentId}:`,
        `pedido ${order.id} ja aprovado por ${order.payment_id}`,
      );
      return order;
    }
  }

  const { data: updated, error } = await supabase
    .from("orders")
    .update({
      status: payment.status,
      payment_id: payment.paymentId,
      payment_type: payment.paymentType,
      payment_method: payment.paymentMethod,
      status_detail: payment.statusDetail,
      installments: payment.installments,
      installment_amount_cents: payment.installmentAmountCents,
      total_paid_cents: payment.totalPaidCents,
      net_received_cents: payment.netReceivedCents,
      paid_at: payment.status === "approved" ? (payment.paidAt ?? new Date().toISOString()) : null,
      // Mescla em vez de sobrescrever: a preferência gravada na abertura do
      // pedido é o que permite reconstituir o que foi oferecido ao aluno.
      raw: {
        ...(typeof order.raw === "object" && order.raw !== null && !Array.isArray(order.raw)
          ? order.raw
          : {}),
        payment,
      } as never,
    })
    .eq("id", order.id)
    .select()
    .single();

  if (error) {
    console.error("[orders] falha ao atualizar pedido:", error.message);
    return order;
  }

  const next = updated ?? order;

  if (payment.status === "approved") {
    /**
     * Confere o valor antes de liberar.
     *
     * A comparação é com `transaction_amount` (o preço do produto), nunca com
     * o total pago: no parcelamento o aluno paga mais que o preço por causa
     * dos juros do cartão, e comparar com o total recusaria toda compra
     * parcelada.
     *
     * Hoje o valor não é manipulável pelo comprador — a preferência do
     * Checkout Pro fixa o preço, e forjar um pagamento exigiria o access
     * token. A verificação existe porque liberar acesso é irreversível na
     * prática: se algum dia um preço errado, uma preferência adulterada ou uma
     * mudança na API do Mercado Pago produzir um pagamento a menor, é melhor o
     * pedido parar para revisão humana do que o curso sair de graça em
     * silêncio. Tolerância de 1 centavo para arredondamento de conversão.
     */
    const expected = next.amount_cents;
    const charged = payment.transactionAmountCents;

    if (charged !== null && charged < expected - 1) {
      console.error("[orders] VALOR PAGO MENOR QUE O PEDIDO — acesso NAO liberado:", {
        orderId: next.id,
        userId: next.user_id,
        paymentId: payment.paymentId,
        esperadoCentavos: expected,
        pagoCentavos: charged,
      });
      return next;
    }

    // Idempotente no banco: se já existe concessão viva, ela é devolvida sem
    // criar uma segunda (ver `grant_course_access` na migration 700).
    const { error: grantError } = await supabase.rpc("grant_course_access", {
      p_user: next.user_id,
      p_source: "payment",
      p_order_id: next.id,
      p_note: `Pagamento ${payment.paymentId} (${payment.paymentMethod ?? "—"})`,
    });

    if (grantError) {
      console.error("[orders] PAGAMENTO APROVADO SEM LIBERAR ACESSO:", grantError.message, {
        orderId: next.id,
        userId: next.user_id,
        paymentId: payment.paymentId,
      });
    }
  }

  if (REVERSALS.includes(payment.status) && order.status === "approved") {
    /**
     * Só revoga se a concessão viva veio DESTE pedido. Um aluno estornado que
     * depois recebeu cortesia do admin, ou que comprou de novo, mantém o
     * acesso que a segunda origem sustenta.
     */
    const { data: grant } = await supabase
      .from("access_grants")
      .select("id, order_id")
      .eq("user_id", next.user_id)
      .is("revoked_at", null)
      .maybeSingle();

    if (grant?.order_id === next.id) {
      const { error: revokeError } = await supabase.rpc("revoke_course_access", {
        p_user: next.user_id,
        p_reason: `Pagamento ${payment.status} (${payment.paymentId})`,
      });
      if (revokeError) console.error("[orders] falha ao revogar acesso:", revokeError.message);
    }
  }

  return next;
}
