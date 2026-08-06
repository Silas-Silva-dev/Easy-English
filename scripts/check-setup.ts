/**
 * Diagnóstico de configuração.
 *
 *   npm run check
 *
 * Verifica, em ordem: variáveis de ambiente, conexão com o Supabase,
 * migrations aplicadas, buckets de storage e acesso à API do Gemini.
 * Cada falha vem com a instrução de como corrigir.
 */

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

import { TOTAL_DAYS } from "@content/curriculum";

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

/**
 * Cliente sem tipagem de Database de propósito: este script roda justamente
 * quando as tabelas podem não existir.
 */
function makeAdmin(url: string, key: string) {
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

type AdminClient = ReturnType<typeof makeAdmin>;

/**
 * Verifica se a tabela existe.
 *
 * ATENÇÃO: não use `{ head: true }` aqui. Uma requisição HEAD não tem corpo,
 * então o PostgREST responde 204 e o supabase-js devolve `error: null` mesmo
 * quando a tabela NÃO existe: o teste passa em um banco vazio. É preciso um
 * GET de verdade para o erro 404 chegar.
 */
async function tableExists(
  db: AdminClient,
  table: string,
): Promise<{ exists: boolean; message?: string }> {
  const { error } = await db.from(table).select("*").limit(1);
  if (!error) return { exists: true };
  if (/does not exist|schema cache|Could not find the table/i.test(error.message)) {
    return { exists: false, message: error.message };
  }
  // Erro de permissão significa que a tabela existe, mas a RLS barrou.
  return { exists: true, message: error.message };
}

async function countRows(db: AdminClient, table: string): Promise<number> {
  const { count } = await db.from(table).select("*", { count: "exact" }).limit(1);
  return count ?? 0;
}

/**
 * Toda tabela que o schema cria. Manter esta lista completa é o que faz o
 * diagnóstico detectar migration que ficou para trás: uma lista desatualizada
 * dá "tudo certo" num banco pela metade, que é pior do que não ter diagnóstico.
 */
const TABLES = [
  "profiles",
  "courses",
  "modules",
  "circuits",
  "lessons",
  "enrollments",
  "lesson_progress",
  "study_days",
  "speaking_sessions",
  "speaking_feedback",
  "knowledge_chunks",
  "audit_log",
  "admin_allowlist",
  // migration 20260101000400: trilhas, SRS por bloco e conversa ao vivo
  "track_targets",
  "chunk_mastery",
  "live_sessions",
];

async function main() {
  console.log("\n\x1b[1mDiagnóstico do Easy English\x1b[0m\n");

  // ----------------------------------------------------- 1. Variáveis
  console.log("\x1b[1m1. Variáveis de ambiente\x1b[0m");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (!url) fail("NEXT_PUBLIC_SUPABASE_URL ausente");
  else if (/\/rest\/v1|\/auth\/v1|\/$/.test(url)) {
    fail(
      `NEXT_PUBLIC_SUPABASE_URL tem caminho ou barra no fim: ${url}`,
      "Use apenas https://<ref>.supabase.co: o cliente acrescenta o resto.",
    );
  } else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url)) {
    warn(`URL em formato incomum: ${url}`, "Confira em Settings → Data API → Project URL.");
  } else ok(`URL do projeto: ${url}`);

  if (!anonKey) fail("NEXT_PUBLIC_SUPABASE_ANON_KEY ausente");
  else ok(`Anon key presente (${anonKey.slice(0, 12)}…, ${anonKey.length} chars)`);

  if (!serviceKey) fail("SUPABASE_SERVICE_ROLE_KEY ausente");
  else if (serviceKey === anonKey) {
    fail("A service_role key é igual à anon key", "São chaves diferentes: copie a correta.");
  } else ok(`Service role key presente (${serviceKey.slice(0, 12)}…)`);

  if (!geminiKey) fail("GEMINI_API_KEY ausente");
  else ok(`Gemini key presente (${geminiKey.slice(0, 8)}…, ${geminiKey.length} chars)`);

  // ------------------------------------------------------ 2. Supabase
  console.log("\n\x1b[1m2. Conexão com o Supabase\x1b[0m");

  if (url && serviceKey) {
    const admin = makeAdmin(url, serviceKey);

    let schemaReady = false;

    try {
      const probe = await tableExists(admin, "profiles");

      if (!probe.exists) {
        fail(
          "Conectou, mas as tabelas não existem",
          "Cole supabase/schema.sql no SQL Editor do Supabase e clique em Run.",
        );
      } else {
        ok("Service role autenticou e leu o schema");
        schemaReady = true;
      }
    } catch (error) {
      fail(
        `Não foi possível conectar: ${error instanceof Error ? error.message : error}`,
        "Verifique a URL e a service_role key.",
      );
    }

    // ------------------------------------------------ 3. Schema
    console.log("\n\x1b[1m3. Schema aplicado\x1b[0m");

    const missing: string[] = [];
    for (const table of TABLES) {
      const result = await tableExists(admin, table);
      if (!result.exists) missing.push(table);
    }

    if (missing.length === TABLES.length) {
      fail(
        "Nenhuma tabela encontrada: o banco está vazio",
        "Cole supabase/schema.sql no SQL Editor (as migrations já na ordem certa).",
      );
    } else if (missing.length) {
      fail(
        `${missing.length} tabela(s) faltando: ${missing.join(", ")}`,
        "Reaplique as migrations na ordem: elas são idempotentes.",
      );
    } else {
      ok(`Todas as ${TABLES.length} tabelas presentes`);

      // Tabela existir não garante que a última migration rodou: `circuit_day`
      // veio na 20260101000500 e é o que o cronograma usa para agrupar os dias.
      const { error: columnError } = await admin.from("lessons").select("circuit_day").limit(1);
      if (columnError && /circuit_day/i.test(columnError.message)) {
        fail(
          "Coluna lessons.circuit_day ausente",
          "Falta a migration 20260101000500_local_content.sql: reaplique supabase/schema.sql.",
        );
      } else {
        ok("Colunas da grade de 14 dias presentes");
      }

      const [courses, lessons, users] = await Promise.all([
        countRows(admin, "courses"),
        countRows(admin, "lessons"),
        countRows(admin, "profiles"),
      ]);

      console.log(`    \x1b[2mcursos: ${courses} · lições: ${lessons} · usuários: ${users}\x1b[0m`);

      if (!lessons) warn("Nenhuma lição cadastrada", "Rode: npm run seed:curriculum");
      else if (lessons < TOTAL_DAYS) {
        warn(
          `Só ${lessons} de ${TOTAL_DAYS} lições no banco`,
          "Rode: npm run seed:curriculum (ele publica o curso inteiro)",
        );
      }
    }

    if (!schemaReady) {
      console.log("\n\x1b[2m  (pulando testes de pgvector e storage: schema ausente)\x1b[0m");
      console.log(
        `\n\x1b[31m\x1b[1m✗ ${failures} problema(s).\x1b[0m Aplique as migrations e rode: npm run check\n`,
      );
      process.exit(1);
    }

    // ------------------------------------------------ 4. Extensão vector
    console.log("\n\x1b[1m4. pgvector e RPCs\x1b[0m");

    // Passa os 4 argumentos, exatamente como src/lib/gemini/tutor.ts faz: // o PostgREST casa a assinatura pelo conjunto de nomes recebido.
    const { error: rpcError } = await admin.rpc("match_knowledge", {
      query_embedding: Array(768).fill(0),
      match_count: 1,
      filter_course: null,
      similarity_floor: 0.35,
    });

    if (rpcError) {
      if (/function .* does not exist/i.test(rpcError.message)) {
        fail("RPC match_knowledge não existe", "Aplique a migration init.sql completa.");
      } else if (/type "vector"|extension/i.test(rpcError.message)) {
        fail(
          "Extensão pgvector não habilitada",
          "Supabase → Database → Extensions → habilite 'vector'.",
        );
      } else {
        warn(`match_knowledge respondeu com: ${rpcError.message}`);
      }
    } else {
      ok("pgvector ativo e match_knowledge disponível");
    }

    // ------------------------------------------------ 5. Storage
    console.log("\n\x1b[1m5. Buckets de storage\x1b[0m");

    const { data: buckets, error: bucketError } = await admin.storage.listBuckets();

    if (bucketError) {
      fail(`Não foi possível listar buckets: ${bucketError.message}`);
    } else {
      const names = new Set((buckets ?? []).map((b) => b.name));
      for (const expected of ["speaking-audio", "avatars", "course-assets"]) {
        if (names.has(expected)) ok(`bucket "${expected}"`);
        else fail(`bucket "${expected}" ausente`, "Aplique 20260101000200_storage.sql.");
      }
    }
  } else {
    warn("Pulando testes do Supabase: credenciais incompletas");
  }

  // -------------------------------------------------------- 6. Gemini
  console.log("\n\x1b[1m6. API do Gemini\x1b[0m");

  if (geminiKey) {
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL_SPEAKING?.trim() || "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: "Reply with exactly: OK" }] }],
        config: { maxOutputTokens: 2000, temperature: 0 },
      });

      const text = response.text?.trim() ?? "";
      if (text) ok(`Modelo de conversação respondeu ("${text.slice(0, 24)}")`);
      else warn("Modelo respondeu vazio", "Chave válida, mas resposta sem texto.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/API_KEY_INVALID|API key not valid|invalid.*api.?key/i.test(message)) {
        fail(
          "Chave do Gemini inválida",
          "Gere uma nova em https://aistudio.google.com/apikey (formato AIza...).",
        );
      } else if (/PERMISSION_DENIED|403/i.test(message)) {
        fail("Acesso negado", "A chave existe mas não tem permissão para a Generative Language API.");
      } else if (/quota|429/i.test(message)) {
        warn("Cota atingida", "A chave funciona, mas está sem cota no momento.");
      } else {
        fail(`Falha ao chamar o Gemini: ${message.slice(0, 220)}`);
      }
    }

    // Embeddings usam um endpoint diferente: vale testar separado.
    try {
      const embedding = await ai.models.embedContent({
        model: process.env.GEMINI_MODEL_EMBEDDING?.trim() || "gemini-embedding-001",
        contents: [{ role: "user", parts: [{ text: "teste" }] }],
        config: { outputDimensionality: 768, taskType: "RETRIEVAL_DOCUMENT" },
      });

      const dims = embedding.embeddings?.[0]?.values?.length ?? 0;
      if (dims === 768) ok(`Modelo de embedding respondeu (${dims} dimensões)`);
      else fail(`Embedding com ${dims} dimensões`, "A coluna do banco espera vector(768).");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fail(`Modelo de embedding falhou: ${message.slice(0, 220)}`);
    }
  } else {
    warn("Pulando teste do Gemini: chave ausente");
  }

  // ------------------------------------------------------- Resultado
  console.log("");
  if (failures === 0) {
    console.log("\x1b[32m\x1b[1m✓ Tudo pronto.\x1b[0m Rode: npm run dev\n");
  } else {
    console.log(
      `\x1b[31m\x1b[1m✗ ${failures} problema(s) encontrado(s).\x1b[0m Corrija e rode de novo: npm run check\n`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n✗ Erro inesperado:", error instanceof Error ? error.message : error);
  process.exit(1);
});
