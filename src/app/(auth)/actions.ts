"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { serverEnv } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export interface AuthFormState {
  error?: string;
  success?: string;
}

const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido");
const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres")
  .max(72, "A senha pode ter no máximo 72 caracteres");

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo").max(120),
  email: emailSchema,
  password: passwordSchema,
});

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha"),
});

/** Impede open redirect: só aceita caminhos internos. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { fullName, email, password } = parsed.data;
  const supabase = await createServerSupabase();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${serverEnv.siteUrl}/auth/confirm`,
    },
  });

  if (error) {
    if (/already registered|already been registered/i.test(error.message)) {
      return { error: "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha." };
    }
    return { error: error.message };
  }

  // Quando a confirmação de e-mail está ligada, o Supabase devolve o usuário
  // sem sessão. Nesse caso mandamos para a tela de "verifique seu e-mail".
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/app");
  }

  redirect(`/verificar-email?email=${encodeURIComponent(email)}`);
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      redirect(`/verificar-email?email=${encodeURIComponent(parsed.data.email)}`);
    }
    return { error: "E-mail ou senha incorretos." };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signOutAction() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "E-mail inválido" };

  const supabase = await createServerSupabase();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${serverEnv.siteUrl}/auth/confirm?type=recovery&next=/nova-senha`,
  });

  // Resposta idêntica exista ou não a conta — não vazamos quais e-mails
  // estão cadastrados.
  return {
    success:
      "Se existir uma conta com este e-mail, enviamos um link de redefinição. Confira também a caixa de spam.",
  };
}

export async function updatePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = formData.get("password");
  const confirm = formData.get("confirmPassword");

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Senha inválida" };
  if (password !== confirm) return { error: "As senhas não conferem." };

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Link expirado ou inválido. Solicite uma nova redefinição de senha." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/app?senha=atualizada");
}

export async function resendVerificationAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "E-mail inválido" };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: `${serverEnv.siteUrl}/auth/confirm` },
  });

  if (error && /rate|limit|seconds/i.test(error.message)) {
    return { error: "Aguarde alguns segundos antes de pedir um novo e-mail." };
  }

  return { success: "E-mail de verificação reenviado. Confira sua caixa de entrada." };
}
