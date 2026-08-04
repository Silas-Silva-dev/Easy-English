/**
 * Teste de invasão do paywall — contra o banco REAL.
 *
 *   npm run check:seguranca
 *   npm run check:seguranca -- https://seudominio.com.br
 *
 * Não simula nada: cria um aluno descartável, faz login de verdade, pega o JWT
 * de `authenticated` e ataca a API do Supabase com ele — que é exatamente o
 * que um atacante faria depois de se cadastrar no seu site.
 *
 * A anon key é pública por natureza (ela vai no JavaScript de toda página), e
 * o PostgREST fica exposto na internet. Ou seja: o Row Level Security é a
 * ÚNICA barreira entre um cadastro grátis e as 728 lições. Este script mede se
 * ela está de pé.
 *
 * O usuário de teste é apagado no fim, inclusive se algum passo falhar.
 */

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const ok = (msg: string) => console.log(`  \x1b[32m✓ BLOQUEADO\x1b[0m  ${msg}`);
const hole = (msg: string, detail?: string) => {
  console.log(`  \x1b[31m✗ BRECHA\x1b[0m    ${msg}`);
  if (detail) console.log(`    \x1b[2m${detail}\x1b[0m`);
  holes++;
};
const warn = (msg: string, detail?: string) => {
  console.log(`  \x1b[33m! ATENÇÃO\x1b[0m   ${msg}`);
  if (detail) console.log(`    \x1b[2m${detail}\x1b[0m`);
};
const note = (msg: string) => console.log(`    \x1b[2m${msg}\x1b[0m`);

let holes = 0;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

interface Attempt {
  status: number;
  body: unknown;
  rows: number | null;
}

/** Uma requisição ao PostgREST com o token informado. */
async function call(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Attempt> {
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: anonKey!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* resposta não-JSON */
  }

  return {
    status: response.status,
    body,
    rows: Array.isArray(body) ? body.length : null,
  };
}

function reason(attempt: Attempt): string {
  const b = attempt.body as { message?: string; code?: string } | null;
  const msg = b?.message ?? "";
  return `HTTP ${attempt.status}${msg ? ` · ${msg.slice(0, 90)}` : ""}`;
}

/** Escreveu com sucesso? 2xx em POST/PATCH significa que passou. */
function wrote(attempt: Attempt): boolean {
  return attempt.status >= 200 && attempt.status < 300;
}

async function main() {
  console.log("\n\x1b[1mTeste de invasão do paywall\x1b[0m");

  if (!url || !anonKey || !serviceKey) {
    console.log(
      "\n\x1b[31mFaltam NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY no .env.local\x1b[0m\n",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\x1b[2mBanco: ${url}\x1b[0m\n`);

  // ------------------------------------------------- Cria o aluno descartável
  const stamp = Date.now();
  const email = `sec-probe-${stamp}@easyenglish.test`;
  const password = `Probe!${stamp}aA`;
  let userId: string | null = null;

  const createResponse = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Sonda de Seguranca" },
    }),
  });

  const created = (await createResponse.json()) as { id?: string; msg?: string };

  if (!createResponse.ok || !created.id) {
    console.log(
      `\x1b[31mNão consegui criar o usuário de teste: HTTP ${createResponse.status} ${created.msg ?? ""}\x1b[0m\n`,
    );
    process.exitCode = 1;
    return;
  }

  userId = created.id;
  console.log(`\x1b[2mAluno de teste criado: ${email}\x1b[0m`);
  note("Conta ATIVA (e-mail confirmado) e SEM pagamento — o pior caso realista.");

  try {
    // ------------------------------------------------------ Login de verdade
    const signInResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const session = (await signInResponse.json()) as { access_token?: string };
    const jwt = session.access_token;

    if (!jwt) {
      console.log(`\x1b[31mLogin do usuário de teste falhou (HTTP ${signInResponse.status})\x1b[0m`);
      process.exitCode = 1;
      return;
    }

    note(`JWT de 'authenticated' obtido — daqui em diante ataco como esse aluno.\n`);

    // ================================================================= ATAQUES
    console.log("\x1b[1m1. Liberar acesso para si mesmo\x1b[0m");

    const selfGrant = await call("/rest/v1/rpc/grant_course_access", jwt, {
      method: "POST",
      body: JSON.stringify({ p_user: userId, p_source: "courtesy", p_note: "invasao" }),
    });
    if (wrote(selfGrant)) {
      hole("rpc grant_course_access executou — curso liberado de graça", reason(selfGrant));
    } else {
      ok(`rpc grant_course_access — ${reason(selfGrant)}`);
    }

    const directGrant = await call("/rest/v1/access_grants", jwt, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, source: "courtesy", note: "invasao" }),
    });
    if (wrote(directGrant)) {
      hole("INSERT direto em access_grants passou", reason(directGrant));
    } else {
      ok(`INSERT em access_grants — ${reason(directGrant)}`);
    }

    console.log("\n\x1b[1m2. Forjar um pedido pago\x1b[0m");

    const fakeOrder = await call("/rest/v1/orders", jwt, {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        email,
        amount_cents: 1,
        status: "approved",
        external_reference: `invasao-${stamp}`,
      }),
    });
    if (wrote(fakeOrder)) {
      hole("INSERT de pedido 'approved' por R$ 0,01 passou", reason(fakeOrder));
    } else {
      ok(`INSERT em orders — ${reason(fakeOrder)}`);
    }

    const patchOrder = await call(`/rest/v1/orders?user_id=eq.${userId}`, jwt, {
      method: "PATCH",
      body: JSON.stringify({ status: "approved" }),
    });
    if (wrote(patchOrder) && (patchOrder.rows ?? 0) > 0) {
      hole("UPDATE marcando o próprio pedido como pago passou", reason(patchOrder));
    } else {
      ok(`UPDATE em orders — ${reason(patchOrder)}`);
    }

    console.log("\n\x1b[1m3. Ler o curso sem pagar\x1b[0m");

    const lessons = await call("/rest/v1/lessons?select=id,title&limit=5", jwt);
    if ((lessons.rows ?? 0) > 0) {
      hole(`SELECT em lessons devolveu ${lessons.rows} lição(ões)`, "As 728 lições estão abertas.");
    } else {
      ok(`SELECT em lessons — 0 linhas (${reason(lessons)})`);
    }

    const chunks = await call("/rest/v1/knowledge_chunks?select=id,content&limit=5", jwt);
    if ((chunks.rows ?? 0) > 0) {
      hole(`SELECT em knowledge_chunks devolveu ${chunks.rows} trecho(s)`);
    } else {
      ok(`SELECT em knowledge_chunks — 0 linhas`);
    }

    const circuits = await call("/rest/v1/circuits?select=id,chunks", jwt);
    if ((circuits.rows ?? 0) > 0) {
      const blocks = Array.isArray(circuits.body)
        ? (circuits.body as { chunks?: unknown[] }[]).reduce(
            (n, c) => n + (c.chunks?.length ?? 0),
            0,
          )
        : 0;
      hole(
        `SELECT em circuits devolveu ${circuits.rows} circuito(s) e ${blocks} blocos de fala`,
        "circuits.chunks É o produto: o método inteiro é construído sobre eles.",
      );
    } else {
      ok("SELECT em circuits — 0 linhas");
    }

    /**
     * A porta dos fundos: `enroll_circuit_chunks` é SECURITY DEFINER, então
     * ignora a RLS de circuits e copia os blocos para a agenda do próprio
     * aluno — que ele pode ler. Fechar circuits sem fechar isto não protege
     * nada, e é por isso que o teste percorre os dois.
     */
    const courseProbe = await call("/rest/v1/courses?select=id&limit=1", jwt);
    const courseId = Array.isArray(courseProbe.body)
      ? (courseProbe.body as { id?: string }[])[0]?.id
      : undefined;

    if (courseId) {
      const backdoor = await call("/rest/v1/rpc/enroll_circuit_chunks", jwt, {
        method: "POST",
        body: JSON.stringify({ p_course_id: courseId, p_circuit_number: 1 }),
      });

      const mastery = await call("/rest/v1/chunk_mastery?select=chunk_en,chunk_pt", jwt);
      const extracted = mastery.rows ?? 0;

      if (extracted > 0) {
        hole(
          `enroll_circuit_chunks extraiu ${extracted} bloco(s) para chunk_mastery`,
          "Repetindo por circuito, leva o curso inteiro mesmo com circuits trancado.",
        );
      } else if (wrote(backdoor) && Number(backdoor.body) > 0) {
        hole("enroll_circuit_chunks gravou blocos sem acesso liberado", reason(backdoor));
      } else {
        ok(`rpc enroll_circuit_chunks — ${reason(backdoor)}`);
      }
    } else {
      warn("Não achei um curso para testar enroll_circuit_chunks");
    }

    // Storage: o bucket aceita 25 MB por arquivo. Sem trava, cadastro grátis
    // vira hospedagem grátis na sua fatura do Supabase.
    const upload = await fetch(`${url}/storage/v1/object/speaking-audio/${userId}/probe.webm`, {
      method: "POST",
      headers: {
        apikey: anonKey!,
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "audio/webm",
      },
      body: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]),
    });
    if (upload.ok) {
      hole(
        "Upload para o bucket speaking-audio passou sem pagamento",
        "Armazenamento grátis para qualquer um que criar conta.",
      );
    } else {
      ok(`Upload em speaking-audio — HTTP ${upload.status}`);
    }

    const enrollment = await call("/rest/v1/enrollments", jwt, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, course_id: "00000000-0000-0000-0000-000000000000" }),
    });
    if (wrote(enrollment)) {
      hole("INSERT em enrollments passou sem acesso liberado", reason(enrollment));
    } else {
      ok(`INSERT em enrollments — ${reason(enrollment)}`);
    }

    console.log("\n\x1b[1m4. Escalar privilégio\x1b[0m");

    const promote = await call(`/rest/v1/profiles?id=eq.${userId}`, jwt, {
      method: "PATCH",
      body: JSON.stringify({ role: "admin" }),
    });
    if (wrote(promote) && (promote.rows ?? 0) > 0) {
      hole("UPDATE profiles.role = 'admin' passou", reason(promote));
    } else {
      ok(`UPDATE profiles.role — ${reason(promote)}`);
    }

    const activate = await call(`/rest/v1/profiles?id=eq.${userId}`, jwt, {
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
    });
    if (wrote(activate) && (activate.rows ?? 0) > 0) {
      warn("UPDATE profiles.status passou", reason(activate));
    } else {
      ok(`UPDATE profiles.status — ${reason(activate)}`);
    }

    console.log("\n\x1b[1m5. Espiar dados de outras pessoas\x1b[0m");

    const otherOrders = await call("/rest/v1/orders?select=id,email,amount_cents&limit=20", jwt);
    const foreignOrders = Array.isArray(otherOrders.body)
      ? (otherOrders.body as { email?: string }[]).filter((o) => o.email !== email).length
      : 0;
    if (foreignOrders > 0) {
      hole(`SELECT em orders expôs ${foreignOrders} pedido(s) de outras pessoas`);
    } else {
      ok("SELECT em orders — só os próprios pedidos");
    }

    const otherGrants = await call("/rest/v1/access_grants?select=id,user_id&limit=20", jwt);
    const foreignGrants = Array.isArray(otherGrants.body)
      ? (otherGrants.body as { user_id?: string }[]).filter((g) => g.user_id !== userId).length
      : 0;
    if (foreignGrants > 0) {
      hole(`SELECT em access_grants expôs ${foreignGrants} concessão(ões) de terceiros`);
    } else {
      ok("SELECT em access_grants — só as próprias");
    }

    const profiles = await call("/rest/v1/profiles?select=id,email&limit=50", jwt);
    const foreignProfiles = Array.isArray(profiles.body)
      ? (profiles.body as { email?: string }[]).filter((p) => p.email !== email).length
      : 0;
    if (foreignProfiles > 0) {
      hole(`SELECT em profiles expôs ${foreignProfiles} conta(s) de outras pessoas`);
    } else {
      ok("SELECT em profiles — só o próprio perfil");
    }

    const audit = await call("/rest/v1/audit_log?select=id,action&limit=5", jwt);
    if ((audit.rows ?? 0) > 0) {
      hole(`SELECT em audit_log devolveu ${audit.rows} registro(s)`);
    } else {
      ok("SELECT em audit_log — 0 linhas");
    }

    // ------------------------------------------------- Sem login nenhum (anon)
    console.log("\n\x1b[1m6. Sem login (só a anon key, que é pública)\x1b[0m");

    const anonLessons = await call("/rest/v1/lessons?select=id&limit=5", anonKey);
    if ((anonLessons.rows ?? 0) > 0) {
      hole(`Anônimo leu ${anonLessons.rows} lição(ões)`);
    } else {
      ok("Anônimo em lessons — 0 linhas");
    }

    const anonGrant = await call("/rest/v1/rpc/grant_course_access", anonKey, {
      method: "POST",
      body: JSON.stringify({ p_user: userId, p_source: "courtesy" }),
    });
    if (wrote(anonGrant)) {
      hole("Anônimo executou grant_course_access", reason(anonGrant));
    } else {
      ok(`Anônimo em grant_course_access — ${reason(anonGrant)}`);
    }

    const anonProfiles = await call("/rest/v1/profiles?select=email&limit=5", anonKey);
    if ((anonProfiles.rows ?? 0) > 0) {
      hole(`Anônimo listou ${anonProfiles.rows} e-mail(s) de alunos`);
    } else {
      ok("Anônimo em profiles — 0 linhas");
    }
  } finally {
    // ------------------------------------------------------------- Limpeza
    // Se o upload passou (brecha), o arquivo ficou no bucket. Apagar o usuário
    // não apaga objeto do Storage: isso é feito aqui, com service_role.
    if (userId) {
      await fetch(`${url}/storage/v1/object/speaking-audio/${userId}/probe.webm`, {
        method: "DELETE",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      }).catch(() => {});
    }

    if (userId) {
      const del = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      console.log(
        del.ok
          ? `\n\x1b[2mUsuário de teste removido.\x1b[0m`
          : `\n\x1b[33mRemova manualmente o usuário ${email} (HTTP ${del.status})\x1b[0m`,
      );
    }
  }

  console.log("");
  if (holes === 0) {
    console.log("\x1b[32m\x1b[1m✓ Nenhuma brecha: o paywall resiste a um aluno logado.\x1b[0m\n");
  } else {
    console.log(`\x1b[31m\x1b[1m✗ ${holes} BRECHA(S) — corrija antes de vender.\x1b[0m\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\n\x1b[31mErro inesperado no teste:\x1b[0m", error);
  process.exitCode = 1;
});
