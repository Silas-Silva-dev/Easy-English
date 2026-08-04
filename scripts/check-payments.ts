/**
 * Diagnóstico do pagamento — Mercado Pago de ponta a ponta.
 *
 *   npm run check:pagamento
 *   npm run check:pagamento -- https://seudominio.com.br
 *
 * Separa os motivos pelos quais "cliquei em pagar e não aconteceu nada":
 *
 *   1. token ausente/inválido            → nem chega a falar com o Mercado Pago
 *   2. preferência recusada (400)        → o corpo do pedido tem algo que o
 *                                          Mercado Pago não aceita; a mensagem
 *                                          dele diz qual campo
 *   3. preferência criada mas sem link   → o checkout abre e não leva a lugar nenhum
 *   4. webhook fora do ar / sem segredo  → o pagamento cai e o acesso não abre
 *
 * NÃO cobra ninguém: criar preferência é só gerar um link de checkout.
 */

import { createHmac } from "node:crypto";

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const ok = (msg: string) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const info = (msg: string) => console.log(`    \x1b[2m${msg}\x1b[0m`);
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

const API = "https://api.mercadopago.com";

/** Mostra só as pontas do segredo: o suficiente para conferir, sem vazar. */
function mask(value: string): string {
  if (value.length <= 12) return "•".repeat(value.length);
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function readBody(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

/**
 * Data no formato que o Mercado Pago aceita em `expiration_date_to`.
 *
 * Ele exige deslocamento explícito (`-03:00`) e RECUSA o sufixo `Z` que o
 * `toISOString()` produz. Este helper espelha o de src/lib/mercadopago para o
 * diagnóstico testar exatamente o que a aplicação envia.
 */
function mpDate(date: Date): string {
  const pad = (n: number, size = 2) => String(Math.abs(n)).padStart(size, "0");
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}${sign}${pad(Math.floor(Math.abs(offsetMin) / 60))}:` +
    `${pad(Math.abs(offsetMin) % 60)}`
  );
}

async function main() {
  const siteUrl = (
    process.argv[2]?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  const priceCents = Number(process.env.CHECKOUT_PRICE_CENTS?.trim() || "29700");
  const maxInstallments = Number(process.env.CHECKOUT_MAX_INSTALLMENTS?.trim() || "10");

  console.log("\n\x1b[1mDiagnóstico de pagamento — Mercado Pago\x1b[0m");
  console.log(`\x1b[2mSite: ${siteUrl}\x1b[0m\n`);

  // ------------------------------------------------------------- 1. Ambiente
  console.log("\x1b[1m1. Variáveis de ambiente\x1b[0m");

  if (!token) {
    fail(
      "MERCADOPAGO_ACCESS_TOKEN ausente",
      "Painel do Mercado Pago → sua aplicação → Credenciais de produção → Access token",
    );
    console.log("");
    return;
  }

  const isSandbox = token.startsWith("TEST-");
  ok(`Access token presente (${mask(token)})`);
  if (isSandbox) {
    warn(
      "Token de TESTE (sandbox) — nenhum dinheiro se move",
      "Para vender de verdade use o token que começa com APP_USR-",
    );
  } else if (!token.startsWith("APP_USR-")) {
    warn("O token não começa com APP_USR- nem TEST-; confira se copiou inteiro");
  } else {
    ok("Token de PRODUÇÃO — os pagamentos são reais");
  }

  if (!secret) {
    if (isSandbox) {
      warn("MERCADOPAGO_WEBHOOK_SECRET ausente (tolerado em sandbox)");
    } else {
      fail(
        "MERCADOPAGO_WEBHOOK_SECRET ausente",
        "Sem ele o webhook é RECUSADO e nenhum pagamento libera acesso sozinho.",
      );
    }
  } else {
    ok(`Segredo do webhook presente (${mask(secret)})`);
  }

  if (!/^https:\/\//i.test(siteUrl)) {
    warn(
      `NEXT_PUBLIC_SITE_URL não é HTTPS (${siteUrl})`,
      "Em localhost a preferência sai sem notification_url e sem auto_return.",
    );
  } else {
    ok(`Site em HTTPS: ${siteUrl}`);
  }

  info(`Preço: R$ ${(priceCents / 100).toFixed(2)} em até ${maxInstallments}x`);

  // ------------------------------------------------ 2. O token é aceito?
  console.log("\n\x1b[1m2. Autenticação na API\x1b[0m");

  const meResponse = await fetch(`${API}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const me = readBody(await meResponse.text()) as {
    id?: number;
    nickname?: string;
    site_id?: string;
    email?: string;
  } | null;

  if (!meResponse.ok) {
    fail(
      `A API recusou o token (HTTP ${meResponse.status})`,
      "Token expirado, revogado ou copiado pela metade. Gere de novo no painel.",
    );
    console.log("");
    return;
  }

  ok(`Token válido — conta ${me?.nickname ?? me?.id} (${me?.site_id ?? "?"})`);
  if (me?.site_id && me.site_id !== "MLB") {
    warn(
      `A conta é do site ${me.site_id}, não MLB (Brasil)`,
      "Cobranças em BRL exigem uma conta brasileira.",
    );
  }

  // -------------------------------------------- 3. Tabela de parcelamento
  console.log("\n\x1b[1m3. Tabela de parcelamento\x1b[0m");

  const instResponse = await fetch(
    `${API}/v1/payment_methods/installments?amount=${priceCents / 100}&payment_method_id=visa`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const inst = readBody(await instResponse.text()) as
    | { payer_costs?: { installments: number; installment_amount: number }[] }[]
    | null;

  const costs = Array.isArray(inst) ? (inst[0]?.payer_costs ?? []) : [];
  const longest = costs.filter((c) => c.installments <= maxInstallments).pop();

  if (!instResponse.ok || !longest) {
    warn(
      "Não foi possível ler a tabela real de parcelas",
      "A tela mostra a simulação local e avisa que é simulação. Não impede a venda.",
    );
  } else {
    ok(
      `${longest.installments}x de R$ ${longest.installment_amount.toFixed(2)} ` +
        `(total R$ ${(longest.installment_amount * longest.installments).toFixed(2)})`,
    );
  }

  // ------------------------------------- 4. Criação da preferência (o botão)
  console.log("\n\x1b[1m4. Criação da preferência — é o que o botão faz\x1b[0m");

  const reference = `diagnostico-${Date.now()}`;
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const isPublicSite = /^https:\/\//i.test(siteUrl);

  const preferenceBody = {
    items: [
      {
        id: reference,
        title: process.env.CHECKOUT_PRODUCT_TITLE?.trim() || "Easy English — Acesso completo",
        description: "Verificação automática de integração. Nenhuma cobrança é gerada.",
        category_id: "learnings",
        quantity: 1,
        currency_id: "BRL",
        unit_price: priceCents / 100,
      },
    ],
    payer: { email: "diagnostico@easyenglish.local", name: "Diagnostico" },
    external_reference: reference,
    metadata: { order_id: reference },
    ...(isPublicSite
      ? { notification_url: `${siteUrl}/api/pagamentos/webhook`, auto_return: "approved" }
      : {}),
    back_urls: {
      success: `${siteUrl}/checkout/retorno`,
      pending: `${siteUrl}/checkout/retorno`,
      failure: `${siteUrl}/checkout/retorno`,
    },
    payment_methods: {
      installments: maxInstallments,
      excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
    },
    statement_descriptor: (
      process.env.CHECKOUT_STATEMENT_DESCRIPTOR?.trim() || "EASYENGLISH"
    ).slice(0, 13),
    expires: true,
    expiration_date_to: mpDate(expiresAt),
    binary_mode: false,
  };

  info(`expiration_date_to = ${preferenceBody.expiration_date_to}`);

  const prefResponse = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": reference,
    },
    body: JSON.stringify(preferenceBody),
  });

  const pref = readBody(await prefResponse.text()) as {
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
    message?: string;
    error?: string;
    cause?: { code?: string | number; description?: string }[];
  } | null;

  if (!prefResponse.ok) {
    fail(`O Mercado Pago RECUSOU a preferência (HTTP ${prefResponse.status})`);
    if (pref?.message) info(`mensagem: ${pref.message}`);
    if (pref?.error) info(`erro: ${pref.error}`);
    for (const cause of pref?.cause ?? []) {
      info(`causa ${cause.code ?? "?"}: ${cause.description ?? ""}`);
    }
    info("É exatamente o que acontece quando o aluno clica em 'Ir para o pagamento'.");
  } else {
    const url = isSandbox ? (pref?.sandbox_init_point ?? pref?.init_point) : pref?.init_point;
    if (!url) {
      fail(
        "Preferência criada, mas sem link de checkout",
        "Sem init_point não há para onde redirecionar o aluno.",
      );
    } else {
      ok(`Preferência criada: ${pref?.id}`);
      ok("Link de checkout gerado — abra no navegador para conferir a tela do aluno:");
      console.log(`    \x1b[36m${url}\x1b[0m`);
    }
  }

  // ---------------------------------------------------- 5. Webhook no ar
  console.log("\n\x1b[1m5. Webhook\x1b[0m");

  const webhookUrl = `${siteUrl}/api/pagamentos/webhook`;

  try {
    const getResponse = await fetch(webhookUrl, { method: "GET" });
    if (getResponse.ok) {
      ok(`Rota responde: ${webhookUrl}`);
    } else {
      fail(`A rota respondeu HTTP ${getResponse.status}`, "Confira se o deploy está atualizado.");
    }
  } catch (error) {
    fail(
      `Não consegui alcançar ${webhookUrl}`,
      error instanceof Error ? error.message : String(error),
    );
  }

  // Notificação forjada: prova que a porta está trancada.
  try {
    const forged = await fetch(`${webhookUrl}?type=payment&data.id=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "payment", data: { id: "1" } }),
    });

    if (forged.status === 401) {
      ok("Notificação SEM assinatura foi recusada (401) — a porta está trancada");
    } else if (isSandbox) {
      warn(`Notificação sem assinatura aceita (HTTP ${forged.status}) — esperado em sandbox`);
    } else {
      fail(
        `Notificação FORJADA foi aceita (HTTP ${forged.status})`,
        "Qualquer um poderia liberar o curso. Verifique MERCADOPAGO_WEBHOOK_SECRET no servidor.",
      );
    }
  } catch (error) {
    warn("Não consegui testar a recusa de assinatura", String(error));
  }

  // Notificação assinada de verdade: prova que o servidor tem o MESMO segredo.
  if (secret) {
    const dataId = "1";
    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = "diagnostico-request-id";
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = createHmac("sha256", secret).update(manifest).digest("hex");

    try {
      const signed = await fetch(`${webhookUrl}?type=payment&data.id=${dataId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature": `ts=${ts},v1=${v1}`,
          "x-request-id": requestId,
        },
        body: JSON.stringify({ type: "payment", data: { id: dataId } }),
      });

      if (signed.status === 401) {
        fail(
          "Notificação ASSINADA foi recusada (401)",
          "O segredo do .env.local difere do que está no servidor de produção. " +
            "Atualize MERCADOPAGO_WEBHOOK_SECRET no hPanel e reinicie a aplicação.",
        );
      } else if (signed.ok) {
        ok("Notificação assinada foi aceita — servidor e segredo batem");
        info("O pagamento id=1 não existe, então nada foi liberado. É o esperado.");
      } else {
        warn(`Notificação assinada respondeu HTTP ${signed.status}`);
      }
    } catch (error) {
      warn("Não consegui enviar a notificação assinada", String(error));
    }
  }

  // ------------------------------------------------------------- Resultado
  console.log("");
  if (failures === 0) {
    console.log("\x1b[32m\x1b[1m✓ Pagamento pronto para vender.\x1b[0m\n");
  } else {
    console.log(`\x1b[31m\x1b[1m✗ ${failures} problema(s) encontrado(s).\x1b[0m\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\n\x1b[31mErro inesperado no diagnóstico:\x1b[0m", error);
  process.exitCode = 1;
});
