/**
 * Auditoria movel: fotografa cada tela do aluno em viewport de celular e mede
 * o que nao se ve numa foto — peso de JS, estouro horizontal, alvos de toque
 * pequenos demais e texto miudo. Usuario de teste criado e apagado aqui.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import { chromium, devices } from "playwright";

const DEST = process.argv[2] ?? "./_mobile";
const BASE = "http://localhost:3000";

const TELAS: [string, string][] = [["dia8", "/app/licao/8"]];


const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const email = `mobile-audit-${crypto.randomUUID().slice(0, 8)}@example.com`;
const senha = `Aud1t-${crypto.randomUUID()}`;

async function main() {
  mkdirSync(DEST, { recursive: true });
  let userId: string | null = null;

  try {
    const { data: criado, error } = await admin.auth.admin.createUser({
      email, password: senha, email_confirm: true,
      user_metadata: { full_name: "Aluno Teste" },
    });
    if (error || !criado.user) throw new Error(error?.message ?? "sem usuario");
    userId = criado.user.id;
    await admin.rpc("grant_course_access", { p_user: userId, p_source: "courtesy", p_note: "auditoria mobile" });
    console.log(`usuario temporario: ${email}\n`);

    const browser = await chromium.launch();
    const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "pt-BR" });
    const page = await ctx.newPage();

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[type="email"]', { timeout: 30000 });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', senha);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app/, { timeout: 30000 });
    console.log("login ok\n");

    console.log("tela            js(KB)  altura  estouroH  alvos<44px  texto<12px");
    console.log("─".repeat(72));

    for (const [nome, rota] of TELAS) {
      let js = 0;
      const contar = (r: import("playwright").Response) => {
        const t = r.request().resourceType();
        if (t === "script") r.body().then((b) => { js += b.length; }).catch(() => {});
      };
      page.on("response", contar);
      await page.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForLoadState("load").catch(() => {});
      await page.waitForTimeout(1800);
      page.off("response", contar);

      const m = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const alvos = [...document.querySelectorAll("button, a, [role=button], input, select")]
          .map((el) => (el as HTMLElement).getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0 && r.height < 44).length;
        let miudo = 0;
        for (const el of document.querySelectorAll("body *")) {
          const txt = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim().length > 2);
          if (!txt) continue;
          if (parseFloat(getComputedStyle(el).fontSize) < 12) miudo++;
        }
        return {
          estouro: Math.max(0, document.documentElement.scrollWidth - vw),
          altura: document.documentElement.scrollHeight,
          alvos, miudo,
          detalhe: [...document.querySelectorAll("button, a, [role=button], input, select")]
            .map((el) => ({ el, r: (el as HTMLElement).getBoundingClientRect() }))
            .filter((x) => x.r.width > 0 && x.r.height > 0 && x.r.height < 44)
            .map((x) => `${Math.round(x.r.height)}px  ${(x.el.textContent || (x.el as HTMLElement).getAttribute("aria-label") || x.el.tagName).trim().slice(0, 42)}`),
        };
      });

      await page.screenshot({ path: `${DEST}/${nome}-1.png` });
      if (m.altura > 1400) {
        await page.evaluate(() => window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.42)));
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${DEST}/${nome}-2.png` });
      }
      for (const d of m.detalhe) console.log("   " + d);
      console.log(
        `${nome.padEnd(15)} ${String(Math.round(js / 1024)).padStart(5)} ${String(m.altura).padStart(7)}` +
        `${String(m.estouro ? m.estouro + "px" : "-").padStart(10)}${String(m.alvos).padStart(12)}${String(m.miudo).padStart(12)}`,
      );
      writeFileSync(`${DEST}/${nome}.json`, JSON.stringify({ rota, js, ...m }, null, 2));
    }

    await browser.close();
  } finally {
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
      console.log(`\nusuario apagado (${email})`);
    }
  }
}

void main();
