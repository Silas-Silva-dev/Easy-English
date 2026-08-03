import "server-only";

import { cache } from "react";

import { createServerSupabase } from "@/lib/supabase/server";
import type {
  Course,
  Enrollment,
  Lesson,
  LessonProgress,
  StudyDay,
  StudyTrack,
} from "@/lib/types/database";
import { DAY_BLOCKS, TRACK_BY_ID, TRACKS, type TrackSpec } from "@content/curriculum";

export const DEFAULT_COURSE_SLUG = "ingles-para-conversacao";

/** Curso principal publicado. */
export const getPrimaryCourse = cache(async (): Promise<Course | null> => {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", DEFAULT_COURSE_SLUG)
    .eq("is_published", true)
    .maybeSingle();
  return data;
});

/**
 * Matrícula do aluno no curso, criando-a se ainda não existir.
 * A data alvo de conclusão nasce como hoje + duração do curso.
 */
export async function getOrCreateEnrollment(
  userId: string,
  course: Course,
): Promise<Enrollment | null> {
  const supabase = await createServerSupabase();

  const { data: existing } = await supabase
    .from("enrollments")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .maybeSingle();

  if (existing) {
    // A data alvo é gravada uma vez, na matrícula. Se a duração do curso mudou
    // depois (365 -> 728, por exemplo), ela passa a apontar um prazo que não
    // existe mais — então recalculamos a partir do início real da matrícula.
    const expected = new Date(existing.started_at);
    expected.setDate(expected.getDate() + course.duration_days);
    const expectedKey = expected.toISOString().slice(0, 10);

    if (existing.target_end_date !== expectedKey) {
      const { data: refreshed } = await supabase
        .from("enrollments")
        .update({ target_end_date: expectedKey })
        .eq("id", existing.id)
        .select()
        .single();
      return refreshed ?? { ...existing, target_end_date: expectedKey };
    }

    return existing;
  }

  const target = new Date();
  target.setDate(target.getDate() + course.duration_days);

  const { data: created, error } = await supabase
    .from("enrollments")
    .insert({
      user_id: userId,
      course_id: course.id,
      status: "active",
      current_day: 1,
      target_end_date: target.toISOString().slice(0, 10),
    })
    .select()
    .single();

  if (error) {
    console.error("[learning] falha ao criar matrícula:", error.message);
    return null;
  }

  return created;
}

/** Lição de um dia específico do cronograma. */
export async function getLessonByDay(courseId: string, day: number): Promise<Lesson | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .eq("day_number", day)
    .maybeSingle();
  return data;
}

/**
 * Próxima lição publicada a partir do dia atual da matrícula.
 * Lições ainda em rascunho são puladas — o aluno nunca vê página vazia.
 */
export async function getNextLesson(courseId: string, fromDay: number): Promise<Lesson | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .eq("is_published", true)
    .gte("day_number", fromDay)
    .order("day_number")
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getLessonProgress(
  enrollmentId: string,
  lessonIds: string[],
): Promise<Map<string, LessonProgress>> {
  if (!lessonIds.length) return new Map();

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("lesson_progress")
    .select("*")
    .eq("enrollment_id", enrollmentId)
    .in("lesson_id", lessonIds);

  return new Map((data ?? []).map((p) => [p.lesson_id, p]));
}

/** Últimos N dias de estudo, para o heatmap e o gráfico de consistência. */
export async function getRecentStudyDays(
  enrollmentId: string,
  days = 84,
): Promise<StudyDay[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("study_days")
    .select("*")
    .eq("enrollment_id", enrollmentId)
    .gte("study_date", since.toISOString().slice(0, 10))
    .order("study_date");

  return data ?? [];
}

export interface CourseStats {
  publishedLessons: number;
  completedLessons: number;
}

export async function getCourseStats(
  courseId: string,
  enrollmentId: string,
): Promise<CourseStats> {
  const supabase = await createServerSupabase();

  const [{ count: published }, { count: completed }] = await Promise.all([
    supabase
      .from("lessons")
      .select("*", { count: "exact", head: true })
      .eq("course_id", courseId)
      .eq("is_published", true),
    supabase
      .from("lesson_progress")
      .select("*", { count: "exact", head: true })
      .eq("enrollment_id", enrollmentId)
      .eq("status", "completed"),
  ]);

  return { publishedLessons: published ?? 0, completedLessons: completed ?? 0 };
}

/** Evolução das notas de fala — alimenta o gráfico de progresso. */
export async function getSpeakingTrend(userId: string, limit = 30) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("speaking_feedback")
    .select(
      "created_at, overall_score, pronunciation_score, fluency_score, grammar_score, vocabulary_score",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).reverse();
}

/**
 * Os 7 papéis do dia dentro de um circuito.
 *
 * O enum `lesson_kind` do banco foi reaproveitado — cada valor representa um
 * dia do ritmo semanal, não um "tipo de aula gramatical". Ver a migration
 * 20260101000300_method.sql e content/curriculum.ts (DAY_RHYTHM).
 */
export const LESSON_KIND_LABEL: Record<Lesson["kind"], string> = {
  listening: "Imersão",
  vocabulary: "Blocos na boca",
  grammar: "Troca de peças",
  dialogue: "Escuta ativa",
  speaking: "Sua vez",
  review: "Revisão espaçada",
  assessment: "Missão real",
};

/** Descrição curta do que acontece em cada dia — usada em tooltips e cards. */
export const LESSON_KIND_BRIEF: Record<Lesson["kind"], string> = {
  listening: "Áudio primeiro, sem texto",
  vocabulary: "Os blocos prontos do circuito",
  grammar: "O mesmo molde com peças diferentes",
  dialogue: "Diálogo novo em velocidade real",
  speaking: "Gravação corrigida pela tutora",
  review: "Puxar da memória o que já passou",
  assessment: "Usar de verdade, fora do app",
};

/** Trilha do aluno, com a promessa e o limite honesto que a acompanham. */
export function getTrack(id: StudyTrack): TrackSpec {
  return TRACK_BY_ID.get(id) ?? TRACKS[1];
}

/** Blocos do dia liberados pela trilha, com os minutos de cada um. */
export function dayBlocksFor(track: StudyTrack) {
  return getTrack(track).blocks.map((id) => ({ id, ...DAY_BLOCKS[id] }));
}

export interface CompletionForecast {
  /** Data projetada. `null` quando não há ritmo suficiente para projetar. */
  date: Date | null;
  lessonsPerWeek: number;
  remainingLessons: number;
  /** `true` quando o ritmo foi assumido por falta de histórico. */
  assumed: boolean;
}

/**
 * Projeta a conclusão a partir do RITMO REAL do aluno.
 *
 * `enrollments.target_end_date` é congelada no dia da matrícula e mente por
 * dois motivos: não acompanha mudança na duração do curso (uma matrícula feita
 * quando o curso tinha 365 dias continua apontando 365) e ignora se o aluno faz
 * uma lição por dia ou uma por semana.
 *
 * Aqui a projeção sai das lições efetivamente concluídas na janela recente.
 * Sem histórico, assume o ritmo de desenho do curso — e sinaliza que assumiu,
 * porque projeção apresentada como certeza é o tipo de número que faz o aluno
 * desistir quando a realidade não bate.
 */
export function forecastCompletion({
  currentDay,
  totalDays,
  studyDays,
  windowDays = 28,
}: {
  currentDay: number;
  totalDays: number;
  studyDays: StudyDay[];
  windowDays?: number;
}): CompletionForecast {
  const remainingLessons = Math.max(0, totalDays - (currentDay - 1));

  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceKey = since.toISOString().slice(0, 10);

  const lessonsDone = studyDays
    .filter((d) => d.study_date >= sinceKey)
    .reduce((sum, d) => sum + d.lessons_done, 0);

  // Menos de 3 lições na janela não é ritmo, é ruído: uma única lição em 28
  // dias projetaria 56 anos de curso.
  const assumed = lessonsDone < 3;
  const lessonsPerWeek = assumed ? 7 : (lessonsDone / windowDays) * 7;

  if (remainingLessons === 0) {
    return { date: new Date(), lessonsPerWeek, remainingLessons: 0, assumed };
  }
  if (lessonsPerWeek <= 0) {
    return { date: null, lessonsPerWeek: 0, remainingLessons, assumed };
  }

  const date = new Date();
  date.setDate(date.getDate() + Math.ceil((remainingLessons / lessonsPerWeek) * 7));
  return { date, lessonsPerWeek, remainingLessons, assumed };
}

export const DAY_ORDER: Lesson["kind"][] = [
  "listening",
  "vocabulary",
  "grammar",
  "dialogue",
  "speaking",
  "review",
  "assessment",
];
