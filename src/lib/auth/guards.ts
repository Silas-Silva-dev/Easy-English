import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createServerSupabase } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types/database";

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
    // falls through — redirect() nunca retorna
    case "suspended":
    case "banned":
      redirect("/conta-bloqueada");
  }

  return ctx;
}

export async function requireRole(
  roles: UserRole[],
  nextPath = "/admin",
): Promise<SessionContext> {
  const ctx = await requireActiveUser(nextPath);
  if (!roles.includes(ctx.profile.role)) redirect("/app?erro=sem-permissao");
  return ctx;
}

/** Admin ou instrutor — pode gerenciar catalogo e acompanhar alunos. */
export function requireStaff(nextPath = "/admin") {
  return requireRole(["admin", "instructor"], nextPath);
}

/** Somente admin — gestao de usuarios, papeis e configuracoes sensiveis. */
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
