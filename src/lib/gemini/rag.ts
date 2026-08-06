import "server-only";

import { EMBEDDING_DIMENSIONS, geminiModels } from "@/lib/env";
import { normalizeVector } from "@/lib/gemini/chunking";
import { gemini, withRetry } from "@/lib/gemini/client";

export {
  buildContextBlock,
  lessonToChunks,
  normalizeVector,
  type KnowledgeChunkInput,
  type RetrievedChunk,
} from "@/lib/gemini/chunking";

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "SEMANTIC_SIMILARITY";

/** Gera o embedding de um texto. `taskType` muda o vetor: documento != consulta. */
export async function embedText(
  text: string,
  taskType: EmbeddingTaskType = "RETRIEVAL_QUERY",
): Promise<number[]> {
  const response = await withRetry(() =>
    gemini().models.embedContent({
      model: geminiModels.embedding,
      contents: [{ role: "user", parts: [{ text }] }],
      config: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType },
    }),
  );

  const values = response.embeddings?.[0]?.values;
  if (!values?.length) throw new Error("O Gemini não retornou embedding para o texto informado");

  return normalizeVector(values);
}

/** Versão em lote: usada na indexação das 728 lições. */
export async function embedBatch(
  texts: string[],
  taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
): Promise<number[][]> {
  if (!texts.length) return [];

  const response = await withRetry(() =>
    gemini().models.embedContent({
      model: geminiModels.embedding,
      contents: texts.map((text) => ({ role: "user", parts: [{ text }] })),
      config: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType },
    }),
  );

  const embeddings = response.embeddings ?? [];
  if (embeddings.length !== texts.length) {
    throw new Error(
      `Esperava ${texts.length} embeddings, recebi ${embeddings.length} do modelo de embedding`,
    );
  }

  return embeddings.map((e) => {
    if (!e.values?.length) throw new Error("Embedding vazio retornado pelo Gemini");
    return normalizeVector(e.values);
  });
}
