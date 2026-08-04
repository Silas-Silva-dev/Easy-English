import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/types/database";

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

  const targetPath = type === "recovery" ? "/nova-senha" : `${next}?conta=verificada`;
  const response = NextResponse.redirect(new URL(targetPath, origin));

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return response;
    }
    return NextResponse.redirect(new URL("/login?erro=link-invalido", origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
  }

  return NextResponse.redirect(new URL("/login?erro=link-invalido", origin));
}
