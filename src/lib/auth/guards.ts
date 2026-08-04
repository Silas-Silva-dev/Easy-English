import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createServerSupabase } from "@/lib/supabase/server";
import type { AccessGrant, Profile, UserRole } from "@/lib/types/database";

export interface SessionContext {
  userId: string;
  email: string;
  profile: Profile;
}

/**
 * Sessao + perfil do usuario atual, ou null se nao houver login.
 * Memoizado por request para evitar consultas repetidas em varios layouts.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  return { userId: user.id, email: user.email ?? profile.email, profile };
});

/** Exige login. Redireciona para /login preservando o destino. */
export async function requireUser(nextPath = "/app"): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return ctx;
}

/**
 * Exige login com conta em situacao regular.
 * Contas nao verificadas vao para a tela de verificacao; suspensas/banidas
 * caem numa pagina explicativa.
 */
export async function requireActiveUser(nextPath = "/app"): Promise<SessionContext> {
  const ctx = await requireUser(nextPath);

  switch (ctx.profile.status) {
    case "active":
      return ctx;
    case "pending_verification":
      redirect("/verificar-email");
    // falls through: redirect() nunca retorna
    case "suspended":
    case "banned":
      redirect("/conta-bloqueada");
  }

  return ctx;
}

/**
 * A concessão de acesso viva do aluno, ou null se ele nunca comprou / teve o
 * acesso revogado. Memoizado por request: o layout, a página e o menu do app
 * perguntam a mesma coisa.
 */
export const getAccessGrant = cache(async (): Promise<AccessGrant | null> => {
  const ctx = await getSessionContext();
  if (!ctx) return null;

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("access_grants")
    .select("*")
    .eq("user_id", ctx.userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (!data) return null;

  // Concessão com prazo já vencido não vale mais. O banco também filtra isso
  // em `has_course_access()`; aqui é para a UI não anunciar acesso expirado.
  if (data.expires_at && new Date(data.expires_at) <= new Date()) return null;

  return data;
});

/** Staff nunca é barrada pelo paywall: quem publica a lição precisa abri-la. */
export function bypassesPaywall(profile: Profile): boolean {
  return profile.role === "admin" || profile.role === "instructor";
}

export async function hasCourseAccess(): Promise<boolean> {
  const ctx = await getSessionContext();
  if (!ctx) return false;
  if (bypassesPaywall(ctx.profile)) return true;
  return (await getAccessGrant()) !== null;
}

/**
 * Exige conta ativa E acesso liberado (compra aprovada ou cortesia do admin).
 *
 * É o guard de tudo que está atrás do paywall. Quem ainda não pagou não vê
 * erro: cai no checkout, que é exatamente onde ele precisa estar.
 */
export async function requirePaidUser(nextPath = "/app"): Promise<SessionContext> {
  const ctx = await requireActiveUser(nextPath);
  if (bypassesPaywall(ctx.profile)) return ctx;
  if (await getAccessGrant()) return ctx;
  redirect("/checkout");
}

export type AccessDenial = "unauthenticated" | "inactive" | "unpaid";

export const ACCESS_DENIAL_MESSAGE: Record<AccessDenial, string> = {
  unauthenticated: "Não autenticado",
  inactive: "Conta não verificada ou bloqueada",
  unpaid: "Acesso não liberado. Conclua o pagamento para continuar.",
};

export const ACCESS_DENIAL_HTTP_STATUS: Record<AccessDenial, number> = {
  unauthenticated: 401,
  inactive: 403,
  // 402 Payment Required: o cliente sabe distinguir "não pode" de "não pagou".
  unpaid: 402,
};

/**
 * Verificação de paywall para quem NÃO passa pelo layout de /app: rotas de
 * API e Server Actions.
 *
 * Ambas são endpoints públicos de verdade — uma Server Action é invocável por
 * qualquer um que tenha o id da ação, sem nunca renderizar a página que a
 * contém. Confiar no guard do layout deixaria as chamadas caras (Gemini) e as
 * escritas abertas a quem criou conta e não pagou.
 */
export async function getPaidSession(): Promise<
  { ok: true; session: SessionContext } | { ok: false; reason: AccessDenial }
> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, reason: "unauthenticated" };
  if (ctx.profile.status !== "active") return { ok: false, reason: "inactive" };
  if (bypassesPaywall(ctx.profile)) return { ok: true, session: ctx };
  if (!(await getAccessGrant())) return { ok: false, reason: "unpaid" };
  return { ok: true, session: ctx };
}

export async function requireRole(
  roles: UserRole[],
  nextPath = "/admin",
): Promise<SessionContext> {
  const ctx = await requireActiveUser(nextPath);
  if (!roles.includes(ctx.profile.role)) redirect("/app?erro=sem-permissao");
  return ctx;
}

/** Admin ou instrutor: pode gerenciar catalogo e acompanhar alunos. */
export function requireStaff(nextPath = "/admin") {
  return requireRole(["admin", "instructor"], nextPath);
}

/** Somente admin: gestao de usuarios, papeis e configuracoes sensiveis. */
export function requireAdmin(nextPath = "/admin") {
  return requireRole(["admin"], nextPath);
}

export function isStaff(role: UserRole) {
  return role === "admin" || role === "instructor";
}

export const ROLE_LABEL: Record<UserRole, string> = {
  student: "Aluno",
  instructor: "Instrutor",
  admin: "Administrador",
};

export const STATUS_LABEL: Record<Profile["status"], string> = {
  pending_verification: "Aguardando verificacao",
  active: "Ativa",
  suspended: "Suspensa",
  banned: "Banida",
};
