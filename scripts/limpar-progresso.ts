/**
 * Devolve todos os alunos ao dia 1, sem desmatricular ninguém.
 *
 *   npm run limpar:progresso            mostra o que apagaria
 *   npm run limpar:progresso -- --sim   apaga de verdade
 *
 * ===========================================================================
 * POR QUE PRECISA SER APAGADO
 * ===========================================================================
 * O conteúdo dos 52 circuitos foi refeito: 51 dos 52 títulos mudaram e nenhum
 * dos blocos do circuito 1 sobreviveu — o aluno aprendia "Hi, I'm Ana." e agora
 * aprende "Hi, I'm Alex.". Progresso medido contra um curso que não existe mais
 * não é progresso: é um número que mente.
 *
 * ===========================================================================
 * APAGAR AS TABELAS NÃO BASTAVA
 * ===========================================================================
 * A primeira versão limpava `lesson_progress`, `chunk_mastery` e `study_days` e
 * preservava `enrollments` — com a justificativa, correta, de que apagar a
 * matrícula desmatricularia o aluno.
 *
 * Só que a matrícula não guarda só o vínculo. Ela guarda `current_day`,
 * `streak_current`, `minutes_total` e `lessons_completed`, e é DELA que a tela
 * inicial tira "Dia 8", "1 lição concluída" e "46 min praticados". Depois de
 * rodar a limpeza, o painel continuava mostrando o aluno no dia 8 de um curso
 * que ele nunca começou — e o "Iniciar lição do dia" abria a lição 8.
 *
 * A matrícula fica, então, mas ZERADA: os contadores voltam ao estado de quem
 * acabou de comprar. É a diferença entre desmatricular e recomeçar.
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
 * O backup sai antes de qualquer DELETE, em `.backup/`. Sem `--sim` nada é
 * apagado.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { supabaseAdmin } from "./_shared";

const DIR = join(process.cwd(), ".backup");

/**
 * As tabelas de progresso, com a coluna que serve de "todas as linhas".
 *
 * O PostgREST recusa DELETE sem cláusula, e `not(col, is, null)` numa coluna
 * que nunca é nula é o jeito de dizer "todas". A coluna varia porque as tabelas
 * novas do método são chaveadas por par (aluno, coisa) e não têm `id`.
 */
const TABELAS = [
  { nome: "lesson_progress", chave: "id", o_que: "dias marcados como concluídos" },
  { nome: "chunk_mastery", chave: "id", o_que: "a agenda de revisão espaçada" },
  { nome: "study_days", chave: "id", o_que: "minutos e metas por dia" },
  { nome: "listening_exposures", chave: "user_id", o_que: "as escutas do portão" },
  { nome: "circuit_gate_status", chave: "user_id", o_que: "as avaliações de portão" },
] as const;

/** O estado de uma matrícula recém-criada. Ver o cabeçalho. */
const MATRICULA_ZERADA = {
  current_day: 1,
  streak_current: 0,
  streak_longest: 0,
  minutes_total: 0,
  lessons_completed: 0,
  last_activity_date: null,
  completed_at: null,
  status: "active",
} as const;

const DRY = !process.argv.includes("--sim");

async function main() {
  const sb = supabaseAdmin();

  console.log(`\n\x1b[1m▸ Devolvendo os alunos ao dia 1\x1b[0m\n`);

  const dump: Record<string, unknown[]> = {};
  let total = 0;

  for (const t of TABELAS) {
    const { data, error } = await sb.from(t.nome).select("*");
    // Tabela ausente = migration não aplicada neste banco. Não é motivo para
    // abortar a limpeza das outras: é motivo para dizer que ela não existe.
    if (error) {
      console.log(`  ${t.nome.padEnd(21)} \x1b[2m—  ${error.message}\x1b[0m`);
      continue;
    }
    dump[t.nome] = data ?? [];
    total += data?.length ?? 0;
    console.log(
      `  ${t.nome.padEnd(21)} ${String(data?.length ?? 0).padStart(5)} linha(s)  \x1b[2m${t.o_que}\x1b[0m`,
    );
  }

  const { data: matriculas } = await sb
    .from("enrollments")
    .select("id, user_id, track, current_day, minutes_total, lessons_completed, streak_current");
  dump.enrollments = matriculas ?? [];

  const adiantadas = (matriculas ?? []).filter(
    (m) => m.current_day > 1 || m.minutes_total > 0 || m.lessons_completed > 0,
  );
  console.log(
    `  ${"enrollments".padEnd(21)} ${String(adiantadas.length).padStart(5)} de ${matriculas?.length ?? 0} com progresso  \x1b[2mcontadores zerados, matrícula preservada\x1b[0m`,
  );

  // O que fica, dito em voz alta: quem lê a saída precisa saber o que NÃO
  // aconteceu tanto quanto o que aconteceu.
  console.log("");
  for (const t of ["speaking_sessions", "speaking_feedback", "certificates"] as const) {
    const { count } = await sb.from(t).select("*", { count: "exact", head: true });
    console.log(`  ${t.padEnd(21)} ${String(count ?? 0).padStart(5)} linha(s)  \x1b[2m(preservada)\x1b[0m`);
  }

  if (DRY) {
    console.log(
      `\n  ${total} linha(s) seriam apagadas e ${adiantadas.length} matrícula(s) zeradas.` +
        `\n  Rode com --sim para valer.\n`,
    );
    return;
  }

  mkdirSync(DIR, { recursive: true });
  const nome = `progresso-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(join(DIR, nome), JSON.stringify(dump, null, 2), "utf8");
  console.log(`\n  backup: .backup/${nome}`);

  for (const t of TABELAS) {
    if (!(t.nome in dump)) continue;
    const { error } = await sb.from(t.nome).delete().not(t.chave, "is", null);
    if (error) throw new Error(`${t.nome}: ${error.message}`);
    console.log(`  ${t.nome}: apagada`);
  }

  const { error: erroMatricula } = await sb
    .from("enrollments")
    .update(MATRICULA_ZERADA)
    .not("id", "is", null);
  if (erroMatricula) throw new Error(`enrollments: ${erroMatricula.message}`);
  console.log(`  enrollments: contadores zerados`);

  console.log(
    `\n  \x1b[32m✓\x1b[0m ${total} linha(s) apagadas, ${matriculas?.length ?? 0} matrícula(s) no dia 1.\n`,
  );
}

main().catch((error) => {
  console.error("\n✗ Erro:", error instanceof Error ? error.message : error);
  process.exit(1);
});
