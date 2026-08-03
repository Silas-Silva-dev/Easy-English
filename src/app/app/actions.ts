"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";

const completeSchema = z.object({
  lessonId: z.string().uuid(),
  minutes: z.number().int().min(0).max(240),
  score: z.number().min(0).max(100).nullable(),
  quizAnswers: z.array(z.number().int()).max(50),
});

export interface CompleteLessonResult {
  ok: boolean;
  error?: string;
  streak?: number;
  nextDay?: number | null;
}

/**
 * Marca a lição como concluída, contabiliza os minutos do dia e recalcula a
 * ofensiva. O avanço do `current_day` só acontece se o aluno estava justamente
 * naquele dia — refazer lição antiga não pula o cronograma.
 */
export async function completeLessonAction(input: {
  lessonId: string;
  minutes: number;
  score: number | null;
  quizAnswers: number[];
}): Promise<CompleteLessonResult> {
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const session = await getSessionContext();
  if (!session) return { ok: false, error: "Não autenticado" };
  if (session.profile.status !== "active") return { ok: false, error: "Conta não verificada" };

  const { lessonId, minutes, score, quizAnswers } = parsed.data;
  const supabase = await createServerSupabase();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, course_id, day_number, week_number, is_published")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson?.is_published) return { ok: false, error: "Lição indisponível" };

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("*")
    .eq("user_id", session.userId)
    .eq("course_id", lesson.course_id)
    .maybeSingle();

  if (!enrollment) return { ok: false, error: "Matrícula não encontrada" };

  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("id, status, attempts")
    .eq("enrollment_id", enrollment.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  const alreadyCompleted = existing?.status === "completed";
  const now = new Date().toISOString();

  const { error: progressError } = await supabase.from("lesson_progress").upsert(
    {
      ...(existing?.id ? { id: existing.id } : {}),
      enrollment_id: enrollment.id,
      user_id: session.userId,
      lesson_id: lessonId,
      status: "completed",
      score,
      quiz_answers: quizAnswers,
      minutes_spent: minutes,
      attempts: (existing?.attempts ?? 0) + 1,
      started_at: now,
      completed_at: now,
    },
    { onConflict: "enrollment_id,lesson_id" },
  );

  if (progressError) {
    console.error("[lesson] falha ao salvar progresso:", progressError.message);
    return { ok: false, error: "Não foi possível salvar seu progresso" };
  }

  // Contabiliza minutos e recalcula a ofensiva no banco.
  const { data: updated, error: rpcError } = await supabase.rpc("register_study_activity", {
    p_enrollment_id: enrollment.id,
    p_minutes: minutes,
    p_lessons_done: alreadyCompleted ? 0 : 1,
  });

  if (rpcError) console.error("[lesson] falha ao registrar atividade:", rpcError.message);

  /**
   * Coloca os blocos deste circuito na agenda individual de revisão.
   *
   * Sem isso a fila de repetição espaçada nunca enche e a aba Revisão fica
   * vazia para sempre. A RPC é idempotente (`on conflict do nothing`), então
   * chamar a cada lição concluída é barato e não zera o progresso de quem
   * já revisou aquele bloco. Usa o cliente do usuário porque a função depende
   * de `auth.uid()` para saber de quem é a agenda.
   */
  const { error: enrollChunksError } = await supabase.rpc("enroll_circuit_chunks", {
    p_course_id: lesson.course_id,
    p_circuit_number: lesson.week_number,
  });

  if (enrollChunksError) {
    console.error("[lesson] falha ao matricular blocos no SRS:", enrollChunksError.message);
  }

  // Avança o cronograma apenas quando o aluno concluiu o dia corrente.
  let nextDay: number | null = null;
  if (lesson.day_number >= enrollment.current_day) {
    nextDay = lesson.day_number + 1;
    await supabase.from("enrollments").update({ current_day: nextDay }).eq("id", enrollment.id);
  }

  revalidatePath("/app");
  revalidatePath("/app/cronograma");
  revalidatePath("/app/revisao");
  revalidatePath(`/app/licao/${lesson.day_number}`);

  return {
    ok: true,
    streak: updated?.streak_current ?? enrollment.streak_current,
    nextDay,
  };
}

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  dailyGoalMinutes: z.coerce.number().int().min(5).max(180),
  targetLevel: z.enum(["A1", "A2", "B1", "B2", "C1"]),
  timezone: z.string().trim().min(1).max(64),
  track: z.enum(["essential", "complete", "intensive"]),
});

export async function updateProfileAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const session = await getSessionContext();
  if (!session) return { error: "Não autenticado" };

  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    dailyGoalMinutes: formData.get("dailyGoalMinutes"),
    targetLevel: formData.get("targetLevel"),
    timezone: formData.get("timezone"),
    track: formData.get("track"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      daily_goal_minutes: parsed.data.dailyGoalMinutes,
      target_level: parsed.data.targetLevel,
      timezone: parsed.data.timezone,
      preferred_track: parsed.data.track,
      onboarded_at: session.profile.onboarded_at ?? new Date().toISOString(),
    })
    .eq("id", session.userId);

  if (error) return { error: error.message };

  // A trilha vive em dois lugares: a preferência no perfil e a trilha efetiva
  // da matrícula, que é quem define os blocos do dia e a meta prometida.
  const { error: trackError } = await supabase
    .from("enrollments")
    .update({ track: parsed.data.track })
    .eq("user_id", session.userId);

  if (trackError) console.error("[perfil] falha ao mudar a trilha:", trackError.message);

  revalidatePath("/app", "layout");
  revalidatePath("/app/revisao");
  return { success: "Perfil atualizado." };
}
