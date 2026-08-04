/**
 * Diagnóstico do envio de e-mail do Supabase Auth.
 *
 *   npm run check:email -- voce@email.com
 *
 * Separa os três motivos pelos quais "esqueci minha senha" não chega:
 *
 *   1. o token nem é gerado  → conta não existe / chave errada
 *   2. o token é gerado mas o destino do link é descartado
 *                            → falta a URL em Redirect URLs
 *   3. o token é gerado e o envio falha
 *                            → SMTP do projeto fora do ar (a causa mais comum)
 *
 * O passo 3 dispara um e-mail de verdade quando o serviço está de pé: use um
 * endereço seu.
 */

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const ok = (msg: string) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const fail = (msg: string, hint?: string) => {
  console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
  if (hint) console.log(`    \x1b[2m→ ${hint}\x1b[0m`);
  failures++;
};
const warn = (msg: string, hint?: string) => {
  console.log(`  \x1b[33m!\x1b[0m ${msg}`);
  if (hint) console.log(`    \x1b[2m→ ${hint}\x1b[0m`);
};

let failures = 0;

const SMTP_HOWTO = [
  "Supabase → Authentication → Emails → SMTP Settings → Enable Custom SMTP.",
  "O serviço de e-mail embutido do Supabase NÃO serve para produção: ele só",
  "entrega para membros do time e para no limite de 2 mensagens por hora.",
  "Qualquer provedor resolve (Resend, Brevo, SendGrid, Amazon SES, Mailgun).",
  "Preencha host, porta, usuário, senha e o remetente — e confirme o domínio",
  "no provedor, senão ele aceita a conexão e recusa a mensagem.",
];

function printSmtpHowto() {
  console.log("");
  for (const line of SMTP_HOWTO) console.log(`    \x1b[2m${line}\x1b[0m`);
}

/** Lê a mensagem de erro do GoTrue sem depender do formato exato. */
function gotrueMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const b = body as Record<string, unknown>;
  for (const key of ["msg", "message", "error_description", "error"]) {
    const value = b[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

async function main() {
  console.log("\n\x1b[1mDiagnóstico de e-mail do InglishEasy\x1b[0m\n");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(
    /\/$/,
    "",
  );

  const target =
    process.argv.slice(2).find((a) => a.includes("@")) ??
    process.env.ADMIN_BOOTSTRAP_EMAILS?.split(",")[0]?.trim();

  console.log("\x1b[1m1. Credenciais\x1b[0m");

  if (!url || !anonKey || !serviceKey) {
    fail(
      "Faltam credenciais do Supabase no .env.local",
      "Preciso de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }
  ok(`Projeto: ${url}`);
  ok(`Site URL da aplicação: ${siteUrl}`);

  if (!target) {
    fail(
      "Nenhum e-mail informado",
      "Use: npm run check:email -- voce@email.com (precisa ser uma conta já cadastrada)",
    );
    process.exit(1);
  }
  ok(`E-mail de teste: ${target}`);

  const adminHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  // ------------------------------------------- 2. Geração do token
  // generate_link cria o token de recuperação SEM disparar e-mail, então isola
  // "o Auth funciona" de "o envio funciona".
  console.log("\n\x1b[1m2. Geração do link de recuperação (sem enviar e-mail)\x1b[0m");

  const wantedRedirect = `${siteUrl}/auth/confirm?type=recovery&next=/nova-senha`;
  let linkBody: Record<string, unknown> = {};

  try {
    const response = await fetch(`${url}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ type: "recovery", email: target, redirect_to: wantedRedirect }),
    });
    linkBody = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      const message = gotrueMessage(linkBody);
      if (response.status === 404 || /user not found/i.test(message)) {
        fail(
          `Não existe conta com o e-mail ${target}`,
          "Cadastre-se primeiro, ou rode o teste com um e-mail que já tem conta.",
        );
      } else {
        fail(`generate_link falhou (HTTP ${response.status}): ${message}`);
      }
      process.exit(1);
    }

    ok("Token de recuperação gerado: o Auth do projeto está de pé");
  } catch (error) {
    fail(`Não consegui falar com o Supabase: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  // ------------------------------------------- 3. Redirect URLs
  // O GoTrue não reclama de um redirect_to fora da allowlist: ele troca pelo
  // Site URL sem avisar. Comparar pedido x devolvido é o único jeito de ver.
  console.log("\n\x1b[1m3. Destino do link (Redirect URLs)\x1b[0m");

  const gotRedirect = typeof linkBody.redirect_to === "string" ? linkBody.redirect_to : "";

  if (gotRedirect.startsWith(`${siteUrl}/auth/confirm`)) {
    ok(`${siteUrl}/auth/confirm está na allowlist`);
  } else {
    fail(
      `O Supabase descartou o destino e usou "${gotRedirect}"`,
      `Adicione ${siteUrl}/** em Authentication → URL Configuration → Redirect URLs. ` +
        "Sem isso o link do e-mail chega, mas joga o aluno na home em vez da tela de nova senha.",
    );
  }

  // ------------------------------------------- 4. Envio de verdade
  console.log("\n\x1b[1m4. Envio do e-mail\x1b[0m");
  console.log(`  \x1b[2m…pedindo a recuperação de senha de ${target}\x1b[0m`);

  try {
    const response = await fetch(`${url}/auth/v1/recover`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: target }),
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const message = gotrueMessage(body);

    if (response.ok) {
      ok("O Supabase aceitou e despachou a mensagem");
      console.log(`    \x1b[2m→ confira a caixa de entrada (e o spam) de ${target}\x1b[0m`);
    } else if (response.status === 429) {
      warn(
        `Limite de envios atingido: ${message}`,
        "Isso não é defeito. Espere o tempo indicado e rode de novo. " +
          "Se o limite estourar o tempo todo, você ainda está no serviço embutido do Supabase.",
      );
    } else if (response.status === 500) {
      fail(
        `O envio falhou no Supabase: "${message}" (HTTP 500)`,
        "O token é gerado, mas nenhuma mensagem sai. É a configuração de SMTP do projeto.",
      );
      printSmtpHowto();
      const errorId = typeof body.error_id === "string" ? body.error_id : "";
      if (errorId) {
        console.log(
          `\n    \x1b[2merror_id ${errorId} — dá para achar a linha exata em ` +
            "Supabase → Logs → Auth Logs.\x1b[0m",
        );
      }
    } else {
      fail(`Resposta inesperada (HTTP ${response.status}): ${message || JSON.stringify(body)}`);
    }
  } catch (error) {
    fail(
      `Falha de rede ao chamar /auth/v1/recover: ${error instanceof Error ? error.message : error}`,
    );
  }

  // ------------------------------------------------------- Resultado
  console.log("");
  if (failures === 0) {
    console.log("\x1b[32m\x1b[1m✓ O caminho do e-mail está inteiro.\x1b[0m\n");
  } else {
    console.log(
      `\x1b[31m\x1b[1m✗ ${failures} problema(s).\x1b[0m Corrija e rode de novo: npm run check:email -- ${target}\n`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n✗ Erro inesperado:", error instanceof Error ? error.message : error);
  process.exit(1);
});
