/**
 * Repetição espaçada por bloco (chunk).
 *
 * Implementa SM-2 com duas adaptações para fala:
 *
 *   1. A nota não vem de um botão "eu lembrei". Vem do desempenho real:
 *      da nota da tutora quando o aluno FALOU o bloco, ou do acerto na
 *      recuperação ativa. Autoavaliação infla — desempenho medido, não.
 *
 *   2. Reconhecer não é o mesmo que produzir. `spoken_count` conta quantas
 *      vezes o aluno de fato disse o bloco em voz alta; um bloco só é
 *      considerado dominado depois de produzido, não só revisado.
 *
 * O cálculo de agenda vive no banco (função `review_chunk`) para que qualquer
 * cliente — app, script, futura API — use exatamente a mesma regra.
 */

export interface ChunkMastery {
  id: string;
  user_id: string;
  course_id: string;
  circuit_number: number;
  chunk_key: string;
  chunk_en: string;
  chunk_pt: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  due_date: string;
  last_grade: number | null;
  last_reviewed_at: string | null;
  spoken_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Identidade estável de um bloco.
 *
 * PRECISA produzir exatamente o mesmo slug que `enroll_circuit_chunks` no SQL
 * (migration 20260101000500) — é essa chave que liga o que o aluno falou ao
 * item da agenda dele. Se as duas divergirem, `mark_chunks_spoken` não casa
 * nada e o contador de produção falada fica em zero sem erro nenhum.
 */
export function chunkKey(en: string): string {
  return en
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Converte a nota 0-10 da tutora na escala 0-5 do SM-2.
 *
 * O corte em 3 não é arbitrário: no SM-2, nota < 3 reinicia o intervalo.
 * Uma fala com nota 6/10 tem erro que atrapalha — merece voltar ao começo.
 */
export function gradeFromScore(score0to10: number): number {
  if (score0to10 >= 9.0) return 5;
  if (score0to10 >= 7.5) return 4;
  if (score0to10 >= 6.0) return 3;
  if (score0to10 >= 4.0) return 2;
  if (score0to10 >= 2.0) return 1;
  return 0;
}

/** Nota a partir de uma recuperação ativa (acertou / hesitou / não lembrou). */
export function gradeFromRecall(result: "instant" | "hesitant" | "failed"): number {
  return result === "instant" ? 5 : result === "hesitant" ? 3 : 1;
}

export type MasteryStage = "novo" | "aprendendo" | "consolidando" | "dominado" | "travado";

/**
 * Estágio exibido ao aluno.
 *
 * "dominado" exige produção falada, não só revisão — é o que separa
 * reconhecer de conseguir usar.
 */
export function masteryStage(chunk: ChunkMastery): MasteryStage {
  if (chunk.lapses >= 3 && chunk.ease_factor < 2.0) return "travado";
  if (chunk.repetitions === 0) return "novo";
  if (chunk.repetitions >= 4 && chunk.ease_factor >= 2.3 && chunk.spoken_count >= 2) {
    return "dominado";
  }
  if (chunk.repetitions >= 2) return "consolidando";
  return "aprendendo";
}

export const STAGE_LABEL: Record<MasteryStage, string> = {
  novo: "Novo",
  aprendendo: "Aprendendo",
  consolidando: "Consolidando",
  dominado: "Dominado",
  travado: "Travado",
};

export const STAGE_TONE: Record<MasteryStage, "neutral" | "warning" | "default" | "success" | "destructive"> = {
  novo: "neutral",
  aprendendo: "warning",
  consolidando: "default",
  dominado: "success",
  travado: "destructive",
};

/**
 * Ordena a fila de revisão do dia.
 *
 * Prioridade: travados primeiro (o aluno está esquecendo de verdade), depois
 * os mais atrasados, depois os que nunca foram falados em voz alta.
 */
export function sortReviewQueue(chunks: ChunkMastery[]): ChunkMastery[] {
  const today = new Date().toISOString().slice(0, 10);

  return [...chunks].sort((a, b) => {
    const aStuck = a.lapses >= 3 ? 0 : 1;
    const bStuck = b.lapses >= 3 ? 0 : 1;
    if (aStuck !== bStuck) return aStuck - bStuck;

    const aLate = a.due_date < today ? 0 : 1;
    const bLate = b.due_date < today ? 0 : 1;
    if (aLate !== bLate) return aLate - bLate;

    if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    return a.spoken_count - b.spoken_count;
  });
}

/**
 * Quantos blocos cabem na sessão de revisão conforme o tempo da trilha.
 * Cerca de 20 segundos por bloco, incluindo a fala em voz alta.
 */
export function reviewBatchSize(minutes: number): number {
  return Math.max(5, Math.min(60, Math.round((minutes * 60) / 20)));
}

/** Prévia local do próximo intervalo — só para mostrar na UI antes de salvar. */
export function previewNextInterval(chunk: ChunkMastery, grade: number): number {
  const ef = Math.max(
    1.3,
    chunk.ease_factor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)),
  );
  if (grade < 3) return 1;
  const reps = chunk.repetitions + 1;
  if (reps === 1) return 1;
  if (reps === 2) return 6;
  return Math.max(1, Math.round(chunk.interval_days * ef));
}

export function formatInterval(days: number): string {
  if (days <= 1) return "amanhã";
  if (days < 30) return `em ${days} dias`;
  const months = Math.round(days / 30);
  return months <= 1 ? "em 1 mês" : `em ${months} meses`;
}
