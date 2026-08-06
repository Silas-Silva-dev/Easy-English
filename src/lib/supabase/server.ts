import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/types/database";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Respeita RLS: todas as consultas rodam como o usuario autenticado.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components nao podem escrever cookies; o middleware ja
          // cuida da renovacao da sessao.
        }
      },
    },
  });
}
