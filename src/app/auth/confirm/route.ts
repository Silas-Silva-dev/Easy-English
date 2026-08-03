import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Destino dos links enviados por e-mail pelo Supabase (confirmação de cadastro,
 * recuperação de senha, convite e troca de e-mail).
 *
 * Aceita os dois formatos:
 *   - ?token_hash=...&type=signup   (novo, recomendado)
 *   - ?code=...                     (PKCE)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next");
  const next = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";

  const supabase = await createServerSupabase();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(
        new URL(type === "recovery" ? "/nova-senha" : `${next}?conta=verificada`, origin),
      );
    }
    return NextResponse.redirect(new URL("/login?erro=link-invalido", origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(
        new URL(type === "recovery" ? "/nova-senha" : `${next}?conta=verificada`, origin),
      );
    }
  }

  return NextResponse.redirect(new URL("/login?erro=link-invalido", origin));
}
