import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/types/database";

/**
 * Rotas que exigem sessao autenticada.
 * `/checkout` entra aqui porque o pedido nasce vinculado a um usuario: sem
 * sessao nao ha a quem creditar o acesso depois do pagamento.
 */
const PROTECTED_PREFIXES = ["/app", "/admin", "/checkout"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            // Omitir maxAge e expires transforma o cookie em cookie de sessão (expira ao fechar o navegador)
            const { maxAge, expires, ...sessionOptions } = options;
            response.cookies.set(name, value, sessionOptions);
          }
        },
      },
    },
  );

  // IMPORTANTE: getUser() revalida o token no servidor. Nao troque por
  // getSession(), que confia no cookie sem verificar a assinatura.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return response;
}
