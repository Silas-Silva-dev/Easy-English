/**
 * Funções puras de preparo do RAG.
 *
 * Este módulo NÃO importa "server-only" de propósito: os scripts de CLI
 * (`scripts/index-knowledge.ts`) precisam reaproveitá-lo fora do Next.
 */

import type { Lesson } from "@/lib/types/database";

export interface RetrievedChunk {
  id: string;
  lesson_id: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface KnowledgeChunkInput {
  content: string;
  metadata: Record<string, unknown>;
}

/**
 * gemini-embedding-001 não normaliza o vetor quando outputDimensionality < 3072.
 * A busca por cosseno no pgvector depende de vetores unitários.
 */
export function normalizeVector(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  return norm > 0 ? values.map((v) => v / norm) : values;
}

/** Transforma uma lição em documentos de texto plano prontos para indexação. */
export function lessonToChunks(lesson: Lesson): KnowledgeChunkInput[] {
  const header = `Dia ${lesson.day_number} (circuito ${lesson.week_number}): ${lesson.title}`;
  const chunks: KnowledgeChunkInput[] = [];

  const push = (section: string, body: string) => {
    const trimmed = body.trim();
    if (trimmed.length < 20) return;
    chunks.push({
      content: `${header}\nSeção: ${section}\n\n${trimmed}`,
      metadata: {
        lesson_id: lesson.id,
        day_number: lesson.day_number,
        week_number: lesson.week_number,
        title: lesson.title,
        level: lesson.level,
        section,
      },
    });
  };

  if (lesson.objective) push("Objetivo", lesson.objective);

  if (lesson.grammar_focus || lesson.grammar_explanation) {
    push("Gramática", `${lesson.grammar_focus ?? ""}\n${lesson.grammar_explanation ?? ""}`);
  }

  if (lesson.vocabulary?.length) {
    push(
      "Vocabulário",
      lesson.vocabulary
        .map(
          (v) =>
            `${v.term} ${v.ipa ? `[${v.ipa}] ` : ""}= ${v.translation}` +
            (v.example
              ? `\n  Ex.: ${v.example}${v.exampleTranslation ? ` (${v.exampleTranslation})` : ""}`
              : ""),
        )
        .join("\n"),
    );
  }

  if (lesson.phrases?.length) {
    push(
      "Frases úteis",
      lesson.phrases.map((p) => `${p.en} = ${p.pt}${p.context ? ` (${p.context})` : ""}`).join("\n"),
    );
  }

  for (const block of lesson.content?.blocks ?? []) {
    switch (block.type) {
      case "text":
      case "callout":
        push(block.title ?? "Explicação", block.body);
        break;
      case "dialogue":
        push(
          block.title ?? "Diálogo",
          block.lines.map((l) => `${l.speaker}: ${l.en}${l.pt ? ` (${l.pt})` : ""}`).join("\n"),
        );
        break;
      case "examples":
        push(
          block.title ?? "Exemplos",
          block.items.map((i) => `${i.en} = ${i.pt}${i.note ? `: ${i.note}` : ""}`).join("\n"),
        );
        break;
      case "drill":
        push(block.title ?? "Prática", `${block.instruction}\n${block.items.join("\n")}`);
        break;
      case "practice":
        push(block.title ?? "Prática", `${block.instruction}\n${block.prompts.join("\n")}`);
        break;
    }
  }

  if (lesson.listening_script) push("Áudio / script", lesson.listening_script);
  if (lesson.speaking_prompt) push("Prática falada", lesson.speaking_prompt);

  return chunks;
}

/** Monta o bloco de contexto injetado no prompt do tutor. */
export function buildContextBlock(chunks: RetrievedChunk[]): string {
  if (!chunks.length) return "";

  return chunks
    .map((chunk, index) => {
      const meta = chunk.metadata as { title?: string; day_number?: number };
      const label = meta?.day_number
        ? `Dia ${meta.day_number}: ${meta.title ?? ""}`
        : "Material do curso";
      return `[${index + 1}] ${label} (relevância ${chunk.similarity.toFixed(2)})\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}
