/**
 * Compara modelos do Gemini na análise de fala, usando as gravações REAIS dos
 * alunos que já estão no bucket `speaking-audio`.
 *
 *   npm run compare:fala
 *   npm run compare:fala -- --samples=5
 *   npm run compare:fala -- --models=gemini-3.6-flash,gemini-3.5-flash-lite
 *   npm run compare:fala -- --session=<uuid>
 *
 * Por que existe: a cota do free tier é por modelo, e trocar o modelo da fala
 * por um flash-lite multiplicaria a cota diária. Só que a fala é a única chamada
 * que precisa OUVIR o áudio: se o modelo mais barato "limpar" a transcrição, o
 * aluno brasileiro que fala "fink" vira "think" e o diagnóstico de pronúncia
 * desaparece sem gerar erro nenhum. Este script mede isso antes da troca.
 *
 * O que ele NÃO faz: dizer qual modelo é melhor. Ele coloca as saídas lado a
 * lado — quem julga se `heard` e `ipa` continuam fiéis é você, ouvindo o áudio.
 *
 * Roda com `--conditions=react-server` (ver package.json) para que o marcador
 * `server-only` vire no-op e o script possa chamar a MESMA `analyzeSpeaking`
 * que a rota usa. Sem isso seria preciso duplicar prompt e schema aqui, e a
 * comparação passaria a medir uma cópia que envelhece sozinha.
 */

import { analyzeSpeaking, type SpeakingAnalysis } from "@/lib/gemini/speaking";
import { chunksSpokenIn } from "@/lib/srs";
import type { CefrLevel, Chunk } from "@/lib/types/database";

import { supabaseAdmin } from "./_shared";

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
}

const SAMPLES = Number(arg("samples") ?? 3);
const SESSION_ID = arg("session");
const MODELS = (arg("models") ?? "gemini-3.6-flash,gemini-3.1-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

interface Amostra {
  id: string;
  prompt: string;
  level: CefrLevel;
  audioPath: string;
  audioMime: string;
  durationSeconds: number | null;
  transcriptOriginal: string | null;
  lessonTitle: string | null;
  grammarFocus: string | null;
  targetVocabulary: string[];
  courseId: string | null;
  chunks: Chunk[];
}

type Resultado =
  | { ok: true; analysis: SpeakingAnalysis; ms: number }
  | { ok: false; erro: string; ms: number };

async function carregarAmostras(): Promise<Amostra[]> {
  const supabase = supabaseAdmin();

  let query = supabase
    .from("speaking_sessions")
    .select("id, prompt, level, audio_path, audio_mime, duration_seconds, transcript, lesson_id, course_id")
    .order("created_at", { ascending: false });

  query = SESSION_ID ? query.eq("id", SESSION_ID) : query.limit(SAMPLES);

  const { data: sessions, error } = await query;
  if (error) throw new Error(`Não consegui listar as sessões: ${error.message}`);
  if (!sessions?.length) throw new Error("Nenhuma gravação encontrada em speaking_sessions.");

  const amostras: Amostra[] = [];

  for (const s of sessions) {
    let lessonTitle: string | null = null;
    let grammarFocus: string | null = null;
    let targetVocabulary: string[] = [];
    let chunks: Chunk[] = [];

    if (s.lesson_id) {
      // Mesmo contexto pedagógico que a rota monta: sem isso a comparação
      // mediria um prompt diferente do que roda em produção.
      const { data: lesson } = await supabase
        .from("lessons")
        .select("title, grammar_focus, vocabulary, chunks")
        .eq("id", s.lesson_id)
        .maybeSingle();

      if (lesson) {
        lessonTitle = lesson.title;
        grammarFocus = lesson.grammar_focus;
        targetVocabulary = (lesson.vocabulary ?? []).map((v) => v.term).filter(Boolean);
        chunks = lesson.chunks ?? [];
      }
    }

    amostras.push({
      id: s.id,
      prompt: s.prompt,
      level: s.level,
      audioPath: s.audio_path,
      audioMime: s.audio_mime,
      durationSeconds: s.duration_seconds,
      transcriptOriginal: s.transcript,
      lessonTitle,
      grammarFocus,
      targetVocabulary,
      courseId: s.course_id,
      chunks,
    });
  }

  return amostras;
}

async function baixarAudio(path: string): Promise<Uint8Array> {
  const { data, error } = await supabaseAdmin().storage.from("speaking-audio").download(path);
  if (error || !data) throw new Error(`Áudio não baixou (${path}): ${error?.message}`);
  return new Uint8Array(await data.arrayBuffer());
}

async function rodar(modelo: string, amostra: Amostra, audio: Uint8Array): Promise<Resultado> {
  // `geminiModels.speaking` é um getter que lê process.env a cada chamada, então
  // dá para alternar o modelo sem tocar em nada do app.
  process.env.GEMINI_MODEL_SPEAKING = modelo;

  const inicio = Date.now();
  try {
    const { analysis } = await analyzeSpeaking({
      audio,
      mimeType: amostra.audioMime,
      prompt: amostra.prompt,
      level: amostra.level,
      lessonTitle: amostra.lessonTitle,
      grammarFocus: amostra.grammarFocus,
      targetVocabulary: amostra.targetVocabulary,
      courseId: amostra.courseId,
    });
    return { ok: true, analysis, ms: Date.now() - inicio };
  } catch (error) {
    return {
      ok: false,
      erro: error instanceof Error ? error.message : String(error),
      ms: Date.now() - inicio,
    };
  }
}

function imprimirNotas(resultados: Map<string, Resultado>) {
  const criterios = ["overall", "pronunciation", "fluency", "grammar", "vocabulary", "task"] as const;
  const rotulos = ["geral", "pronúncia", "fluência", "gramática", "vocab.", "tarefa"];

  console.log(`\n  ${bold("NOTAS")}`);
  console.log(`  ${"modelo".padEnd(26)}${rotulos.map((r) => r.padStart(11)).join("")}`);

  for (const [modelo, r] of resultados) {
    if (!r.ok) {
      console.log(`  ${modelo.padEnd(26)}${red("— falhou —")}`);
      continue;
    }
    const linha = criterios.map((c) => r.analysis.scores[c].toFixed(1).padStart(11)).join("");
    console.log(`  ${modelo.padEnd(26)}${linha}`);
  }
}

function imprimirTranscricoes(resultados: Map<string, Resultado>, original: string | null) {
  console.log(`\n  ${bold("TRANSCRIÇÃO")} ${dim("(o campo que decide se a pronúncia sobrevive)")}`);
  if (original) console.log(`  ${dim("gravada no banco:")} ${original}`);

  for (const [modelo, r] of resultados) {
    if (!r.ok) continue;
    const a = r.analysis;
    console.log(`  ${dim(modelo + ":")} ${a.transcript}`);
    console.log(
      `  ${" ".repeat(modelo.length + 2)}${dim(`audible=${a.audible} · idioma=${a.language_detected} · nível=${a.estimated_level}`)}`,
    );
  }
}

function imprimirPronuncia(resultados: Map<string, Resultado>) {
  console.log(`\n  ${bold("NOTAS DE PRONÚNCIA")} ${dim("(word · ipa · heard)")}`);

  for (const [modelo, r] of resultados) {
    if (!r.ok) continue;
    const notas = r.analysis.pronunciation_notes;
    console.log(`  ${dim(modelo)} ${notas.length ? "" : yellow("— nenhuma nota devolvida —")}`);
    for (const n of notas) {
      console.log(`    ${n.word.padEnd(18)} ${(n.ipa || "?").padEnd(20)} ${dim("ouviu:")} ${n.heard || "?"}`);
    }
  }
}

/**
 * O teste silencioso: se a transcrição de um modelo for mais "limpa", ele casa
 * blocos que o aluno não falou direito e o SRS promove item que não deveria.
 * Não gera erro, não aparece em teste nenhum — só corrompe a agenda de revisão.
 */
function imprimirImpactoSrs(resultados: Map<string, Resultado>, chunks: Chunk[]) {
  if (!chunks.length) return;

  console.log(`\n  ${bold("BLOCOS QUE O SRS MARCARIA COMO FALADOS")} ${dim(`(de ${chunks.length} do circuito)`)}`);

  const porModelo = new Map<string, string[]>();
  for (const [modelo, r] of resultados) {
    if (!r.ok) continue;
    porModelo.set(modelo, chunksSpokenIn(r.analysis.transcript ?? "", chunks));
  }

  for (const [modelo, keys] of porModelo) {
    console.log(`  ${dim(modelo + ":")} ${keys.length ? keys.join(", ") : dim("nenhum")}`);
  }

  const listas = [...porModelo.values()];
  if (listas.length >= 2) {
    const iguais =
      listas.every((l) => l.length === listas[0].length) &&
      listas.every((l) => l.every((k) => listas[0].includes(k)));
    console.log(
      iguais
        ? `  ${green("✓ mesma decisão de SRS entre os modelos")}`
        : `  ${red("✗ DIVERGÊNCIA: os modelos promoveriam blocos diferentes")}`,
    );
  }
}

async function main() {
  console.log(`\n${bold("Comparação de modelos na análise de fala")}`);
  console.log(dim(`  modelos: ${MODELS.join(" vs ")}`));

  const amostras = await carregarAmostras();
  console.log(dim(`  amostras: ${amostras.length} gravação(ões) real(is) do bucket\n`));

  let falhasDeCota = 0;

  for (const [i, amostra] of amostras.entries()) {
    console.log("─".repeat(78));
    console.log(`${bold(`AMOSTRA ${i + 1}/${amostras.length}`)}  ${dim(amostra.id)}`);
    console.log(`  ${dim("lição:")} ${amostra.lessonTitle ?? dim("prática livre")}  ${dim("· nível:")} ${amostra.level}  ${dim("· duração:")} ${amostra.durationSeconds ?? "?"}s`);
    console.log(`  ${dim("enunciado:")} ${amostra.prompt.replace(/\s+/g, " ").slice(0, 120)}`);

    let audio: Uint8Array;
    try {
      audio = await baixarAudio(amostra.audioPath);
    } catch (error) {
      console.log(`  ${red(error instanceof Error ? error.message : String(error))}\n`);
      continue;
    }

    const resultados = new Map<string, Resultado>();
    for (const modelo of MODELS) {
      process.stdout.write(dim(`  → ${modelo}… `));
      const r = await rodar(modelo, amostra, audio);
      if (r.ok) {
        console.log(dim(`${(r.ms / 1000).toFixed(1)}s`));
      } else {
        console.log(red(`falhou em ${(r.ms / 1000).toFixed(1)}s`));
        console.log(`    ${red(r.erro.slice(0, 200))}`);
        if (/quota|429|rate.?limit/i.test(r.erro)) falhasDeCota++;
      }
      resultados.set(modelo, r);
    }

    imprimirNotas(resultados);
    imprimirTranscricoes(resultados, amostra.transcriptOriginal);
    imprimirPronuncia(resultados);
    imprimirImpactoSrs(resultados, amostra.chunks);
    console.log("");
  }

  console.log("─".repeat(78));
  if (falhasDeCota) {
    console.log(
      yellow(
        `\n⚠ ${falhasDeCota} chamada(s) bateram na cota diária. O free tier do Gemini é por\n` +
          `  MODELO e por projeto: rode de novo amanhã, ou compare um modelo por vez\n` +
          `  com --models=<um-modelo-só>.\n`,
      ),
    );
  }
  console.log(
    dim(
      "Como ler: compare `heard` e `ipa` com o que você ouve no áudio. Se o modelo\n" +
        "mais barato devolver transcrição limpa demais ou notas de pronúncia genéricas,\n" +
        "ele não serve para a fala — por mais cota que tenha.\n",
    ),
  );
}

void main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
