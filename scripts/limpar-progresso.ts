/**
 * Apaga o progresso que pertence ao curso antigo.
 *
 *   npm run limpar:progresso -- --dry     mostra o que apagaria
 *   npm run limpar:progresso -- --sim     apaga de verdade
 *
 * ===========================================================================
 * POR QUE PRECISA SER APAGADO
 * ===========================================================================
 * O conteúdo dos 52 circuitos foi refeito: 51 dos 52 títulos mudaram e nenhum
 * dos blocos do circuito 1 sobreviveu — o aluno aprendia "Hi, I'm Ana." e agora
 * aprende "Hi, I'm Alex.". As três tabelas abaixo guardam progresso medido
 * contra o curso que não existe mais:
 *
 *   lesson_progress  o dia 5 marcado como concluído é o dia 5 ANTIGO. Manter
 *                    faz o aluno pular uma lição que ele nunca viu.
 *   chunk_mastery    a agenda de revisão. Os 14 blocos agendados foram
 *                    conferidos: ZERO existem no curso novo, então são cartões
 *                    de revisão de frases que ninguém mais estuda.
 *   study_days       o registro de minutos por dia, medido contra as metas
 *                    antigas de cada trilha.
 *
 * ===========================================================================
 * O QUE NÃO É APAGADO, E POR QUÊ
 * ===========================================================================
 * `speaking_sessions` e `speaking_feedback` são as GRAVAÇÕES do aluno e as
 * correções que ele recebeu. Não são progresso: são trabalho dele. Ficam.
 *
 * `certificates` é credencial emitida. Apagar certificado é outra decisão, e
 * não é esta.
 *
 * `enrollments` é a matrícula — apagá-la desmatricularia o aluno. Ela é
 * reaproveitada: o curso é o mesmo, o conteúdo é que mudou.
 *
 * O backup sai antes de qualquer DELETE, em `.backup/`. Sem `--sim` nada é
 * apagado.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { supabaseAdmin } from "./_shared";

const DIR = join(process.cwd(), ".backup");

/** As tabelas de progresso medido contra o conteúdo do curso. */
const TABELAS = ["lesson_progress", "chunk_mastery", "study_days"] as const;

const DRY = !process.argv.includes("--sim");

async function main() {
  const sb = supabaseAdmin();

  console.log(`\n\x1b[1m▸ Limpando o progresso do curso antigo\x1b[0m\n`);

  const dump: Record<string, unknown[]> = {};
  let total = 0;

  for (const t of TABELAS) {
    const { data, error } = await sb.from(t).select("*");
    if (error) throw new Error(`${t}: ${error.message}`);
    dump[t] = data ?? [];
    total += data?.length ?? 0;
    console.log(`  ${t.padEnd(18)} ${data?.length ?? 0} linha(s)`);
  }

  // O que fica, dito em voz alta: quem lê a saída precisa saber o que NÃO
  // aconteceu tanto quanto o que aconteceu.
  for (const t of ["speaking_sessions", "speaking_feedback", "certificates", "enrollments"] as const) {
    const { count } = await sb.from(t).select("*", { count: "exact", head: true });
    console.log(`  ${t.padEnd(18)} ${count ?? 0} linha(s)  \x1b[2m(preservada)\x1b[0m`);
  }

  if (DRY) {
    console.log(`\n  ${total} linha(s) seriam apagadas. Rode com --sim para apagar.\n`);
    return;
  }

  mkdirSync(DIR, { recursive: true });
  const nome = `progresso-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(join(DIR, nome), JSON.stringify(dump, null, 2), "utf8");
  console.log(`\n  backup: .backup/${nome}`);

  for (const t of TABELAS) {
    // `neq` num campo que nunca é nulo é o jeito de dizer "todas as linhas" ao
    // PostgREST, que recusa DELETE sem cláusula.
    const { error } = await sb.from(t).delete().not("id", "is", null);
    if (error) throw new Error(`${t}: ${error.message}`);
    console.log(`  ${t}: apagada`);
  }

  console.log(`\n  \x1b[32m✓\x1b[0m ${total} linha(s) apagadas. Os alunos recomeçam no dia 1 do curso novo.\n`);
}

main().catch((error) => {
  console.error("\n✗ Erro:", error instanceof Error ? error.message : error);
  process.exit(1);
});
