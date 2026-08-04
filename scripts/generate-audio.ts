/**
 * Gera o áudio das lições e guarda em `public/audio/`, para sempre.
 *
 *   npm run gen:audio              # gera o que ainda falta e para na cota
 *   npm run gen:audio -- --watch   # ao bater a cota, dorme e retoma sozinho
 *   npm run gen:audio -- --limit 20
 *   npm run gen:audio -- --only dialogues
 *   npm run gen:audio -- --dry-run
 *
 * ===========================================================================
 * POR QUE PRÉ-GERAR
 * ===========================================================================
 * O áudio do curso era sintetizado pela voz do sistema operacional. Isso custa
 * zero e funciona offline, mas voz de sistema não produz FALA CONECTADA: não
 * reduz, não elide, não gruda palavra. O nativo diz "whaddaya gonna do";
 * a voz do sistema diz "what are you going to do", separadinho. O aluno
 * treinava 728 dias numa fala sem a propriedade que ia quebrá-lo na vida real.
 *
 * Gerar com TTS neural resolve isso. Gerar UMA VEZ e versionar o resultado
 * preserva tudo que a voz do navegador tinha de bom:
 *
 *   - Custo de execução zero. O aluno baixa um arquivo estático.
 *   - Sem cota no caminho do aluno. A cota é gasta aqui, por você, uma vez.
 *   - Determinístico e revisável, igual ao resto de `content/`: você ouve
 *     antes de o aluno ouvir.
 *
 * ===========================================================================
 * COMO A RETOMADA FUNCIONA
 * ===========================================================================
 * Não existe arquivo de estado, e isso é de propósito. O `.mp3` já gravado É a
 * marca de progresso: o script lista os 468 áudios, pula os que já existem em
 * disco e trabalha no resto. Consequências práticas:
 *
 *   - Pode interromper com Ctrl+C a qualquer momento. Nada corrompe.
 *   - Rode de novo amanhã e ele continua exatamente de onde parou.
 *   - Apagou um arquivo? Ele volta a ser gerado. Só ele.
 *   - Corrigiu uma fala em `content/circuits/`? O texto mudou, o hash mudou,
 *     e o áudio novo é gerado no próximo lote. Ver `src/lib/audio-id.ts`.
 *
 * Enquanto a geração não termina, o app continua funcionando: o player usa o
 * arquivo quando ele existe e cai na voz do navegador quando não existe.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  audioJobs,
  spokenLines,
  voiceFor,
  voicePairFor,
  type AudioJob,
  type Engine,
} from "../content/audio-manifest";

import { env, genai, sleep } from "./_shared";

const OUT_DIR = join(process.cwd(), "public", "audio");

/** Voz única para os blocos soltos: o "professor" do curso é sempre o mesmo. */
const CHUNK_VOICE = "Kore";

/**
 * Modelos de TTS que a conta gratuita costuma alcançar, em ordem de preferência.
 * Rode `npm run models` se algum dia um deles devolver 404.
 */
const DEFAULT_MODEL = "gemini-3.1-flash-tts-preview";

interface Options {
  limit: number;
  /** Só este circuito: útil para regerar depois de corrigir uma fala. */
  circuit: number | null;
  only: "all" | "dialogues" | "chunks";
  engine: Engine;
  /** Regerar só o que foi feito pelo OUTRO motor. Ver o livro-razão abaixo. */
  upgrade: boolean;
  delayMs: number;
  model: string;
  force: boolean;
  dryRun: boolean;
  watch: boolean;
  waitMinutes: number;
}

/**
 * Livro-razão de qual motor fez cada arquivo.
 *
 * É o que torna a estratégia híbrida possível: o Piper preenche os 455 áudios
 * hoje, de graça, e depois `--engine gemini --upgrade` regera SÓ os que o Piper
 * fez, no ritmo que a cota diária permitir. Sem este registro não haveria como
 * distinguir um do outro: o nome do arquivo vem do texto, não do motor.
 */
const LEDGER_PATH = join(OUT_DIR, "engines.json");

function readLedger(): Record<string, Engine> {
  try {
    return JSON.parse(readFileSync(LEDGER_PATH, "utf8")) as Record<string, Engine>;
  } catch {
    return {};
  }
}

function writeLedger(ledger: Record<string, Engine>) {
  const sorted = Object.fromEntries(Object.entries(ledger).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(LEDGER_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf8");
}

function parseArgs(argv: string[]): Options {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const has = (name: string) => argv.includes(`--${name}`);

  const only = get("only") ?? "all";
  if (!["all", "dialogues", "chunks"].includes(only)) {
    console.error(`\n✗ --only aceita: all, dialogues, chunks (recebi "${only}")\n`);
    process.exit(1);
  }

  const engine = get("engine") ?? "gemini";
  if (engine !== "gemini" && engine !== "piper") {
    console.error(`\n✗ --engine aceita: gemini, piper (recebi "${engine}")\n`);
    process.exit(1);
  }

  return {
    limit: Number(get("limit") ?? Number.POSITIVE_INFINITY),
    circuit: get("circuit") ? Number(get("circuit")) : null,
    only: only as Options["only"],
    engine,
    upgrade: has("upgrade"),
    // 6s entre chamadas ≈ 10 por minuto. A conta gratuita tem teto por minuto
    // e por dia; ir devagar troca tempo de parede por lote que não morre no meio.
    delayMs: Number(get("delay") ?? 6000),
    model: get("model") ?? env("GEMINI_MODEL_TTS", DEFAULT_MODEL),
    force: has("force"),
    dryRun: has("dry-run"),
    watch: has("watch"),
    waitMinutes: Number(get("wait") ?? 60),
  };
}

// ===========================================================================
// Conversão do áudio
//
// A API devolve PCM cru de 24 kHz, 16 bits, mono: 48 KB por segundo. Os ~53
// minutos do curso inteiro dariam uns 150 MB em WAV, que é repositório demais.
// Em MP3 mono de 64 kbps a mesma coisa cabe em ~25 MB, sem perda audível para
// voz falada.
// ===========================================================================

function haveFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    probe.on("error", () => resolve(false));
    probe.on("close", (code) => resolve(code === 0));
  });
}

function pcmToMp3(pcm: Buffer, sampleRate: number, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-f", "s16le",
      "-ar", String(sampleRate),
      "-ac", "1",
      "-i", "pipe:0",
      "-codec:a", "libmp3lame",
      "-b:a", "64k",
      "-y", outPath,
    ]);

    let stderr = "";
    ff.stderr.on("data", (d) => (stderr += d.toString()));
    ff.on("error", reject);
    ff.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg saiu com ${code}: ${stderr.trim()}`)),
    );

    ff.stdin.on("error", () => {
      /* ffmpeg pode fechar a entrada antes de nós; o 'close' acima decide. */
    });
    ff.stdin.end(pcm);
  });
}

// ===========================================================================
// Chamada ao Gemini
// ===========================================================================

/** Instrução de estilo: é o que separa "leitura" de "conversa". */
const DIALOGUE_STYLE =
  "Read the following conversation the way two Americans would actually say it: " +
  "natural conversational pace, contractions, linked words, real intonation. " +
  "Do not enunciate word by word.";

const CHUNK_STYLE =
  "Say the following phrase the way an American says it in normal conversation: " +
  "natural speed, natural linking. Say it once.";

/** Uma chamada ao TTS. Devolve PCM cru e a taxa de amostragem. */
async function speak(
  text: string,
  speechConfig: object,
  model: string,
): Promise<{ pcm: Buffer; rate: number }> {
  const response = await genai().models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text }] }],
    config: { responseModalities: ["AUDIO"], speechConfig },
  });

  const inline = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inline?.data) throw new Error("a resposta não trouxe áudio");

  return {
    pcm: Buffer.from(inline.data, "base64"),
    rate: Number(/rate=(\d+)/.exec(inline.mimeType ?? "")?.[1] ?? 24000),
  };
}

const oneVoice = (name: string) => ({ voiceConfig: { prebuiltVoiceConfig: { voiceName: name } } });

/** 400 ms de silêncio entre falas emendadas: sem isso a conversa atropela. */
function silence(rate: number, ms = 400): Buffer {
  return Buffer.alloc(Math.round((rate * 2 * ms) / 1000));
}

/**
 * Gera o áudio de um item do catálogo.
 *
 * O caminho depende de quantas pessoas falam, porque o modo multi-locutor da
 * API aceita EXATAMENTE dois: nem um, nem três:
 *
 *   2 locutores  → uma chamada só, com as duas vozes. É o caso de 96 dos 104
 *                  diálogos, e é o que torna a pré-geração barata.
 *   1 locutor    → voz única. Os circuitos 49 são monólogos.
 *   3 locutores  → uma chamada por fala, cada uma na voz do seu personagem, e
 *                  o PCM emendado no fim. Custa mais cota, mas são só 6
 *                  diálogos no curso inteiro: e a alternativa seria jogar
 *                  fora a distinção de vozes justamente nas cenas com mais
 *                  gente, que são as mais difíceis de acompanhar.
 */
async function synthesize(
  job: AudioJob,
  model: string,
  delayMs: number,
): Promise<{ pcm: Buffer; rate: number }> {
  if (job.kind !== "dialogue") {
    return speak(`${CHUNK_STYLE}\n\n${job.text}`, oneVoice(CHUNK_VOICE), model);
  }

  // O roteiro é guardado como "A: fala / B: fala"; o TTS quer uma fala por linha.
  const lines = job.text.split(/\s*\/\s*/);

  if (job.speakers.length === 2) {
    const [voiceA, voiceB] = voicePairFor(job.speakers[0], job.speakers[1]);
    return speak(`${DIALOGUE_STYLE}\n\n${lines.join("\n")}`, {
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs: [
          { speaker: job.speakers[0], voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceA } } },
          { speaker: job.speakers[1], voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceB } } },
        ],
      },
    }, model);
  }

  if (job.speakers.length === 1) {
    return speak(`${DIALOGUE_STYLE}\n\n${lines.join("\n")}`, oneVoice(voiceFor(job.speakers[0])), model);
  }

  // Três ou mais: fala a fala, emendando o PCM.
  const parts: Buffer[] = [];
  let rate = 24000;

  for (let i = 0; i < lines.length; i++) {
    const match = /^([^:]{1,24}):\s*(.+)$/.exec(lines[i]);
    const who = match?.[1]?.trim() ?? job.speakers[0];
    const said = match?.[2]?.trim() ?? lines[i];

    const piece = await speak(`${CHUNK_STYLE}\n\n${said}`, oneVoice(voiceFor(who)), model);
    rate = piece.rate;
    if (parts.length) parts.push(silence(rate));
    parts.push(piece.pcm);

    if (i < lines.length - 1) await sleep(delayMs);
  }

  return { pcm: Buffer.concat(parts), rate };
}

/** Distingue "acabou a cota" de "deu erro nesse item". */
function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b429\b|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(message);
}

// ===========================================================================
// Motor local (Piper)
//
// Um único processo Python dá conta do lote inteiro: carregar um modelo custa
// ~4s e sintetizar uma fala custa ~0,23s, então abrir o processo por fala
// gastaria quase todo o tempo carregando modelo. Ver scripts/piper_worker.py.
// ===========================================================================

const VOICES_DIR = join(process.cwd(), ".piper-voices");

/**
 * Os ids que existem em disco AGORA.
 *
 * Relido no fim de cada lote em vez de somar `já existiam + gerados`. Com
 * `--force` as duas parcelas se sobrepõem: os 461 arquivos que já estavam lá
 * eram os mesmos 462 que acabaram de ser reescritos: e a soma anunciava
 * "923/462 áudios, faltam -461". O disco é a única fonte que não erra isso.
 */
function countOnDisk(): Set<string> {
  return new Set(
    readdirSync(OUT_DIR)
      .filter((f) => f.endsWith(".mp3"))
      .map((f) => f.replace(/\.mp3$/, "")),
  );
}

async function runPiper(
  pending: AudioJob[],
  ledger: Record<string, Engine>,
  wanted: AudioJob[],
): Promise<void> {
  if (!existsSync(VOICES_DIR)) {
    console.error(
      `\n✗ Vozes do Piper não encontradas em ${VOICES_DIR}\n` +
        `  Instale uma vez com:  npm run gen:audio:setup\n`,
    );
    process.exit(1);
  }

  // O TypeScript decide quem fala com qual voz; o Python só sintetiza.
  const payload = pending.map((job) => ({
    id: job.id,
    lines: spokenLines(job, "piper"),
  }));

  const jobsPath = join(tmpdir(), `inglisheasy-piper-${process.pid}.json`);
  writeFileSync(jobsPath, JSON.stringify(payload), "utf8");

  const labels = new Map(pending.map((j) => [j.id, j.label]));
  let generated = 0;
  let failed = 0;

  await new Promise<void>((resolve, reject) => {
    const python = spawn("python", [join("scripts", "piper_worker.py"), jobsPath, OUT_DIR, VOICES_DIR]);

    let buffer = "";
    python.stdout.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const [tag, id, rest] = line.trim().split(/\s+/, 3);

        if (tag === "READY") {
          console.log(`  ${id} vozes carregadas, sintetizando…\n`);
        } else if (tag === "OK") {
          generated++;
          ledger[id] = "piper";
          // Grava a cada arquivo: uma queda no meio não perde o registro do
          // que já foi feito, e o --upgrade continua sabendo a origem de cada um.
          writeLedger(ledger);
          console.log(
            `  \x1b[32m✓\x1b[0m ${String(generated).padStart(3)}/${pending.length}  ${String(rest ?? "?").padStart(5)}s  ${labels.get(id) ?? id}`,
          );
        } else if (tag === "FAIL") {
          failed++;
          console.log(`  \x1b[31m✗\x1b[0m ${labels.get(id) ?? id}\n      ${rest ?? ""}`);
        }
      }
    });

    python.stderr.on("data", (data) => {
      const text = data.toString().trim();
      if (text.startsWith("FATAL")) console.error(`  \x1b[31m${text}\x1b[0m`);
    });

    python.on("error", reject);
    python.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`piper_worker.py saiu com ${code}`)),
    );
  });

  rmSync(jobsPath, { force: true });

  const ready = countOnDisk();
  const now = wanted.filter((j) => ready.has(j.id)).length;
  const total = wanted.length;
  console.log(`\n  ${now}/${total} áudios em public/audio/`);
  if (failed) console.log(`  \x1b[31m${failed}\x1b[0m falharam: rode de novo para tentar só eles.`);
  console.log(
    now === total
      ? `\n  \x1b[32mCompleto.\x1b[0m Commit public/audio/.\n` +
          `  Para trocar por áudio do Gemini aos poucos, conforme a cota:\n` +
          `    npm run gen:audio -- --engine gemini --upgrade --only dialogues\n`
      : `  Faltam ${total - now}.\n`,
  );
}

// ===========================================================================
// Execução
// ===========================================================================

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!(await haveFfmpeg())) {
    console.error(
      "\n✗ ffmpeg não encontrado no PATH.\n" +
        "  Ele converte o PCM cru da API em MP3: sem isso o repositório levaria ~150 MB.\n" +
        "  Windows: winget install Gyan.FFmpeg\n",
    );
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const all = audioJobs();
  const scoped = options.circuit ? all.filter((j) => j.circuit === options.circuit) : all;
  const wanted = scoped.filter((j) =>
    options.only === "all"
      ? true
      : options.only === "dialogues"
        ? j.kind === "dialogue"
        : j.kind === "chunk",
  );

  const onDisk = countOnDisk();

  const ledger = readLedger();

  /**
   * O que falta fazer.
   *
   *   normal: o que ainda não existe em disco (retomada por existência)
   *   --upgrade: o que existe mas foi feito pelo outro motor
   *   --force: tudo, de novo
   */
  const missing = (job: AudioJob) => {
    if (options.force) return true;
    if (!onDisk.has(job.id)) return true;
    return options.upgrade && ledger[job.id] !== options.engine;
  };

  const pending = wanted
    .filter(missing)
    .slice(0, Number.isFinite(options.limit) ? options.limit : undefined);

  const done = wanted.filter((j) => onDisk.has(j.id)).length;
  const byThisEngine = wanted.filter((j) => ledger[j.id] === options.engine).length;

  console.log(`\n\x1b[1mÁudio das lições\x1b[0m`);
  console.log(`  motor    ${options.engine}${options.engine === "gemini" ? ` (${options.model})` : " (local, sem cota)"}`);
  console.log(`  catálogo ${all.length} áudios (${all.filter((j) => j.kind === "dialogue").length} diálogos + ${all.filter((j) => j.kind === "chunk").length} blocos)`);
  console.log(`  em disco ${done}/${wanted.length}  ·  ${byThisEngine} deste motor`);
  console.log(`  nesta rodada ${pending.length}${options.upgrade ? " (--upgrade)" : ""}\n`);

  if (!pending.length) {
    console.log("  Nada a fazer: o áudio está completo.\n");
    return;
  }

  if (options.dryRun) {
    for (const job of pending) console.log(`  · ${job.id}  ${job.label}`);
    console.log(`\n  (--dry-run: nada foi gerado)\n`);
    return;
  }

  // ------------------------------------------------------------ motor local
  if (options.engine === "piper") {
    await runPiper(pending, ledger, wanted);
    return;
  }

  let generated = 0;
  let failed = 0;
  const queue = [...pending];

  /**
   * Recuo adaptativo para o limite POR MINUTO.
   *
   * A conta gratuita corta por requisições/minuto, não só por dia: na prática
   * o 429 chega depois de poucas chamadas seguidas e some sozinho em pouco
   * tempo. Então bater na cota não é motivo para encerrar a rodada: é motivo
   * para respirar e tentar o MESMO item de novo. Só depois de várias recusas
   * seguidas no teto do recuo é que concluímos que o limite é diário.
   */
  const COOLDOWN_START_MS = 30_000;
  const COOLDOWN_MAX_MS = 300_000;
  const GIVE_UP_AFTER = 5;

  let cooldown = COOLDOWN_START_MS;
  let refusals = 0;

  while (queue.length) {
    const job = queue[0];
    const outPath = join(OUT_DIR, `${job.id}.mp3`);

    try {
      const { pcm, rate } = await synthesize(job, options.model, options.delayMs);
      await pcmToMp3(pcm, rate, outPath);

      queue.shift();
      generated++;
      // Passou: o ritmo está bom, volta o recuo para o mínimo.
      cooldown = COOLDOWN_START_MS;
      refusals = 0;

      const secs = (pcm.length / (rate * 2)).toFixed(1);
      console.log(
        `  \x1b[32m✓\x1b[0m ${String(generated).padStart(3)}/${pending.length}  ${secs.padStart(5)}s  ${job.label}`,
      );
    } catch (error) {
      if (isQuotaError(error)) {
        refusals++;

        if (refusals < GIVE_UP_AFTER) {
          console.log(
            `  \x1b[33m·\x1b[0m cota por minuto: esperando ${Math.round(cooldown / 1000)}s (${refusals}/${GIVE_UP_AFTER})`,
          );
          await sleep(cooldown);
          cooldown = Math.min(cooldown * 2, COOLDOWN_MAX_MS);
          continue; // mesmo job
        }

        // Recusou em todas as esperas. Pode ser o teto diário ou uma janela
        // mais longa que a nossa escada: a mensagem de erro não distingue os
        // dois, então não afirmamos qual é.
        console.log(
          `\n  \x1b[33m▲ A cota seguiu bloqueada depois de ${GIVE_UP_AFTER} esperas.\x1b[0m ` +
            `${generated} gerados nesta rodada.`,
        );

        if (!options.watch) {
          const left = wanted.length - done - generated;
          console.log(
            `\n  Faltam ${left} áudios. Rode de novo quando a cota renovar : \n` +
              `  o script continua exatamente daqui, os ${done + generated} prontos não são refeitos.\n` +
              `  Para ele mesmo esperar e retomar sozinho: npm run gen:audio -- --watch\n`,
          );
          return;
        }

        console.log(`  Esperando ${options.waitMinutes} min para retomar (--watch)...\n`);
        await sleep(options.waitMinutes * 60_000);
        refusals = 0;
        cooldown = COOLDOWN_START_MS;
        continue; // mesmo job
      }

      // Erro do item, não da cota: registra, segue para o próximo.
      queue.shift();
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  \x1b[31m✗\x1b[0m ${job.label}\n      ${message.slice(0, 160)}`);
    }

    if (queue.length) await sleep(options.delayMs);
  }

  // Do disco, não `done + generated`: ver countOnDisk.
  const ready = countOnDisk();
  const total = wanted.filter((j) => ready.has(j.id)).length;
  console.log(`\n  ${total}/${wanted.length} áudios prontos em public/audio/`);
  if (failed) console.log(`  \x1b[31m${failed}\x1b[0m falharam: rode de novo para tentar só eles.`);
  if (total === wanted.length) {
    console.log(`\n  \x1b[32mCompleto.\x1b[0m Não esqueça de commitar public/audio/.\n`);
  } else {
    console.log(`  Faltam ${wanted.length - total}. Rode de novo quando quiser.\n`);
  }
}

main().catch((error) => {
  console.error("\n✗ Erro:", error instanceof Error ? error.message : error);
  process.exit(1);
});
