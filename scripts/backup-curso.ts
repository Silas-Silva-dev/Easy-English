/**
 * Guarda em disco o que está no banco, antes de sobrescrever.
 *
 *   npm run backup:curso              salva
 *   npm run backup:curso -- --restaurar .backup/curso-<data>.json
 *
 * ===========================================================================
 * POR QUE ISTO EXISTE
 * ===========================================================================
 * O app resolve o curso por slug fixo (`ingles-para-conversacao`) com
 * `is_published = true` e `maybeSingle()`. Isso tem uma consequência que só
 * aparece na hora de trocar o conteúdo: NÃO DÁ para ter dois cursos. Uma
 * segunda linha com outro slug o app nunca acharia; com o mesmo slug e as duas
 * publicadas, o `maybeSingle()` quebra.
 *
 * Ou seja: "desativar o antigo e ativar o novo" não é virar uma chave entre
 * duas linhas. É sobrescrever as 728 lições e os 52 circuitos da única linha
 * que existe. Sobrescrever sem cópia é o tipo de operação que só se percebe
 * como erro depois.
 *
 * O código-fonte do curso antigo está na tag do git, então em teoria dá para
 * reconstruí-lo. Este arquivo é a garantia prática: restaurar daqui são
 * segundos, e reconstruir do fonte é fazer o caminho todo de novo.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { progress, supabaseAdmin } from "./_shared";

const DIR = join(process.cwd(), ".backup");
const SLUG = "ingles-para-conversacao";

interface Dump {
  salvoEm: string;
  curso: Record<string, unknown>;
  circuitos: Record<string, unknown>[];
  licoes: Record<string, unknown>[];
}

/**
 * Lê uma tabela inteira em páginas.
 *
 * O PostgREST corta em 1.000 linhas por resposta, em silêncio. Sem paginar, um
 * backup de 728 lições sairia com 728 e um de 1.400 sairia com 1.000 — e o
 * arquivo pareceria bom.
 */
async function lerTudo(
  sb: ReturnType<typeof supabaseAdmin>,
  tabela: "circuits" | "lessons",
  courseId: string,
): Promise<Record<string, unknown>[]> {
  const saida: Record<string, unknown>[] = [];
  const PAGINA = 500;

  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await sb
      .from(tabela)
      .select("*")
      .eq("course_id", courseId)
      .range(de, de + PAGINA - 1);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    saida.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < PAGINA) break;
  }

  return saida;
}

async function salvar() {
  const sb = supabaseAdmin();

  const { data: curso, error } = await sb.from("courses").select("*").eq("slug", SLUG).single();
  if (error || !curso) throw new Error(`curso "${SLUG}" não encontrado: ${error?.message}`);

  console.log(`\n\x1b[1m▸ Backup do curso\x1b[0m`);
  console.log(`  ${curso.title}  (${curso.is_published ? "publicado" : "rascunho"})`);

  const circuitos = await lerTudo(sb, "circuits", curso.id);
  const licoes = await lerTudo(sb, "lessons", curso.id);

  const dump: Dump = {
    salvoEm: new Date().toISOString(),
    curso: curso as Record<string, unknown>,
    circuitos,
    licoes,
  };

  mkdirSync(DIR, { recursive: true });
  const nome = `curso-${dump.salvoEm.replace(/[:.]/g, "-")}.json`;
  const caminho = join(DIR, nome);
  writeFileSync(caminho, JSON.stringify(dump, null, 2), "utf8");

  const mb = (Buffer.byteLength(JSON.stringify(dump)) / 1024 / 1024).toFixed(1);
  console.log(`  ${circuitos.length} circuitos, ${licoes.length} lições`);
  console.log(`\n  \x1b[32m✓\x1b[0m .backup/${nome}  (${mb} MB)\n`);
}

async function restaurar(caminho: string) {
  const sb = supabaseAdmin();
  const dump = JSON.parse(readFileSync(caminho, "utf8")) as Dump;

  console.log(`\n\x1b[1m▸ Restaurando\x1b[0m ${caminho}`);
  console.log(`  salvo em ${dump.salvoEm}`);
  console.log(`  ${dump.circuitos.length} circuitos, ${dump.licoes.length} lições\n`);

  const cursoId = dump.curso.id as string;

  await sb.from("courses").upsert(dump.curso as never, { onConflict: "slug" });

  for (let i = 0; i < dump.circuitos.length; i += 100) {
    const lote = dump.circuitos.slice(i, i + 100);
    const { error } = await sb.from("circuits").upsert(lote as never, { onConflict: "course_id,number" });
    if (error) throw new Error(`circuits: ${error.message}`);
    progress(Math.min(i + 100, dump.circuitos.length), dump.circuitos.length, "circuitos");
  }

  for (let i = 0; i < dump.licoes.length; i += 100) {
    const lote = dump.licoes.slice(i, i + 100);
    const { error } = await sb.from("lessons").upsert(lote as never, { onConflict: "course_id,day_number" });
    if (error) throw new Error(`lessons: ${error.message}`);
    progress(Math.min(i + 100, dump.licoes.length), dump.licoes.length, "lições");
  }

  console.log(`\n  \x1b[32m✓\x1b[0m Restaurado no curso ${cursoId}\n`);
}

async function main() {
  const i = process.argv.indexOf("--restaurar");
  if (i >= 0) {
    const caminho = process.argv[i + 1];
    if (!caminho) throw new Error("--restaurar precisa do caminho do arquivo");
    await restaurar(caminho);
    return;
  }
  await salvar();
}

main().catch((error) => {
  console.error("\n✗ Erro:", error instanceof Error ? error.message : error);
  process.exit(1);
});
