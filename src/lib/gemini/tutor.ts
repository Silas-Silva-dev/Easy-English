import "server-only";

import { geminiModels } from "@/lib/env";
import { gemini, withRetry } from "@/lib/gemini/client";
import { tutorSystemPrompt } from "@/lib/gemini/prompts";
import { buildContextBlock, embedText, type RetrievedChunk } from "@/lib/gemini/rag";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { CefrLevel } from "@/lib/types/database";

export interface TutorTurn {
  role: "user" | "assistant";
  content: string;
}

export interface TutorReply {
  text: string;
  citations: { lesson_id: string | null; title: string; snippet: string }[];
}

/** Recupera os trechos do curso mais relevantes para a pergunta. */
export async function retrieveContext(
  question: string,
  courseId?: string | null,
  matchCount = 6,
): Promise<RetrievedChunk[]> {
  const embedding = await embedText(question, "RETRIEVAL_QUERY");
  const supabase = createAdminSupabase();

  const { data, error } = await supabase.rpc("match_knowledge", {
    query_embedding: embedding,
    match_count: matchCount,
    filter_course: courseId ?? null,
    similarity_floor: 0.35,
  });

  if (error) {
    // Busca semantica indisponivel nao pode derrubar o tutor: ele responde
    // com o conhecimento geral do modelo.
    console.error("[tutor] falha ao recuperar contexto:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    lesson_id: row.lesson_id,
    content: row.content,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    similarity: row.similarity,
  }));
}

/** Responde a uma pergunta do aluno usando o material do curso como base. */
export async function askTutor(params: {
  question: string;
  history?: TutorTurn[];
  level: CefrLevel;
  studentName?: string | null;
  courseId?: string | null;
}): Promise<TutorReply> {
  const { question, history = [], level, studentName, courseId } = params;

  const chunks = await retrieveContext(question, courseId);

  const response = await withRetry(() =>
    gemini().models.generateContent({
      model: geminiModels.tutor,
      contents: [
        ...history.slice(-10).map((turn) => ({
          role: turn.role === "assistant" ? ("model" as const) : ("user" as const),
          parts: [{ text: turn.content }],
        })),
        { role: "user" as const, parts: [{ text: question }] },
      ],
      config: {
        systemInstruction: tutorSystemPrompt({
          level,
          studentName,
          context: buildContextBlock(chunks),
        }),
        temperature: 0.6,
        maxOutputTokens: 1400,
      },
    }),
  );

  return {
    text: response.text?.trim() || "Nao consegui gerar uma resposta agora. Tente reformular a pergunta.",
    citations: chunks.slice(0, 3).map((chunk) => {
      const meta = chunk.metadata as { title?: string; day_number?: number };
      return {
        lesson_id: chunk.lesson_id,
        title: meta?.day_number ? `Dia ${meta.day_number}: ${meta.title ?? ""}` : "Material do curso",
        snippet: chunk.content.slice(0, 220),
      };
    }),
  };
}
