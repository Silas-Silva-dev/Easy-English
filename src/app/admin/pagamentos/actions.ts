"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/guards";
import { serverEnv } from "@/lib/env";
import { getPayment, normalizePayment } from "@/lib/mercadopago/payments";
import { applyPaymentToOrder } from "@/lib/orders";
import { createAdminSupabase } from "@/lib/supabase/admin";

export interface BillingActionResult {
  ok: boolean;
  error?: string;
  message?: string;
  /** Link de definição de senha, devolvido ao criar um aluno cortesia. */
  inviteLink?: string;
}

/** Todo endpoint desta tela toca em acesso pago: só admin passa. */
async function assertAdmin() {
  const session = await getSessionContext();
  if (!session) throw new Error("Não autenticado");
  if (session.profile.role !== "admin") throw new Error("Acesso restrito a administradores");
  if (session.profile.status !== "active") throw new Error("Conta inativa");
  return session;
}

async function audit(
  actor: { userId: string; email: string },
  action: string,
  entity: string,
  entityId: string,
  meta: Record<string, unknown> = {},
) {
  const supabase = createAdminSupabase();
  await supabase.from("audit_log").insert({
    actor_id: actor.userId,
    actor_email: actor.email,
    action,
    entity,
    entity_id: entityId,
    meta: meta as never,
  });
}

function revalidateBilling() {
  revalidatePath("/admin/pagamentos");
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin");
}

function fail(error: unknown): BillingActionResult {
  return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado" };
}

// ---------------------------------------------------------------- cortesia

/**
 * Libera o curso sem cobrar. É o "adicionar pessoa sem custo": aluno
 * convidado, bolsa, professor parceiro, teste interno.
 *
 * A concessão fica marcada como `courtesy` e com o motivo, para o painel
 * financeiro nunca confundir isto com receita.
 */
export async function grantCourtesyAccessAction(
  userId: string,
  note?: string,
): Promise<BillingActionResult> {
  try {
    const actor = await assertAdmin();
    const supabase = createAdminSupabase();

    const { error } = await supabase.rpc("grant_course_access", {
      p_user: userId,
      p_source: "courtesy",
      p_granted_by: actor.userId,
      p_note: note?.trim() || "Acesso liberado pelo administrador",
    });

    if (error) return { ok: false, error: error.message };

    await audit(actor, "access.granted_courtesy", "access_grants", userId, { note });
    revalidateBilling();
    return { ok: true, message: "Acesso liberado sem custo." };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeAccessAction(
  userId: string,
  reason?: string,
): Promise<BillingActionResult> {
  try {
    const actor = await assertAdmin();

    if (userId === actor.userId) {
      return { ok: false, error: "Você não pode revogar o próprio acesso." };
    }

    const supabase = createAdminSupabase();
    const { data, error } = await supabase.rpc("revoke_course_access", {
      p_user: userId,
      p_reason: reason?.trim() || "Revogado pelo administrador",
    });

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Este usuário não tinha acesso ativo." };

    await audit(actor, "access.revoked", "access_grants", userId, { reason });
    revalidateBilling();
    return { ok: true, message: "Acesso revogado." };
  } catch (error) {
    return fail(error);
  }
}

// ------------------------------------------------------------- reconciliar

/**
 * Reconsulta o pagamento no Mercado Pago e reaplica o resultado.
 *
 * Serve para o caso em que o webhook não chegou (URL fora do ar no momento da
 * notificação, deploy em andamento, segredo trocado): o dinheiro caiu e o
 * pedido ficou `pending`. Um clique aqui resolve sem mexer no banco na mão.
 */
export async function syncOrderAction(orderId: string): Promise<BillingActionResult> {
  try {
    const actor = await assertAdmin();
    const supabase = createAdminSupabase();

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { ok: false, error: "Pedido não encontrado." };
    if (!order.payment_id) {
      return {
        ok: false,
        error: "Este pedido ainda não tem pagamento associado no Mercado Pago.",
      };
    }

    const payment = normalizePayment(await getPayment(order.payment_id));
    const updated = await applyPaymentToOrder(order, payment);

    await audit(actor, "order.synced", "orders", orderId, { status: updated.status });
    revalidateBilling();
    return { ok: true, message: `Pedido sincronizado: ${updated.status}.` };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Libera o acesso de um pedido que não fechou sozinho.
 *
 * O caso real: transferência combinada por fora, pagamento conciliado no
 * extrato mas travado no Mercado Pago, cobrança feita em outro canal. O pedido
 * NÃO é marcado como aprovado — mentir sobre o status estragaria o
 * faturamento do painel. O que se concede é acesso de cortesia amarrado ao
 * pedido, com o motivo registrado.
 */
export async function releaseOrderAccessAction(
  orderId: string,
  note?: string,
): Promise<BillingActionResult> {
  try {
    const actor = await assertAdmin();
    const supabase = createAdminSupabase();

    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id, email")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { ok: false, error: "Pedido não encontrado." };

    const { error } = await supabase.rpc("grant_course_access", {
      p_user: order.user_id,
      p_source: "courtesy",
      p_order_id: order.id,
      p_granted_by: actor.userId,
      p_note: note?.trim() || `Liberado manualmente sobre o pedido ${orderId.slice(0, 8)}`,
    });

    if (error) return { ok: false, error: error.message };

    await audit(actor, "access.released_manually", "orders", orderId, {
      user_id: order.user_id,
      note,
    });
    revalidateBilling();
    return { ok: true, message: `Acesso liberado para ${order.email}.` };
  } catch (error) {
    return fail(error);
  }
}

// -------------------------------------------------- criar aluno sem custo

const freeStudentSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido"),
  fullName: z.string().trim().min(2, "Informe o nome completo").max(120),
  note: z.string().trim().max(300).optional(),
});

/**
 * Cria a conta de um aluno convidado e já libera o curso.
 *
 * A senha nasce aleatória e nunca é mostrada: o admin recebe um link de
 * definição de senha para repassar. O link é gerado pela Admin API em vez de
 * disparado por e-mail de propósito — o envio do projeto já caiu antes, e um
 * convite que depende do mailer deixaria o aluno preso sem ninguém saber.
 */
export async function createFreeStudentAction(
  _prev: BillingActionResult,
  formData: FormData,
): Promise<BillingActionResult> {
  try {
    const actor = await assertAdmin();

    const parsed = freeStudentSchema.safeParse({
      email: formData.get("email"),
      fullName: formData.get("fullName"),
      note: formData.get("note"),
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const { email, fullName, note } = parsed.data;
    const supabase = createAdminSupabase();

    // Já existe conta com este e-mail? Então é só liberar o acesso dela.
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    let userId = existing?.id ?? null;
    let created = false;

    if (!userId) {
      const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        // 32 bytes de entropia. Ninguém precisa dela: o acesso se dá pelo link.
        password: randomBytes(24).toString("base64url"),
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createError || !authUser.user) {
        return { ok: false, error: createError?.message ?? "Não foi possível criar a conta." };
      }

      userId = authUser.user.id;
      created = true;

      // `handle_new_user` já criou o perfil; aqui garantimos nome e status
      // para o aluno não cair na tela de "confirme seu e-mail".
      await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          status: "active",
          email_verified_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }

    const { error: grantError } = await supabase.rpc("grant_course_access", {
      p_user: userId,
      p_source: "courtesy",
      p_granted_by: actor.userId,
      p_note: note || "Aluno adicionado sem custo pelo administrador",
    });

    if (grantError) return { ok: false, error: grantError.message };

    // Link para o aluno definir a própria senha.
    let inviteLink: string | undefined;
    const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${serverEnv.siteUrl}/auth/confirm?type=recovery&next=/nova-senha` },
    });

    if (linkError) {
      console.error("[admin] falha ao gerar link de acesso:", linkError.message);
    } else {
      inviteLink = link.properties?.action_link;
    }

    await audit(actor, created ? "user.created_courtesy" : "access.granted_courtesy", "profiles", userId, {
      email,
      note,
    });

    revalidateBilling();

    return {
      ok: true,
      message: created
        ? `Conta criada e acesso liberado para ${email}.`
        : `${email} já tinha conta: o acesso foi liberado.`,
      inviteLink,
    };
  } catch (error) {
    return fail(error);
  }
}
