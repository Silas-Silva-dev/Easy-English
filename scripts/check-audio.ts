/**
 * Quais áudios do curso o aluno ouve na voz gerada — e quais caem na voz do
 * navegador.
 *
 *   npm run check:audio
 *   npm run check:audio -- --list        # lista cada texto órfão
 *
 * ===========================================================================
 * POR QUE ISTO PRECISA EXISTIR
 * ===========================================================================
 * O player não busca o áudio por id de lição: ele deriva o nome do arquivo do
 * PRÓPRIO TEXTO, via `audioId()` (ver src/lib/audio-id.ts). Isso dá geração
 * retomável e invalidação automática, mas cria uma condição silenciosa:
 *
 *   texto no banco ≠ texto em content/  →  hash diferente  →  arquivo não
 *   existe  →  o player cai na voz do navegador, sem erro nenhum na tela.
 *
 * `npm run gen:audio --dry-run` NÃO enxerga isso: ele compara content/ com o
 * disco e diz "está completo". O aluno, que lê o banco, ouve outra coisa.
 *
 * Este script compara os três lados — banco, content/ e disco — que é a única
 * forma de saber o que o aluno realmente escuta.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { audioJobs } from "@content/audio-manifest";

import { audioId } from "../src/lib/audio-id";

import { supabaseAdmin } from "./_shared";

const OUT_DIR = join(process.cwd(), "public", "audio");

const ok = (msg: string) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const bad = (msg: string) => console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
const info = (msg: string) => console.log(`    \x1b[2m${msg}\x1b[0m`);

interface Missing {
  text: string;
  id: string;
  day: number;
  kind: "bloco" | "diálogo de imersão" | "diálogo de escuta";
}

/**
 * Raio-x de UM dia: exatamente os arquivos que aquela tela vai pedir.
 *
 * Existe porque "o dia 2 está na voz do navegador" e "faltam 17 áudios no
 * curso" são perguntas diferentes — e a segunda pode estar verde enquanto a
 * primeira está vermelha, se o texto daquele dia divergiu.
 */
async function inspectDay(day: number, site: string | null) {
  const supabase = supabaseAdmin();
  const { data: lesson } = await supabase
    .from("lessons")
    .select("day_number, title, chunks, immersion_script, listening_script")
    .eq("day_number", day)
    .maybeSingle();

  if (!lesson) {
    bad(`Dia ${day} não existe no banco.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n\x1b[1mDia ${lesson.day_number} — ${lesson.title}\x1b[0m\n`);

  const rows: { kind: string; text: string }[] = [
    ...(lesson.chunks ?? []).map((c) => ({ kind: "bloco", text: c.en ?? "" })),
    { kind: "imersão", text: lesson.immersion_script ?? "" },
    { kind: "escuta", text: lesson.listening_script ?? "" },
  ].filter((r) => r.text.trim());

  for (const row of rows) {
    const text = row.text.trim();
    const id = audioId(text);
    const local = existsSync(join(OUT_DIR, `${id}.mp3`));

    let remote = "";
    if (site) {
      try {
        const response = await fetch(`${site}/audio/${id}.mp3`, {
          method: "HEAD",
        });
        remote = response.ok
          ? `  no ar: ${response.headers.get("content-type") ?? "?"}`
          : `  no ar: HTTP ${response.status}`;
      } catch {
        remote = "  no ar: inacessível";
      }
    }

    const mark = local
      ? "\x1b[32m✓\x1b[0m"
      : "\x1b[31m✗ voz do navegador\x1b[0m";
    console.log(`  ${mark}  ${row.kind.padEnd(8)} ${id}${remote}`);
    console.log(`      \x1b[2m${text.slice(0, 88)}\x1b[0m`);
  }

  console.log("");
}

async function main() {
  const list = process.argv.includes("--list");

  const dayFlag = process.argv.indexOf("--day");
  if (dayFlag !== -1) {
    const siteFlag = process.argv.indexOf("--site");
    const site =
      siteFlag !== -1 ? process.argv[siteFlag + 1]?.replace(/\/$/, "") : null;
    await inspectDay(Number(process.argv[dayFlag + 1]), site ?? null);
    return;
  }

  console.log("\n\x1b[1mÁudio das lições — banco × content × disco\x1b[0m\n");

  // ------------------------------------------------------ 1. Lado do content
  const jobs = audioJobs();
  const catalogIds = new Set(jobs.map((j) => j.id));
  const onDisk = new Set(
    jobs
      .filter((j) => existsSync(join(OUT_DIR, `${j.id}.mp3`)))
      .map((j) => j.id),
  );

  console.log("\x1b[1m1. Catálogo (content/) × disco\x1b[0m");
  if (onDisk.size === catalogIds.size) {
    ok(`${catalogIds.size} áudios do catálogo, todos gravados`);
  } else {
    bad(`${catalogIds.size - onDisk.size} do catálogo ainda sem arquivo`);
    info("Rode: npm run gen:audio");
  }

  /**
   * Qual motor fez cada arquivo.
   *
   * É a conferência de "trocamos mesmo de TTS?". O nome do arquivo vem do
   * texto, não do motor, então ouvir um arquivo não diz quem o gerou — só o
   * livro-razão diz. Um arquivo em disco SEM registro é de antes de o registro
   * existir, e conta como não migrado.
   */
  /**
   * Uma entrada do livro-razão.
   *
   * Começou como o nome do motor, uma string solta. Passou a guardar também o
   * MODELO quando o problema deixou de ser "de qual motor saiu" e virou "de
   * qual modelo" — misturar modelos dá timbres diferentes para o mesmo
   * personagem. As duas formas convivem no arquivo, então ler exige aceitar
   * as duas: tratar tudo como string fazia cada objeto virar sua própria
   * chave no agrupamento, e o relatório listava 500 linhas de
   * "1 · 0% [object Object]" em vez de um resumo.
   */
  type LedgerEntry = string | { engine: string; model?: string };

  let ledger: Record<string, LedgerEntry> = {};
  try {
    ledger = JSON.parse(
      readFileSync(join(OUT_DIR, "engines.json"), "utf8"),
    ) as Record<string, LedgerEntry>;
  } catch {
    /* sem livro-razão: tudo cai em "sem registro" abaixo */
  }

  /** O modelo, quando registrado; senão o motor. É o que interessa ao ouvido. */
  const rotulo = (entry: LedgerEntry | undefined): string => {
    if (!entry) return "sem registro";
    if (typeof entry === "string") return entry;
    return entry.model ?? entry.engine;
  };

  const byEngine = new Map<string, number>();
  for (const id of onDisk) {
    const engine = rotulo(ledger[id]);
    byEngine.set(engine, (byEngine.get(engine) ?? 0) + 1);
  }

  console.log("\n\x1b[1m2. Motor de cada arquivo\x1b[0m");
  for (const [engine, count] of [...byEngine].sort((a, b) => b[1] - a[1])) {
    const pct = Math.round((count / onDisk.size) * 100);
    const line = `${String(count).padStart(4)} · ${String(pct).padStart(3)}%  ${engine}`;
    if (engine === "sem registro") bad(line);
    else ok(line);
  }

  /**
   * A voz dominante, para o relatório não afirmar um motor que já saiu de cena.
   *
   * Estava escrito "Piper" no texto fixo. Depois da migração para o Gemini o
   * relatório passou a dizer que 478 áudios tocavam numa voz que nenhum deles
   * usava mais — e é justamente este relatório que se consulta para saber se a
   * migração terminou.
   */
  const vozDominante = [...byEngine].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "nenhum motor";

  // -------------------------------------------------------- 3. Lado do banco
  // É o texto que o aluno realmente vê, e portanto o hash que o player pede.
  console.log("\n\x1b[1m3. O que o aluno pede (banco)\x1b[0m");

  const supabase = supabaseAdmin();
  const { data: lessons, error } = await supabase
    .from("lessons")
    .select(
      "day_number, chunks, immersion_script, listening_script, is_published",
    )
    .order("day_number");

  if (error) {
    bad(`Não consegui ler as lições: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  if (!lessons?.length) {
    bad("Nenhuma lição no banco. Rode: npm run seed:curriculum");
    process.exitCode = 1;
    return;
  }

  const missing: Missing[] = [];
  const wanted = new Set<string>();

  for (const lesson of lessons) {
    const add = (text: string | null, kind: Missing["kind"]) => {
      const clean = text?.trim();
      if (!clean) return;
      const id = audioId(clean);
      wanted.add(id);
      if (!existsSync(join(OUT_DIR, `${id}.mp3`))) {
        missing.push({ text: clean, id, day: lesson.day_number, kind });
      }
    };

    for (const chunk of lesson.chunks ?? []) add(chunk.en, "bloco");
    add(lesson.immersion_script, "diálogo de imersão");
    add(lesson.listening_script, "diálogo de escuta");
  }

  const total = wanted.size;
  const covered = total - new Set(missing.map((m) => m.id)).size;
  const pct = total ? Math.round((covered / total) * 100) : 0;

  console.log(
    `  ${lessons.length} lições · ${total} textos distintos com áudio`,
  );
  if (missing.length === 0) {
    ok(`${covered}/${total} (100%) tocam com a voz gerada (${vozDominante})`);
  } else {
    bad(
      `${total - covered} de ${total} caem na voz do navegador (${pct}% cobertos)`,
    );
  }

  // ------------------------------------------------- 3. O diagnóstico do erro
  if (missing.length > 0) {
    // Órfão que NÃO está no catálogo = o texto do banco divergiu de content/.
    // Órfão que está no catálogo = o arquivo simplesmente não foi gerado.
    const drifted = missing.filter((m) => !catalogIds.has(m.id));
    const ungenerated = missing.filter((m) => catalogIds.has(m.id));

    console.log("\n\x1b[1m4. Por quê\x1b[0m");

    if (drifted.length) {
      bad(`${drifted.length} textos do banco não existem em content/`);
      info("O banco está desatualizado: foi semeado antes da última edição do");
      info("conteúdo. O texto mudou, o hash mudou, e o arquivo gravado é o do");
      info("texto ANTIGO. Conserto: npm run seed:curriculum");
    }
    if (ungenerated.length) {
      bad(`${ungenerated.length} textos estão no catálogo mas sem arquivo`);
      info("Conserto: npm run gen:audio");
    }

    const byDay = new Map<number, number>();
    for (const m of missing) byDay.set(m.day, (byDay.get(m.day) ?? 0) + 1);
    const days = [...byDay.keys()].sort((a, b) => a - b);
    console.log("");
    info(
      `Dias afetados: ${days.length} (primeiros: ${days.slice(0, 12).join(", ")}${days.length > 12 ? "…" : ""})`,
    );

    if (list) {
      console.log("");
      for (const m of missing.slice(0, 60)) {
        console.log(`  dia ${String(m.day).padStart(3)} · ${m.kind} · ${m.id}`);
        console.log(`    \x1b[2m${m.text.slice(0, 96)}\x1b[0m`);
      }
      if (missing.length > 60) info(`… e mais ${missing.length - 60}`);
    } else {
      info("Use --list para ver os textos.");
    }

    process.exitCode = 1;
  }

  console.log("");
}

main().catch((error) => {
  console.error("\n\x1b[31mErro inesperado:\x1b[0m", error);
  process.exitCode = 1;
});
