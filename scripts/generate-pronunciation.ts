/**
 * Gera a pronúncia figurada de todo inglês que o aluno LÊ no curso.
 *
 *   npm run gen:pronuncia
 *   npm run gen:pronuncia -- --check    (não escreve; falha se estiver desatualizado)
 *
 * ===========================================================================
 * O QUE ENTRA
 * ===========================================================================
 * Exatamente onde há inglês COM tradução ao lado, que é onde a figuração
 * ajuda: falas de diálogo, listas de exemplos e os blocos do circuito.
 *
 * Drills e prompts de prática ficam de fora de propósito: ali o texto é
 * misturado (o item do dia 10 é "Circuito 3 (Não entendi): «Sorry, could you
 * say that again?»", metade em português) e figurar português produziria
 * lixo que ninguém revisaria.
 *
 * A varredura NÃO lista as fontes à mão: ela compõe as 728 lições e percorre
 * os blocos. Assim, bloco novo que apareça em `compose-lesson.ts` entra
 * sozinho na próxima rodada, sem ninguém lembrar de atualizar este arquivo.
 *
 * ===========================================================================
 * POR QUE UM ARQUIVO SEPARADO, E NÃO UM CAMPO NO CONTEÚDO
 * ===========================================================================
 * A figuração é DERIVADA: sai do texto em inglês por regra, não é redigida.
 * Guardá-la junto do conteúdo obrigaria a editar as duas coisas em sincronia e
 * deixaria as duas divergirem no primeiro esquecimento. Aqui ela vive em
 * `content/pronunciation.json`, indexada pelo próprio texto: corrigiu a fala,
 * a chave muda, e a rodada seguinte gera a figuração nova.
 */

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assertContentComplete, connectionsBefore, CONTENT_BY_CIRCUIT } from "@content/circuits";
import { authenticPieceFor } from "@content/circuits/authentic";
import { composeLesson } from "@content/compose-lesson";
import {
  authenticInputFor,
  buildLessonPlan,
  CANTOS,
  CIRCUITS,
  DAY_RHYTHM,
  livePromptFor,
  reviewChunksFor,
} from "@content/curriculum";
import type { Chunk, LessonBlock } from "@/lib/types/database";

const OUT_PATH = join(process.cwd(), "content", "pronunciation.json");
const CHECK = process.argv.includes("--check");

/** Todo inglês que aparece na tela ao lado de uma tradução. */
function englishIn(block: LessonBlock): string[] {
  if (block.type === "dialogue") return block.lines.map((l) => l.en);
  if (block.type === "examples") return block.items.map((i) => i.en);
  return [];
}

function collect(): string[] {
  assertContentComplete(CIRCUITS.length);

  const seen = new Set<string>();
  const add = (text: string) => {
    const clean = text.replace(/\s+/g, " ").trim();
    // "___" é a lacuna do molde; falar a lacuna não faz sentido.
    if (clean && clean !== "___") seen.add(clean);
  };

  for (const spec of buildLessonPlan()) {
    const circuit = CIRCUITS.find((c) => c.number === spec.circuitNumber)!;
    const material = CONTENT_BY_CIRCUIT.get(spec.circuitNumber)!;
    const day = DAY_RHYTHM.find((d) => d.day === spec.circuitDay)!;
    const canto = CANTOS.find((c) => circuit.number >= c.weekStart && circuit.number <= c.weekEnd)!;

    const reviewChunks = reviewChunksFor(circuit.number) as {
      circuit: number;
      title: string;
      chunks: Chunk[];
    }[];

    const lesson = composeLesson({
      circuit,
      material,
      day,
      reviewOf: spec.reviewOf,
      authenticInput: authenticInputFor(circuit, canto.level),
      authentic: authenticPieceFor(circuit.number),
      livePrompt: livePromptFor(circuit),
      reviewChunks,
      carriedConnections: connectionsBefore(spec.circuitNumber),
    });

    for (const block of [...(lesson.content.blocks ?? []), ...(lesson.content.gated ?? [])]) {
      for (const en of englishIn(block)) add(en);
    }
    for (const chunk of lesson.chunks) add(chunk.en);
  }

  return [...seen].sort();
}

function respellAll(texts: string[]): Promise<Record<string, string>> {
  const inputPath = join(tmpdir(), `easyenglish-respell-${process.pid}.json`);
  writeFileSync(inputPath, JSON.stringify(texts), "utf8");

  return new Promise((resolve, reject) => {
    const python = spawn("python", [join("scripts", "respell_worker.py"), inputPath], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });

    let out = "";
    let err = "";
    python.stdout.on("data", (d) => (out += d.toString()));
    python.stderr.on("data", (d) => {
      const line = d.toString();
      err += line;
      // O worker usa stderr para progresso e avisos.
      process.stderr.write(line);
    });

    python.on("error", reject);
    python.on("close", (code) => {
      if (code !== 0) return reject(new Error(`respell_worker.py saiu com ${code}\n${err}`));
      try {
        resolve(JSON.parse(out) as Record<string, string>);
      } catch (error) {
        reject(new Error(`saída do worker não é JSON: ${(error as Error).message}`));
      }
    });
  });
}

async function main() {
  const texts = collect();
  console.log(`\n\x1b[1mPronúncia figurada\x1b[0m`);
  console.log(`  frases em inglês no curso: ${texts.length}\n`);

  const map = await respellAll(texts);

  const empty = texts.filter((t) => !map[t]);
  if (empty.length) {
    console.error(`\n✗ ${empty.length} frase(s) sem figuração. Ex.: ${empty.slice(0, 3).join(" | ")}\n`);
    process.exit(1);
  }

  const json = JSON.stringify(map, null, 2) + "\n";

  if (CHECK) {
    const current = (() => {
      try {
        return readFileSync(OUT_PATH, "utf8");
      } catch {
        return "";
      }
    })();
    if (current !== json) {
      console.error(
        `\n✗ content/pronunciation.json está desatualizado.\n  Rode: npm run gen:pronuncia\n`,
      );
      process.exit(1);
    }
    console.log(`  ✓ em dia com o conteúdo.\n`);
    return;
  }

  writeFileSync(OUT_PATH, json, "utf8");
  console.log(`\n  ${Object.keys(map).length} figurações em content/pronunciation.json`);
  console.log(`  Amostra:`);
  for (const text of texts.slice(0, 5)) console.log(`    ${text}\n      ${map[text]}`);
  console.log("");
}

main().catch((error) => {
  console.error("\n✗ Erro:", error instanceof Error ? error.message : error);
  process.exit(1);
});
