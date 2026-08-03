import "server-only";

import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/types/database";

/**
 * Cliente com service_role — IGNORA RLS.
 *
 * Use somente depois de validar o papel do chamador com
 * `requireAdmin()` / `requireStaff()`. Nunca importe em codigo de cliente.
 */
export function createAdminSupabase() {
  return createClient<Database>(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
