"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";
import { gradeFromRecall } from "@/lib/srs";

const reviewSchema = z.object({
  chunkKey: z.string().min(1).max(200),
  result: z.enum(["instant", "hesitant", "failed"]),
});

/** Registra uma revisão e devolve o novo intervalo, para a UI mostrar na hora. */
export async function reviewChunkAction(input: {
  chunkKey: string;
  result: "instant" | "hesitant" | "failed";
}): Promise<{ ok: boolean; error?: string; intervalDays?: number; dueDate?: string }> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const session = await getSessionContext();
  if (!session) return { ok: false, error: "Não autenticado" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("review_chunk", {
    p_chunk_key: parsed.data.chunkKey,
    p_grade: gradeFromRecall(parsed.data.result),
  });

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    intervalDays: data?.interval_days ?? 1,
    dueDate: data?.due_date ?? undefined,
  };
}

/** Matricula os blocos de um circuito na agenda do aluno. */
export async function enrollCircuitAction(
  courseId: string,
  circuitNumber: number,
): Promise<{ ok: boolean; added?: number; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { ok: false, error: "Não autenticado" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("enroll_circuit_chunks", {
    p_course_id: courseId,
    p_circuit_number: circuitNumber,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/revisao");
  return { ok: true, added: data ?? 0 };
}

/** Marca blocos como produzidos em voz alta. */
export async function markSpokenAction(chunkKeys: string[]): Promise<{ ok: boolean }> {
  const session = await getSessionContext();
  if (!session || !chunkKeys.length) return { ok: false };

  const supabase = await createServerSupabase();
  await supabase.rpc("mark_chunks_spoken", { p_chunk_keys: chunkKeys.slice(0, 100) });

  revalidatePath("/app/revisao");
  return { ok: true };
}
