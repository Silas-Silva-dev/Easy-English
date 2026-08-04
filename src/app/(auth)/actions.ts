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

/**
 * Mensagens que existem mas não dizem nada. O caso real: quando o envio de
 * e-mail do projeto cai, o supabase-js devolve um `AuthRetryableFetchError`
 * cujo `.message` é a string literal `"{}"` — o corpo vazio da resposta 500
 * já serializado. Ela passa em qualquer teste de "é string não vazia" e chega
 * intacta na tela, que foi exatamente o `{}` que apareceu no formulário.
 */
const JUNK_MESSAGES = new Set(["{}", "[]", "null", "undefined", "[object Object]"]);

/**
 * Extrai a mensagem de erro do Supabase como string simples.
 *
 * Retornar string (e não o AuthError) é obrigatório: o Next.js só preserva
 * propriedades próprias e enumeráveis ao serializar o retorno de um Server
 * Action, então uma instância de erro chega mutilada no cliente.
 */
function safeErrorMsg(
  error: unknown,
  fallback = "Ocorreu um erro. Tente novamente mais tarde.",
): string {
  if (!error) return fallback;
  if (typeof error === "string" && error.trim()) return error;

  // Tenta extrair .message de qualquer forma (getter, propriedade própria, etc.)
  try {
    const msg =
      (error as { message?: unknown }).message ??
      (error as { msg?: unknown }).msg;
    const text = typeof msg === "string" ? msg.trim() : "";
    if (text && !JUNK_MESSAGES.has(text)) return text;
  } catch {
    // Ignora
  }

  // Sem mensagem aproveitável. O objeto cru NÃO vira texto de tela: um
  // JSON.stringify aqui só troca o `{}` por um blob igualmente ilegível para
  // quem está tentando entrar. Quem precisa do detalhe é o log do servidor,
  // e cada chamador já registra o erro inteiro antes de usar este retorno.
  return fallback;
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
    console.error("[signUp] Supabase error:", JSON.stringify(error), "| status:", error.status);
    const msg = safeErrorMsg(error);
    if (/already registered|already been registered/i.test(msg)) {
      return { error: "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha." };
    }
    // O cadastro também depende do mailer: sem ele o Supabase cria o usuário
    // mas não manda a confirmação, e devolve 500.
    if (error.status === 500 || /error sending|smtp|mail/i.test(msg)) {
      return {
        error:
          "Nosso serviço de e-mail está indisponível no momento, então não conseguimos enviar a confirmação. Tente de novo em alguns minutos.",
      };
    }
    return { error: msg };
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
    const msg = safeErrorMsg(error);
    if (/email not confirmed/i.test(msg)) {
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

  try {
    const supabase = await createServerSupabase();

    // O Supabase só aceita destinos que estejam em Authentication → URL
    // Configuration → Redirect URLs. Um destino fora da lista não dá erro:
    // ele é descartado em silêncio e o link cai no Site URL. Por isso mandamos
    // sempre — em produção vale, e em dev o comportamento é o mesmo de não
    // mandar, até que `http://localhost:3000/**` entre na lista.
    const redirectTo = `${serverEnv.siteUrl}/auth/confirm?type=recovery&next=/nova-senha`;

    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo });

    if (error) {
      const message = safeErrorMsg(error);
      console.error(
        "[resetPassword] Supabase error:",
        JSON.stringify(error),
        "| message:",
        message,
        "| status:",
        error.status,
      );

      // Excesso de tentativas: o Supabase limita envios por e-mail e por IP.
      if (error.status === 429 || /rate limit|after \d+ seconds/i.test(message)) {
        return { error: "Muitas tentativas seguidas. Aguarde um minuto e peça o link de novo." };
      }

      // "Error sending recovery email" (500 / unexpected_failure) não é culpa
      // de quem está tentando entrar: o serviço de e-mail do projeto está fora.
      // Rode `npm run check:email` para ver o diagnóstico e como corrigir.
      if (/error sending|smtp|mail/i.test(message) || error.status === 500) {
        return {
          error:
            "Nosso serviço de e-mail está indisponível no momento, então o link não foi enviado. Tente de novo em alguns minutos.",
        };
      }

      return { error: "Não foi possível enviar o e-mail de redefinição. Tente novamente." };
    }

    // Resposta idêntica exista ou não a conta — não vazamos quais e-mails estão cadastrados.
    return {
      success:
        "Se existir uma conta com este e-mail, enviamos um link de redefinição. Confira também a caixa de spam.",
    };
  } catch (err) {
    console.error("[resetPassword] Erro inesperado:", err);
    return { error: "Ocorreu um erro inesperado. Tente novamente mais tarde." };
  }
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
  if (error) {
    console.error(
      "[updatePassword] Supabase error:",
      JSON.stringify(error),
      "| status:",
      error.status,
    );
    return { error: safeErrorMsg(error, "Não foi possível salvar a nova senha. Tente novamente.") };
  }

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

  if (error) {
    console.error(
      "[resendVerification] Supabase error:",
      JSON.stringify(error),
      "| status:",
      error.status,
    );
    const msg = safeErrorMsg(error);

    if (error.status === 429 || /rate|limit|seconds/i.test(msg)) {
      return { error: "Aguarde alguns segundos antes de pedir um novo e-mail." };
    }

    // Antes, qualquer falha que não fosse rate limit caía no `success` lá
    // embaixo: o aluno era mandado esperar na caixa de entrada um e-mail que
    // nunca tinha saído.
    if (error.status === 500 || /error sending|smtp|mail/i.test(msg)) {
      return {
        error:
          "Nosso serviço de e-mail está indisponível no momento, então o link não foi reenviado. Tente de novo em alguns minutos.",
      };
    }

    return { error: "Não foi possível reenviar o e-mail de verificação. Tente novamente." };
  }

  return { success: "E-mail de verificação reenviado. Confira sua caixa de entrada." };
}
