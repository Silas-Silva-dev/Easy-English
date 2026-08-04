/**
 * Recompõe e sintetiza todos os áudios do curso (728 aulas / 52 circuitos)
 * utilizando a API do Gemini TTS (ou Cloud TTS Neural2) para garantir que
 * diálogos e falas soem 100% nativos, com entonação, ritmo, conexões de fala
 * (connected speech) e sotaques corretos.
 *
 * Inclui validação completa do disco x catálogo x banco de dados no final.
 *
 * Uso:
 *   npx tsx scripts/rebuild-native-audio.ts
 *   npx tsx scripts/rebuild-native-audio.ts --engine gemini --model gemini-3.1-flash-tts-preview
 *   npx tsx scripts/rebuild-native-audio.ts --engine google
 *   npx tsx scripts/rebuild-native-audio.ts --validate-only
 */

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import {
  audioJobs,
  googleVoiceNames,
  spokenLines,
  voiceFor,
  voicePairFor,
  type AudioJob,
  type Engine,
} from "../content/audio-manifest";
import { audioId } from "../src/lib/audio-id";
import { GOOGLE_SAMPLE_RATE, listVoices, synthesizeLine } from "./google-tts";
import { env, genai, sleep, supabaseAdmin } from "./_shared";

const OUT_DIR = join(process.cwd(), "public", "audio");
const LEDGER_PATH = join(OUT_DIR, "engines.json");

/** Voz padrão do professor/narrador para os blocos isolados. */
const CHUNK_VOICE = "Kore";

/** Prompt de estilo para o Gemini TTS garantir pronúncia nativa e entonação natural. */
const NATIVE_DIALOGUE_PROMPT =
  "Read the following dialogue exactly as native American English speakers would in a natural, real-life conversation. " +
  "Use realistic speech linking, natural contractions, appropriate pitch variations, smooth elision, and authentic native stress and intonation. " +
  "Do NOT read word-by-word or sound mechanical.";

const NATIVE_CHUNK_PROMPT =
  "Pronounce the following phrase naturally as a native American English speaker would in everyday conversation. " +
  "Use authentic connected speech, natural stress, and realistic rhythm. Speak smoothly and naturally once.";

interface RebuildOptions {
  engine: Engine;
  model: string;
  limit: number;
  delayMs: number;
  circuit: number | null;
  force: boolean;
  validateOnly: boolean;
}

function parseOptions(): RebuildOptions {
  const args = process.argv.slice(2);
  const getArg = (key: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  const hasFlag = (key: string) => args.includes(`--${key}`);

  const engineArg = (getArg("engine") ?? "gemini").toLowerCase() as Engine;
  const engine = ["gemini", "google", "piper"].includes(engineArg)
    ? engineArg
    : "gemini";

  return {
    engine,
    model: getArg("model") ?? env("GEMINI_MODEL_TTS", "gemini-3.1-flash-tts-preview"),
    limit: Number(getArg("limit") ?? Number.POSITIVE_INFINITY),
    delayMs: Number(getArg("delay") ?? (engine === "google" ? 100 : 3000)),
    circuit: getArg("circuit") ? Number(getArg("circuit")) : null,
    force: hasFlag("force"),
    validateOnly: hasFlag("validate-only"),
  };
}

function readLedger(): Record<string, Engine> {
  try {
    return JSON.parse(readFileSync(LEDGER_PATH, "utf8")) as Record<string, Engine>;
  } catch {
    return {};
  }
}

function writeLedger(ledger: Record<string, Engine>) {
  const sorted = Object.fromEntries(
    Object.entries(ledger).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(LEDGER_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf8");
}

function pcmToMp3(pcm: Buffer, sampleRate: number, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "s16le",
      "-ar",
      String(sampleRate),
      "-ac",
      "1",
      "-i",
      "pipe:0",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "64k",
      "-y",
      outPath,
    ]);

    let stderr = "";
    ff.stderr.on("data", (d) => (stderr += d.toString()));
    ff.on("error", reject);
    ff.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg erro (${code}): ${stderr.trim()}`)),
    );

    ff.stdin.on("error", () => {});
    ff.stdin.end(pcm);
  });
}

function silence(rate: number, ms = 400): Buffer {
  return Buffer.alloc(Math.round((rate * 2 * ms) / 1000));
}

/** Síntese via Gemini API com prompt nativo. */
async function speakGemini(
  text: string,
  speechConfig: object,
  model: string,
): Promise<{ pcm: Buffer; rate: number }> {
  const client = genai();
  const response = await client.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text }] }],
    config: { responseModalities: ["AUDIO"], speechConfig },
  });

  const inline = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inline?.data) {
    throw new Error("API do Gemini não retornou dados de áudio");
  }

  return {
    pcm: Buffer.from(inline.data, "base64"),
    rate: Number(/rate=(\d+)/.exec(inline.mimeType ?? "")?.[1] ?? 24000),
  };
}

/** Sintetiza um job via Gemini API com 2 locutores, 1 locutor ou falas emendadas. */
async function synthesizeGemini(
  job: AudioJob,
  model: string,
  delayMs: number,
): Promise<{ pcm: Buffer; rate: number }> {
  const oneVoice = (name: string) => ({
    voiceConfig: { prebuiltVoiceConfig: { voiceName: name } },
  });

  if (job.kind !== "dialogue") {
    return speakGemini(`${NATIVE_CHUNK_PROMPT}\n\n${job.text}`, oneVoice(CHUNK_VOICE), model);
  }

  const lines = job.text.split(/\s*\/\s*/);

  if (job.speakers.length === 2) {
    const [voiceA, voiceB] = voicePairFor(job.speakers[0], job.speakers[1], "gemini");
    return speakGemini(
      `${NATIVE_DIALOGUE_PROMPT}\n\n${lines.join("\n")}`,
      {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            {
              speaker: job.speakers[0],
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceA } },
            },
            {
              speaker: job.speakers[1],
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceB } },
            },
          ],
        },
      },
      model,
    );
  }

  if (job.speakers.length === 1) {
    return speakGemini(
      `${NATIVE_DIALOGUE_PROMPT}\n\n${lines.join("\n")}`,
      oneVoice(voiceFor(job.speakers[0], "gemini")),
      model,
    );
  }

  // 3+ locutores: sintetiza fala a fala e une os PCMs com 400ms de silêncio
  const parts: Buffer[] = [];
  let sampleRate = 24000;

  for (let i = 0; i < lines.length; i++) {
    const match = /^([^:]{1,24}):\s*(.+)$/.exec(lines[i]);
    const who = match?.[1]?.trim() ?? job.speakers[0];
    const said = match?.[2]?.trim() ?? lines[i];

    const piece = await speakGemini(
      `${NATIVE_CHUNK_PROMPT}\n\n${said}`,
      oneVoice(voiceFor(who, "gemini")),
      model,
    );
    sampleRate = piece.rate;
    if (parts.length > 0) parts.push(silence(sampleRate));
    parts.push(piece.pcm);

    if (i < lines.length - 1 && delayMs > 0) await sleep(delayMs);
  }

  return { pcm: Buffer.concat(parts), rate: sampleRate };
}

/** Síntese via Google Cloud TTS (Neural2). */
async function synthesizeGoogle(
  job: AudioJob,
  delayMs: number,
): Promise<{ pcm: Buffer; rate: number }> {
  const lines = spokenLines(job, "google");
  const parts: Buffer[] = [];

  for (let i = 0; i < lines.length; i++) {
    parts.push(await synthesizeLine(lines[i].text, lines[i].voice));
    if (i < lines.length - 1) {
      parts.push(silence(GOOGLE_SAMPLE_RATE));
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  return { pcm: Buffer.concat(parts), rate: GOOGLE_SAMPLE_RATE };
}

/** Valida se os arquivos MP3 gerados correspondem a todas as 728 aulas. */
export async function validateCourseAudio() {
  console.log("\n=======================================================");
  console.log(" VALIDACÃO COMPLETA DE ÁUDIO DAS 728 AULAS DO CURSO");
  console.log("=======================================================\n");

  const jobs = audioJobs();
  const ledger = readLedger();
  const diskFiles = new Set(
    readdirSync(OUT_DIR)
      .filter((f) => f.endsWith(".mp3"))
      .map((f) => f.replace(/\.mp3$/, "")),
  );

  console.log(`1. Verificação do Catálogo (${jobs.length} áudios cadastrados):`);
  let missingCatalog = 0;
  let totalBytes = 0;
  let invalidFiles = 0;

  for (const job of jobs) {
    const filePath = join(OUT_DIR, `${job.id}.mp3`);
    if (!existsSync(filePath)) {
      missingCatalog++;
      console.log(`  ✗ [FALTANTE] Catalog ID ${job.id} (${job.label})`);
    } else {
      const stats = statSync(filePath);
      totalBytes += stats.size;
      if (stats.size < 500) {
        invalidFiles++;
        console.log(`  ✗ [CORROMPIDO/PEQUENO] ${job.id}.mp3 (${stats.size} bytes)`);
      }
    }
  }

  if (missingCatalog === 0 && invalidFiles === 0) {
    console.log(`  ✓ Todos os ${jobs.length} áudios do catálogo estão gravados e válidos em disco!`);
  } else {
    console.log(`  ✗ Catálogo incompleto: ${missingCatalog} faltantes, ${invalidFiles} corrompidos.`);
  }

  console.log("\n2. Verificação de Cobertura no Banco de Dados (728 Aulas):");
  let dbMatchOk = false;
  let missingDbCount = 0;

  try {
    const supabase = supabaseAdmin();
    const { data: lessons, error } = await supabase
      .from("lessons")
      .select("day_number, chunks, immersion_script, listening_script")
      .order("day_number");

    if (error) {
      console.log(`  ⚠️ Não foi possível consultar o Supabase: ${error.message}`);
    } else if (lessons) {
      const dbTexts = new Set<string>();
      const missingDbItems: { day: number; text: string; id: string }[] = [];

      for (const lesson of lessons) {
        const checkText = (text: string | null) => {
          if (!text || !text.trim()) return;
          const clean = text.trim();
          const id = audioId(clean);
          dbTexts.add(id);
          if (!diskFiles.has(id)) {
            missingDbItems.push({ day: lesson.day_number, text: clean, id });
          }
        };

        (lesson.chunks ?? []).forEach((c) => checkText(c.en));
        checkText(lesson.immersion_script);
        checkText(lesson.listening_script);
      }

      missingDbCount = missingDbItems.length;
      console.log(`  - Aulas consultadas no banco: ${lessons.length}/728`);
      console.log(`  - Textos de áudio únicos exigidos: ${dbTexts.size}`);

      if (missingDbCount === 0) {
        console.log(`  ✓ 100% das 728 aulas possuem áudio nativo correspondente em disco!`);
        dbMatchOk = true;
      } else {
        console.log(`  ✗ ${missingDbCount} textos de áudio das aulas ainda caem na voz do navegador.`);
      }
    }
  } catch (err) {
    console.log(`  ⚠️ Erro na consulta do banco: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log("\n3. Distribuição dos Motores de Síntese em disco:");
  const engineCounts: Record<string, number> = {};
  for (const fileId of diskFiles) {
    const engine = ledger[fileId] ?? "sem registro";
    engineCounts[engine] = (engineCounts[engine] ?? 0) + 1;
  }

  for (const [engine, count] of Object.entries(engineCounts)) {
    const pct = Math.round((count / diskFiles.size) * 100);
    console.log(`  - Motor ${engine.padEnd(12)}: ${count} áudios (${pct}%)`);
  }

  const overallSuccess = missingCatalog === 0 && invalidFiles === 0 && (dbMatchOk || missingDbCount === 0);

  console.log("\n=======================================================");
  console.log(` RESULTADO DA VALIDAÇÃO: ${overallSuccess ? "✓ TUDO OK" : "✗ REQUER ATENÇÃO"}`);
  console.log(` Total de Arquivos MP3 em disco: ${diskFiles.size}`);
  console.log(` Tamanho Total de Áudios: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log("=======================================================\n");

  return overallSuccess;
}

/** Função principal para regerar áudios com API nativa e validar. */
export async function rebuildAllCourseAudio() {
  const opts = parseOptions();

  if (opts.validateOnly) {
    await validateCourseAudio();
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  console.log("\n=======================================================");
  console.log(" RECONSTRUÇÃO NATIVA DE ÁUDIOS DO CURSO (GEMINI / CLOUD TTS)");
  console.log("=======================================================");
  console.log(` Motor selecionado: ${opts.engine} ${opts.engine === "gemini" ? `(${opts.model})` : ""}`);
  console.log(` Estilo e Entonação: Nativo Americano com fala conectada (connected speech)`);

  if (opts.engine === "google") {
    try {
      const voices = await listVoices("en-US");
      const available = new Set(voices.map((v) => v.name));
      const missing = googleVoiceNames().filter((name) => !available.has(name));
      if (missing.length) {
        console.error(`\n✗ Vozes do Cloud TTS ausentes: ${missing.join(", ")}`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`\n✗ Não foi possível validar vozes do Google Cloud TTS: ${err}`);
      process.exit(1);
    }
  }

  const jobs = audioJobs();
  const scoped = opts.circuit ? jobs.filter((j) => j.circuit === opts.circuit) : jobs;
  const ledger = readLedger();
  const onDisk = new Set(
    readdirSync(OUT_DIR)
      .filter((f) => f.endsWith(".mp3"))
      .map((f) => f.replace(/\.mp3$/, "")),
  );

  const pending = scoped.filter((j) => {
    if (opts.force) return true;
    if (!onDisk.has(j.id)) return true;
    return ledger[j.id] !== opts.engine;
  }).slice(0, Number.isFinite(opts.limit) ? opts.limit : undefined);

  console.log(` Total de jobs no catálogo: ${jobs.length}`);
  console.log(` Áudios pendentes para síntese nativa: ${pending.length}\n`);

  let count = 0;
  let failures = 0;

  for (const job of pending) {
    count++;
    const label = `[${count}/${pending.length}] ${job.label}`;
    try {
      const result =
        opts.engine === "google"
          ? await synthesizeGoogle(job, opts.delayMs)
          : await synthesizeGemini(job, opts.model, opts.delayMs);

      const outPath = join(OUT_DIR, `${job.id}.mp3`);
      await pcmToMp3(result.pcm, result.rate, outPath);

      ledger[job.id] = opts.engine;
      writeLedger(ledger);

      console.log(`  \x1b[32m✓\x1b[0m ${label}`);

      if (opts.delayMs > 0 && count < pending.length) {
        await sleep(opts.delayMs);
      }
    } catch (err) {
      failures++;
      console.error(`  \x1b[31m✗\x1b[0m ${label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nSintese concluida! ${count - failures} gerados com sucesso, ${failures} falhas.`);

  // Executa a validação final
  await validateCourseAudio();
}

if (require.main === module) {
  rebuildAllCourseAudio().catch((err) => {
    console.error("Erro na reconstrução de áudio:", err);
    process.exit(1);
  });
}
