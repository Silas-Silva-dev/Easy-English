"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";

import { getAccessGrant, requireActiveUser } from "@/lib/auth/guards";
import { checkoutEnv, mercadoPagoEnv } from "@/lib/env";
import { checkoutUrl, createPreference } from "@/lib/mercadopago/checkout";
import { getPayment, normalizePayment } from "@/lib/mercadopago/payments";
import { applyPaymentToOrder } from "@/lib/orders";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Order } from "@/lib/types/database";

export interface CheckoutState {
  error?: string;
}

/**
 * Abre (ou reabre) o pagamento do acesso ao curso.
 *
 * O pedido é gravado ANTES de falar com o Mercado Pago. Se a criação da
 * preferência falhar no meio, sobra uma linha `pending` sem `preference_id` —
 * visível no painel e recuperável. O contrário (pedir primeiro, gravar
 * depois) deixaria uma cobrança viva no Mercado Pago sem nenhum registro
 * local para reconciliar quando o dinheiro caísse.
 */
export async function startCheckoutAction(
  _prev: CheckoutState,
  _formData: FormData,
): Promise<CheckoutState> {
  const session = await requireActiveUser("/checkout");

  // Já pagou (ou ganhou cortesia) enquanto a aba estava aberta.
  if (await getAccessGrant()) redirect("/app");

  if (!mercadoPagoEnv.configured) {
    console.error("[checkout] MERCADOPAGO_ACCESS_TOKEN ausente");
    return { error: "O pagamento está temporariamente indisponível. Tente novamente em instantes." };
  }

  const supabase = createAdminSupabase();
  const amountCents = checkoutEnv.priceCents;
  const expiresAt = new Date(Date.now() + checkoutEnv.expirationHours * 60 * 60 * 1000);

  let destination: string;

  try {
    /**
     * Reaproveita um pedido em aberto e ainda válido.
     *
     * Sem isso, cada volta do aluno à tela criaria um pedido novo: o painel
     * encheria de `pending` órfãos e, pior, ele poderia pagar dois deles.
     */
    const { data: openOrder } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", session.userId)
      .in("status", ["pending", "in_process"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const reusable =
      openOrder &&
      openOrder.init_point &&
      openOrder.amount_cents === amountCents &&
      (!openOrder.expires_at || new Date(openOrder.expires_at) > new Date());

    if (reusable && openOrder) {
      destination = openOrder.init_point as string;
    } else {
      const externalReference = randomUUID();

      const { data: order, error: insertError } = await supabase
        .from("orders")
        .insert({
          user_id: session.userId,
          email: session.email,
          full_name: session.profile.full_name,
          amount_cents: amountCents,
          currency: "BRL",
          description: checkoutEnv.productTitle,
          status: "pending",
          provider: "mercadopago",
          external_reference: externalReference,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (insertError || !order) {
        console.error("[checkout] falha ao criar pedido:", insertError?.message);
        return { error: "Não foi possível abrir o pagamento. Tente novamente." };
      }

      const preference = await createPreference({
        orderId: order.id,
        externalReference,
        amountCents,
        title: checkoutEnv.productTitle,
        description: "Acesso completo aos 4 Cantos, 52 circuitos e 728 dias de lições.",
        payer: { name: session.profile.full_name, email: session.email },
        expiresAt,
      });

      await supabase
        .from("orders")
        .update({
          preference_id: preference.id,
          init_point: checkoutUrl(preference),
          raw: { preference } as never,
        })
        .eq("id", order.id);

      destination = checkoutUrl(preference);
    }
  } catch (error) {
    console.error("[checkout] erro ao criar preferencia:", error);
    return {
      error:
        "Não conseguimos falar com o Mercado Pago agora. Aguarde alguns segundos e tente de novo.",
    };
  }

  // `redirect()` lança para interromper o fluxo: precisa ficar FORA do try,
  // senão o catch acima o engoliria e o aluno veria um erro genérico depois
  // de o pagamento já ter sido aberto com sucesso.
  redirect(destination);
}

/**
 * Reconciliação sob demanda, usada pela tela de retorno.
 *
 * O webhook é a fonte da verdade, mas ele e o navegador correm em paralelo:
 * o aluno costuma chegar de volta antes da notificação. Sem esta consulta
 * direta, quem acabou de pagar veria "aguardando" por alguns segundos e
 * concluiria que a compra falhou.
 */
export async function syncOrderFromPayment(paymentId: string): Promise<Order | null> {
  /**
   * Uma Server Action exportada é um endpoint público: qualquer um com o id
   * da ação a invoca com o `paymentId` que quiser, sem nunca abrir esta tela.
   * Exigir sessão e confinar o efeito ao pedido de QUEM CHAMA fecha a porta —
   * sem isso, um terceiro conseguiria disparar reconciliação em pedidos
   * alheios e sondar quais ids de pagamento existem.
   */
  const session = await requireActiveUser("/checkout");

  if (!/^\d+$/.test(paymentId)) return null;

  try {
    const payment = normalizePayment(await getPayment(paymentId));
    if (!payment.externalReference) return null;

    const supabase = createAdminSupabase();

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("external_reference", payment.externalReference)
      .eq("user_id", session.userId)
      .maybeSingle();

    if (!order) return null;

    return applyPaymentToOrder(order, payment);
  } catch (error) {
    console.error("[checkout] falha ao sincronizar pagamento:", error);
    return null;
  }
}
