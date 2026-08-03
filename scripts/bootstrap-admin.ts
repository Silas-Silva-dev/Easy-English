/**
 * Promove um e-mail a administrador.
 *
 *   npm run bootstrap:admin                       # usa ADMIN_BOOTSTRAP_EMAILS
 *   npm run bootstrap:admin -- voce@email.com
 *
 * Faz duas coisas:
 *   1. Insere o e-mail em admin_allowlist — quem se cadastrar com ele já nasce admin.
 *   2. Se a conta já existe, promove o perfil e ativa a conta na hora.
 */

import { env, supabaseAdmin } from "./_shared";

async function main() {
  const supabase = supabaseAdmin();

  const fromArgs = process.argv.slice(2).filter((a) => a.includes("@"));
  const fromEnv = env("ADMIN_BOOTSTRAP_EMAILS", "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const emails = [...new Set([...fromArgs, ...fromEnv].map((e) => e.toLowerCase()))];

  if (!emails.length) {
    console.error(
      "\n✗ Nenhum e-mail informado.\n  Use: npm run bootstrap:admin -- voce@email.com\n  Ou defina ADMIN_BOOTSTRAP_EMAILS no .env.local\n",
    );
    process.exit(1);
  }

  console.log(`\n▸ Promovendo ${emails.length} e-mail(is) a administrador…\n`);

  for (const email of emails) {
    const { error: allowError } = await supabase
      .from("admin_allowlist")
      .upsert({ email, note: "bootstrap via CLI" }, { onConflict: "email" });

    if (allowError) {
      console.error(`  ✗ ${email} — falha na allowlist: ${allowError.message}`);
      continue;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .update({ role: "admin", status: "active" })
      .eq("email", email)
      .select("id, email, role, status")
      .maybeSingle();

    if (profileError) {
      console.error(`  ✗ ${email} — falha ao promover: ${profileError.message}`);
    } else if (profile) {
      console.log(`  ✓ ${email} — conta existente promovida a admin e ativada`);
    } else {
      console.log(`  ✓ ${email} — na allowlist; será admin assim que se cadastrar`);
    }
  }

  console.log("");
}

main().catch((error) => {
  console.error("\n✗ Erro:", error instanceof Error ? error.message : error);
  process.exit(1);
});
