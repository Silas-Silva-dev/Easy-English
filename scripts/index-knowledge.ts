/**
 * Indexa o material do curso no pgvector para o RAG da tutora.
 *
 *   npm run index:knowledge                 # só o que mudou
 *   npm run index:knowledge -- --force      # reindexa tudo
 *   npm run index:knowledge -- --course ingles-para-conversacao
 *
 * Usa o checksum do conteúdo para pular lições que não mudaram desde a última
 * indexação — rodar de novo depois de editar uma lição custa quase nada.
 */

import { createHash } from "node:crypto";

import { lessonToChunks, normalizeVector } from "@/lib/gemini/chunking";
import type { Lesson } from "@/lib/types/database";

import { EMBEDDING_DIMENSIONS, genai, mapLimit, MODELS, progress, supabaseAdmin, withRetry } from "./_shared";

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : undefined;
};
const FORCE = argv.includes("--force");
const COURSE_SLUG = flag("course") ?? "ingles-para-conversacao";
const CONCURRENCY = Number(flag("concurrency") ?? 3);
const BATCH_SIZE = 24;

function checksum(input: string) {
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

async function main() {
  const supabase = supabaseAdmin();
  const ai = genai();
  const model = MODELS.embedding();

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, title")
    .eq("slug", COURSE_SLUG)
    .single();

  if (courseError || !course) throw new Error(`Curso "${COURSE_SLUG}" não encontrado. Rode npm run seed:curriculum antes.`);

  console.log(`\n▸ Indexando: ${course.title}`);

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", course.id)
    .eq("is_published", true)
    .order("day_number");

  if (lessonsError) throw new Error(`Falha ao buscar lições: ${lessonsError.message}`);
  if (!lessons?.length) {
    console.log("  Nenhuma lição publicada para indexar.\n");
    return;
  }

  const { data: existingDocs } = await supabase
    .from("knowledge_documents")
    .select("id, lesson_id, checksum")
    .eq("course_id", course.id);

  const docByLesson = new Map((existingDocs ?? []).map((d) => [d.lesson_id, d]));

  console.log(`  ${lessons.length} lições publicadas · modelo ${model}\n`);

  let indexed = 0;
  let skipped = 0;
  let chunkTotal = 0;
  let done = 0;
  const errors: string[] = [];

  await mapLimit(lessons as Lesson[], CONCURRENCY, async (lesson) => {
    try {
      const chunks = lessonToChunks(lesson);
      if (!chunks.length) {
        skipped++;
        return;
      }

      const hash = checksum(chunks.map((c) => c.content).join("\n"));
      const existing = docByLesson.get(lesson.id);

      if (!FORCE && existing?.checksum === hash) {
        skipped++;
        return;
      }

      // Recria o documento do zero — o cascade limpa os chunks antigos.
      if (existing) {
        await supabase.from("knowledge_documents").delete().eq("id", existing.id);
      }

      const { data: doc, error: docError } = await supabase
        .from("knowledge_documents")
        .insert({
          course_id: course.id,
          lesson_id: lesson.id,
          title: `Dia ${lesson.day_number} — ${lesson.title}`,
          source: "lesson",
          checksum: hash,
        })
        .select()
        .single();

      if (docError || !doc) throw new Error(docError?.message ?? "falha ao criar documento");

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);

        const response = await withRetry(() =>
          ai.models.embedContent({
            model,
            contents: batch.map((c) => ({ role: "user", parts: [{ text: c.content }] })),
            config: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: "RETRIEVAL_DOCUMENT" },
          }),
        );

        const embeddings = response.embeddings ?? [];
        if (embeddings.length !== batch.length) {
          throw new Error(`esperava ${batch.length} embeddings, recebi ${embeddings.length}`);
        }

        const { error: chunkError } = await supabase.from("knowledge_chunks").insert(
          batch.map((chunk, j) => ({
            document_id: doc.id,
            course_id: course.id,
            lesson_id: lesson.id,
            chunk_index: i + j,
            content: chunk.content,
            metadata: chunk.metadata,
            embedding: normalizeVector(embeddings[j].values!) as unknown as never,
          })),
        );

        if (chunkError) throw new Error(chunkError.message);
      }

      indexed++;
      chunkTotal += chunks.length;
    } catch (err) {
      errors.push(`  dia ${lesson.day_number}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      progress(++done, lessons.length, `dia ${lesson.day_number}`);
    }
  });

  console.log(`
✓ Indexação concluída.

  Lições indexadas .... ${indexed}
  Sem alteração ....... ${skipped}
  Trechos vetorizados . ${chunkTotal}
  Falhas .............. ${errors.length}
`);

  if (errors.length) console.log("Erros:\n" + errors.slice(0, 15).join("\n") + "\n");
}

main().catch((error) => {
  console.error("\n✗ Erro na indexação:", error instanceof Error ? error.message : error);
  process.exit(1);
});
