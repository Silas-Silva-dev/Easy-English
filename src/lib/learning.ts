import "server-only";

import { cache } from "react";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { getTodayDateString } from "@/lib/timezones";
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
    // Se os minutos totais estão zerados mas o aluno já praticou/concluiu lições, ressincroniza automaticamente
    if (existing.minutes_total === 0) {
      try {
        const synced = await syncEnrollmentStudyStats(userId, existing.id);
        existing.minutes_total = synced.minutesTotal;
        existing.streak_current = synced.streakCurrent;
      } catch (e) {
        console.warn("[learning] Falha ao auto-sincronizar estudos:", e);
      }
    }

    // A data alvo é gravada uma vez, na matrícula. Se a duração do curso mudou
    // depois (365 -> 728, por exemplo), ela passa a apontar um prazo que não
    // existe mais: então recalculamos a partir do início real da matrícula.
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
 * Lições ainda em rascunho são puladas: o aluno nunca vê página vazia.
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

/** Evolução das notas de fala: alimenta o gráfico de progresso. */
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
 * O enum `lesson_kind` do banco foi reaproveitado: cada valor representa um
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

/** Descrição curta do que acontece em cada dia: usada em tooltips e cards. */
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
 * Sem histórico, assume o ritmo de desenho do curso: e sinaliza que assumiu,
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

  if (remainingLessons === 0) {
    return { date: new Date(), lessonsPerWeek: 7, remainingLessons: 0, assumed: false };
  }

  // Considera apenas dias que possuem atividade de estudo ou lições concluídas
  const activeDays = studyDays.filter((d) => d.lessons_done > 0 || d.minutes > 0);
  const totalLessonsInWindow = activeDays.reduce((sum, d) => sum + d.lessons_done, 0);

  let lessonsPerWeek = 7;
  let assumed = true;

  if (activeDays.length > 0 && totalLessonsInWindow > 0) {
    // Calcula o intervalo real de dias decorridos desde a primeira lição
    const timestamps = activeDays.map((d) => new Date(`${d.study_date}T12:00:00`).getTime());
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps, new Date().getTime());

    // Dias ativos no calendário do aluno (mínimo 1 dia)
    const activeSpanDays = Math.max(1, Math.ceil((maxTimestamp - minTimestamp) / (1000 * 3600 * 24)));
    const effectiveDays = Math.min(windowDays, activeSpanDays);

    // Ritmo real de lições por dia
    const ratePerDay = totalLessonsInWindow / effectiveDays;
    const effectiveRate = Math.max(0.5, ratePerDay);

    lessonsPerWeek = Math.round(effectiveRate * 7 * 10) / 10;
    assumed = false;
  }

  const daysNeeded = Math.ceil(remainingLessons / (lessonsPerWeek / 7));
  const date = new Date();
  date.setDate(date.getDate() + daysNeeded);

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

/**
 * Sincroniza e recalcula o tempo total de estudo, a meta diária e a ofensiva a partir dos registros
 * de lições concluídas, práticas de fala e conversas ao vivo do aluno.
 */
export async function syncEnrollmentStudyStats(
  userId: string,
  enrollmentId: string,
): Promise<{ minutesTotal: number; streakCurrent: number }> {
  const admin = createAdminSupabase();

  const [{ data: progressRows }, { data: liveRows }, { data: speakingRows }, { data: profile }] =
    await Promise.all([
      admin
        .from("lesson_progress")
        .select("minutes_spent, completed_at, started_at")
        .eq("enrollment_id", enrollmentId)
        .eq("status", "completed"),
      admin.from("live_sessions").select("duration_seconds, ended_at,started_at").eq("user_id", userId),
      admin.from("speaking_sessions").select("duration_seconds, created_at").eq("user_id", userId).eq("status", "completed"),
      admin.from("profiles").select("timezone, daily_goal_minutes").eq("id", userId).maybeSingle(),
    ]);

  const tz = profile?.timezone || "America/Sao_Paulo";
  const goal = profile?.daily_goal_minutes || 15;

  const dailyMap = new Map<string, { minutes: number; lessonsDone: number }>();

  function addEntry(dateIso: string | null, minutes: number, isLesson: boolean) {
    if (!dateIso) return;
    let dateKey = dateIso.slice(0, 10);
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      dateKey = formatter.format(new Date(dateIso));
    } catch {
      // fallback
    }
    const current = dailyMap.get(dateKey) ?? { minutes: 0, lessonsDone: 0 };
    current.minutes += minutes;
    if (isLesson) current.lessonsDone += 1;
    dailyMap.set(dateKey, current);
  }

  for (const p of progressRows ?? []) {
    const mins = Math.max(1, p.minutes_spent || 15);
    addEntry(p.completed_at || p.started_at, mins, true);
  }

  for (const s of liveRows ?? []) {
    const mins = Math.max(1, Math.round((s.duration_seconds ?? 60) / 60));
    addEntry(s.ended_at || s.started_at, mins, false);
  }

  for (const sp of speakingRows ?? []) {
    const mins = Math.max(1, Math.round((sp.duration_seconds ?? 60) / 60));
    addEntry(sp.created_at, mins, false);
  }

  let totalMins = 0;
  let totalLessonsDone = progressRows?.length ?? 0;

  for (const [dateKey, data] of dailyMap.entries()) {
    totalMins += data.minutes;
    const goalMet = data.minutes >= goal;

    await admin.from("study_days").upsert(
      {
        user_id: userId,
        enrollment_id: enrollmentId,
        study_date: dateKey,
        minutes: data.minutes,
        lessons_done: data.lessonsDone,
        goal_met: goalMet,
      },
      { onConflict: "enrollment_id,study_date" },
    );
  }

  // Recalcular streak
  const { data: allStudyDays } = await admin
    .from("study_days")
    .select("study_date, goal_met")
    .eq("enrollment_id", enrollmentId)
    .order("study_date", { ascending: false });

  const todayKey = getTodayDateString(tz);
  let streakCurrent = 0;
  let streakLongest = 0;

  if (allStudyDays?.length) {
    const metDates = new Set(allStudyDays.filter((d) => d.goal_met).map((d) => d.study_date));

    let currentCheck = new Date(`${todayKey}T12:00:00`);
    let dateStr = getTodayDateString(tz);

    if (!metDates.has(dateStr)) {
      currentCheck.setDate(currentCheck.getDate() - 1);
      dateStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(currentCheck);
    }

    while (metDates.has(dateStr)) {
      streakCurrent++;
      currentCheck.setDate(currentCheck.getDate() - 1);
      dateStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(currentCheck);
    }

    let run = 0;
    const sortedAll = [...allStudyDays].sort((a, b) => a.study_date.localeCompare(b.study_date));
    let lastDate: Date | null = null;

    for (const day of sortedAll) {
      if (day.goal_met) {
        const curDate = new Date(`${day.study_date}T12:00:00`);
        if (lastDate) {
          const diff = Math.round((curDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
          if (diff === 1) {
            run++;
          } else {
            run = 1;
          }
        } else {
          run = 1;
        }
        lastDate = curDate;
        if (run > streakLongest) streakLongest = run;
      } else {
        run = 0;
        lastDate = null;
      }
    }
  }

  await admin
    .from("enrollments")
    .update({
      minutes_total: totalMins,
      lessons_completed: totalLessonsDone,
      streak_current: streakCurrent,
      streak_longest: Math.max(streakLongest, streakCurrent),
    })
    .eq("id", enrollmentId);

  return { minutesTotal: totalMins, streakCurrent };
}
