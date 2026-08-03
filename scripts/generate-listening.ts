/**
 * Redige as peças de escuta estendida do dia 8 — o material que substitui
 * "vá procurar no YouTube".
 *
 *   npm run gen:listening                # redige o que falta e para na cota
 *   npm run gen:listening -- --watch     # ao bater a cota, dorme e retoma
 *   npm run gen:listening -- --limit 5
 *   npm run gen:listening -- --circuit 7 --force
 *   npm run gen:listening -- --dry-run
 *
 * ===========================================================================
 * GERA UMA VEZ, REVISA, VERSIONA
 * ===========================================================================
 * Este script NÃO roda em produção e não é chamado pelo app. Ele escreve em
 * `content/circuits/authentic.json`, que vai commitado. É o mesmo princípio
 * que `content/compose-lesson.ts` defende para o resto do curso: o aluno lê
 * exatamente o que você revisou, e duas execuções não produzem cursos
 * diferentes.
 *
 * Por isso: LEIA o que sair antes de commitar. O modelo é bom, mas quem
 * responde pelo curso é você.
 *
 * ===========================================================================
 * RETOMADA
 * ===========================================================================
 * Igual ao gerador de áudio: o próprio JSON é o estado. Circuito que já tem
 * peça é pulado. Interrompeu? Rode de novo e ele continua. Quer refazer um
 * circuito específico? `--circuit N --force`.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CANTOS, CIRCUITS } from "../content/curriculum";

import { env, genai, sleep } from "./_shared";

/** O nível não vive no circuito, e sim no canto que o cobre. */
function levelOf(circuitNumber: number): string {
  return (
    CANTOS.find((c) => circuitNumber >= c.weekStart && circuitNumber <= c.weekEnd)?.level ?? "A2"
  );
}

const JSON_PATH = join(process.cwd(), "content", "circuits", "authentic.json");

interface Piece {
  n: number;
  kind: "conversa" | "relato" | "entrevista";
  title: string;
  why: string;
  minutes: number;
  lines: [string, string, string][];
  // Objeto, não tupla: este JSON é lido por gente na revisão, e campo com nome
  // sobrevive a isso melhor que posição. Casa com AuthenticQuestion.
  questions: { question: string; options: string[]; answerIndex: number; explanation: string }[];
}

/**
 * Esquema exigido do modelo. Sem isto o retorno varia de forma a cada chamada
 * e o JSON do curso vira um campo minado de casos especiais.
 */
const RESPONSE_SCHEMA = {
  type: "object",
  required: ["kind", "title", "why", "minutes", "lines", "questions"],
  properties: {
    kind: { type: "string", enum: ["conversa", "relato", "entrevista"] },
    title: { type: "string" },
    why: { type: "string" },
    minutes: { type: "integer" },
    lines: {
      type: "array",
      minItems: 24,
      maxItems: 40,
      items: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string" },
      },
    },
    questions: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        required: ["question", "options", "answerIndex", "explanation"],
        properties: {
          question: { type: "string" },
          options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
          answerIndex: { type: "integer" },
          explanation: { type: "string" },
        },
      },
    },
  },
} as const;

function promptFor(circuit: (typeof CIRCUITS)[number]): string {
  return `
You are writing extended listening material for a Brazilian learner of American English.

CIRCUIT ${circuit.number} — "${circuit.title}" (CEFR ${levelOf(circuit.number)})
Situation the student already trained: ${circuit.situation}
Chunks they already own:
${circuit.chunks.map((c) => `  - "${c.en}"`).join("\n")}

WRITE ONE LONGER LISTENING PIECE (24 to 40 lines).

This piece must be HARDER than what they trained, on purpose. It is the day
that bridges classroom English and real English. So:

  - Real conversational American English. Contractions always. Reductions in
    the spelling where natural ("gonna", "wanna", "kinda", "lemme").
  - EXACTLY TWO speakers, with names. Not one, not three — the text-to-speech
    that voices this piece renders exactly two voices, so a third speaker
    would come out in the wrong voice.
    Within that limit, make it messy like real talk: they interrupt each
    other, change subject, backtrack, use filler ("uh", "I mean", "you know",
    "like"), and mention other people by name without those people speaking.
  - It must go BEYOND the circuit's vocabulary. Introduce natural words the
    student has not seen — that is the point of this day. Do not restrict
    yourself to the chunk list; just stay plausible for ${levelOf(circuit.number)}.
  - Topic must ORBIT the circuit situation without repeating its dialogue.
    Same world, different scene, more going on.
  - No line may contain the "/" character — it is the script separator.
  - Portuguese translation is what a Brazilian would ACTUALLY say, not literal.

Each line is [speaker, english, portuguese].

Also write 3 comprehension questions IN PORTUGUESE about the piece, each with
4 options and one correct answer. They must require having UNDERSTOOD the
audio — not be answerable by guessing from the options. Explanation in
Portuguese, short.

IN PORTUGUESE (the student is Brazilian and the whole interface is Portuguese):
  - "title": a short, concrete title naming the scene. NOT in English — this
    is printed on the lesson screen next to Portuguese text. Describe what
    happens, do not summarize the theme. Good: "O pedido que deu errado na
    cafeteria". Bad: "Ordering Coffee" or "Praticando pedidos".
  - "why": one sentence saying what this piece trains that the circuit
    dialogues did not.

"minutes" is the realistic listening time. Only the "english" field of each
line is in English — everything else the student reads is Portuguese.
`.trim();
}

interface Options {
  limit: number;
  circuit: number | null;
  force: boolean;
  dryRun: boolean;
  watch: boolean;
  waitMinutes: number;
  delayMs: number;
  model: string;
}

function parseArgs(argv: string[]): Options {
  const get = (n: string) => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const has = (n: string) => argv.includes(`--${n}`);

  return {
    limit: Number(get("limit") ?? Number.POSITIVE_INFINITY),
    circuit: get("circuit") ? Number(get("circuit")) : null,
    force: has("force"),
    dryRun: has("dry-run"),
    watch: has("watch"),
    waitMinutes: Number(get("wait") ?? 60),
    delayMs: Number(get("delay") ?? 4000),
    model: get("model") ?? env("GEMINI_MODEL_TUTOR", "gemini-3.6-flash"),
  };
}

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b429\b|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(message);
}

function load(): Piece[] {
  try {
    return JSON.parse(readFileSync(JSON_PATH, "utf8")) as Piece[];
  } catch {
    return [];
  }
}

function save(pieces: Piece[]) {
  pieces.sort((a, b) => a.n - b.n);
  writeFileSync(JSON_PATH, JSON.stringify(pieces, null, 2) + "\n", "utf8");
}

/** Barra é o separador do roteiro: se escapar uma, o player parte a fala ao meio. */
function sanitize(piece: Piece): Piece {
  return {
    ...piece,
    lines: piece.lines.map(
      ([who, en, pt]) =>
        [who.replace(/\//g, " "), en.replace(/\s*\/\s*/g, " or "), pt.replace(/\s*\/\s*/g, " ou ")] as [
          string,
          string,
          string,
        ],
    ),
  };
}

async function generate(circuit: (typeof CIRCUITS)[number], model: string): Promise<Piece> {
  const response = await genai().models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: promptFor(circuit) }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA as never,
      temperature: 0.9,
    },
  });

  const text = response.text;
  if (!text) throw new Error("resposta vazia");

  const parsed = JSON.parse(text) as Omit<Piece, "n">;
  const piece = sanitize({ ...parsed, n: circuit.number });

  if (piece.lines.length < 20) throw new Error(`só ${piece.lines.length} falas`);
  if (piece.questions.length !== 3) throw new Error(`${piece.questions.length} perguntas`);

  // O TTS multi-locutor do Gemini exige DOIS locutores, nem mais nem menos —
  // três devolve 400 e a peça ficaria sem áudio. Barramos aqui para o problema
  // aparecer na redação, e não lá na frente no lote de áudio.
  const speakers = [...new Set(piece.lines.map(([who]) => who))];
  if (speakers.length !== 2) {
    throw new Error(`${speakers.length} locutores (${speakers.join(", ")}) — o TTS exige 2`);
  }

  // O título vai para a tela do aluno, ao lado de texto em português. O modelo
  // escorrega para o inglês nele com facilidade ("Looking at Family Photos"),
  // e Title Case denuncia: português capitaliza a primeira palavra e nomes
  // próprios, inglês capitaliza quase tudo.
  const words = piece.title.split(/\s+/).filter((w) => w.length > 3);
  const capitalized = words.filter((w) => /^[A-ZÀ-Þ]/.test(w)).length;
  if (words.length >= 3 && capitalized > words.length / 2) {
    throw new Error(`título parece inglês: "${piece.title}"`);
  }

  return piece;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pieces = load();
  const have = new Set(pieces.map((p) => p.n));

  let targets = CIRCUITS.filter((c) => options.force || !have.has(c.number));
  if (options.circuit) targets = CIRCUITS.filter((c) => c.number === options.circuit);
  targets = targets.slice(0, Number.isFinite(options.limit) ? options.limit : undefined);

  console.log(`\n\x1b[1mEscuta estendida do dia 8\x1b[0m`);
  console.log(`  modelo   ${options.model}`);
  console.log(`  prontas  ${have.size}/${CIRCUITS.length}`);
  console.log(`  nesta rodada ${targets.length}\n`);

  if (!targets.length) {
    console.log("  Nada a fazer — a biblioteca está completa.\n");
    return;
  }

  if (options.dryRun) {
    for (const c of targets) console.log(`  · circuito ${c.number} — ${c.title}`);
    console.log(`\n  (--dry-run: nada foi gerado)\n`);
    return;
  }

  const COOLDOWN_START_MS = 30_000;
  const COOLDOWN_MAX_MS = 300_000;
  const GIVE_UP_AFTER = 5;

  let cooldown = COOLDOWN_START_MS;
  let refusals = 0;
  let written = 0;
  const queue = [...targets];

  while (queue.length) {
    const circuit = queue[0];

    try {
      const piece = await generate(circuit, options.model);

      const index = pieces.findIndex((p) => p.n === circuit.number);
      if (index === -1) pieces.push(piece);
      else pieces[index] = piece;

      // Grava a CADA peça: uma queda no meio não perde o que já foi redigido.
      save(pieces);

      queue.shift();
      written++;
      cooldown = COOLDOWN_START_MS;
      refusals = 0;

      console.log(
        `  \x1b[32m✓\x1b[0m ${String(written).padStart(2)}/${targets.length}  c${String(circuit.number).padStart(2)}  ${piece.lines.length} falas  — ${piece.title}`,
      );
    } catch (error) {
      if (isQuotaError(error)) {
        refusals++;

        if (refusals < GIVE_UP_AFTER) {
          console.log(
            `  \x1b[33m·\x1b[0m cota por minuto — esperando ${Math.round(cooldown / 1000)}s (${refusals}/${GIVE_UP_AFTER})`,
          );
          await sleep(cooldown);
          cooldown = Math.min(cooldown * 2, COOLDOWN_MAX_MS);
          continue;
        }

        // Não afirmamos "cota diária": o erro não distingue teto do dia de
        // uma janela mais longa que a escada de espera.
        console.log(
          `\n  \x1b[33m▲ A cota seguiu bloqueada depois de ${GIVE_UP_AFTER} esperas.\x1b[0m ` +
            `${written} peças nesta rodada.`,
        );

        if (!options.watch) {
          console.log(
            `\n  Faltam ${CIRCUITS.length - have.size - written}. Rode de novo quando renovar —\n` +
              `  o que já está em authentic.json não é refeito.\n` +
              `  Para esperar e retomar sozinho: npm run gen:listening -- --watch\n`,
          );
          return;
        }

        console.log(`  Esperando ${options.waitMinutes} min (--watch)...\n`);
        await sleep(options.waitMinutes * 60_000);
        refusals = 0;
        cooldown = COOLDOWN_START_MS;
        continue;
      }

      queue.shift();
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  \x1b[31m✗\x1b[0m c${circuit.number} — ${message.slice(0, 140)}`);
    }

    if (queue.length) await sleep(options.delayMs);
  }

  // Conta o array, não `have.size + written`: com --force uma peça é
  // substituída, não somada, e a conta somada mentiria.
  console.log(`\n  ${pieces.length}/${CIRCUITS.length} circuitos com escuta estendida.`);
  console.log(`  \x1b[1mLeia o que saiu\x1b[0m antes de commitar authentic.json.`);
  console.log(`  Depois: npm run gen:audio  (para gerar o áudio das peças novas)\n`);
}

main().catch((error) => {
  console.error("\n✗ Erro:", error instanceof Error ? error.message : error);
  process.exit(1);
});
