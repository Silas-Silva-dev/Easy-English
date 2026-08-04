/**
 * Concatena as migrations em um único arquivo colável no SQL Editor.
 *
 *   npm run db:bundle   →   supabase/schema.sql
 *
 * Rode sempre que editar qualquer migration, para o bundle não divergir.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const OUTPUT = join(process.cwd(), "supabase", "schema.sql");

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort(); // o prefixo numérico garante a ordem correta

if (!files.length) {
  console.error("\n✗ Nenhuma migration encontrada em supabase/migrations/\n");
  process.exit(1);
}

const header = `-- ===========================================================================
-- Easy English: schema completo (arquivo GERADO)
--
-- Não edite este arquivo: ele é a concatenação de supabase/migrations/ na
-- ordem correta. Edite as migrations e rode \`npm run db:bundle\`.
--
-- COMO USAR: cole tudo no SQL Editor do Supabase e clique em Run.
-- É idempotente: pode rodar mais de uma vez sem duplicar nada.
--
-- Migrations incluídas:
${files.map((f, i) => `--   ${i + 1}. ${f}`).join("\n")}
-- ===========================================================================


`;

const body = files
  .map((file) => {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8").trimEnd();
    return `-- ###########################################################################\n-- ## ${file}\n-- ###########################################################################\n\n${sql}\n`;
  })
  .join("\n\n");

writeFileSync(OUTPUT, header + body, "utf8");

const lines = (header + body).split("\n").length;
console.log(`\n✓ supabase/schema.sql gerado: ${files.length} migrations, ${lines} linhas\n`);
for (const file of files) console.log(`   ${file}`);
console.log("\n  Cole o arquivo no SQL Editor do Supabase e clique em Run.\n");
