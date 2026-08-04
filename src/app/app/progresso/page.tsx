import { BookOpenCheck, Clock, Flame, Mic, TrendingUp } from "lucide-react";
import type { Metadata } from "next";

import { SpeakingTrendChart, StudyMinutesChart } from "@/components/charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { StatCard } from "@/components/ui/stat-card";
import { requireActiveUser } from "@/lib/auth/guards";
import {
  getCourseStats,
  getOrCreateEnrollment,
  getPrimaryCourse,
  getRecentStudyDays,
  getSpeakingTrend,
} from "@/lib/learning";
import { formatMinutes, formatRelative } from "@/lib/utils";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Meu progresso" };

const shortDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

export default async function ProgressPage() {
  const { userId, profile } = await requireActiveUser("/app/progresso");
  const course = await getPrimaryCourse();

  if (!course) return <EmptyState title="Nenhum curso publicado" />;

  const enrollment = await getOrCreateEnrollment(userId, course);
  if (!enrollment) return <EmptyState title="Matrícula não encontrada" />;

  const [stats, studyDays, speakingTrend] = await Promise.all([
    getCourseStats(course.id, enrollment.id),
    getRecentStudyDays(enrollment.id, 30),
    getSpeakingTrend(userId, 30),
  ]);

  const supabase = await createServerSupabase();
  const { data: recentSessions } = await supabase
    .from("speaking_sessions")
    .select("id, prompt, created_at, transcript, speaking_feedback(overall_score, summary_pt)")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(5);

  const trendData = speakingTrend.map((f) => ({
    date: shortDate(f.created_at),
    geral: Number(f.overall_score),
    pronuncia: Number(f.pronunciation_score),
    fluencia: Number(f.fluency_score),
    gramatica: Number(f.grammar_score),
    vocabulario: Number(f.vocabulary_score),
  }));

  const minutesData = studyDays.map((d) => ({
    date: shortDate(d.study_date),
    minutos: d.minutes,
  }));

  const latest = speakingTrend.at(-1);
  const first = speakingTrend[0];
  const delta =
    latest && first && speakingTrend.length > 1
      ? Number(latest.overall_score) - Number(first.overall_score)
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Evolução"
        title="Meu progresso"
        description="Onde você estava, onde está e o que os números dizem sobre a sua fala."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ofensiva"
          value={`${enrollment.streak_current} dias`}
          hint={`Recorde: ${enrollment.streak_longest}`}
          icon={<Flame />}
          tone="streak"
        />
        <StatCard
          label="Lições concluídas"
          value={stats.completedLessons}
          hint={`de ${stats.publishedLessons}`}
          icon={<BookOpenCheck />}
          tone="success"
        />
        <StatCard
          label="Tempo de estudo"
          value={formatMinutes(enrollment.minutes_total)}
          hint={`meta diária: ${profile.daily_goal_minutes} min`}
          icon={<Clock />}
        />
        <StatCard
          label="Nota de fala"
          value={latest ? Number(latest.overall_score).toFixed(1) : ": "}
          hint={
            delta != null
              ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} desde a primeira prática`
              : "grave sua primeira prática"
          }
          icon={<Mic />}
          tone={delta != null && delta >= 0 ? "success" : "neutral"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="size-4" /> Evolução das notas de fala
            </CardTitle>
            <CardDescription>Cada ponto é uma gravação corrigida pela tutora.</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length > 1 ? (
              <SpeakingTrendChart data={trendData} />
            ) : (
              <EmptyState
                icon={<Mic />}
                title="Poucas práticas ainda"
                description="Grave pelo menos duas práticas de fala para ver a evolução em gráfico."
                className="border-0"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="size-4" /> Minutos por dia
            </CardTitle>
            <CardDescription>Últimos 30 dias de estudo.</CardDescription>
          </CardHeader>
          <CardContent>
            {minutesData.length ? (
              <StudyMinutesChart data={minutesData} goal={profile.daily_goal_minutes} />
            ) : (
              <EmptyState
                icon={<Clock />}
                title="Sem registros ainda"
                description="Conclua sua primeira lição para começar a contar."
                className="border-0"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {recentSessions?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Últimas correções da tutora</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSessions.map((session) => {
              const feedback = Array.isArray(session.speaking_feedback)
                ? session.speaking_feedback[0]
                : session.speaking_feedback;
              return (
                <div key={session.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground text-xs">
                        {formatRelative(session.created_at)}
                      </p>
                      <p className="mt-1 line-clamp-1 text-sm font-medium">{session.prompt}</p>
                    </div>
                    {feedback?.overall_score != null ? (
                      <Badge
                        variant={
                          feedback.overall_score >= 8
                            ? "success"
                            : feedback.overall_score >= 6
                              ? "warning"
                              : "destructive"
                        }
                      >
                        {Number(feedback.overall_score).toFixed(1)}
                      </Badge>
                    ) : null}
                  </div>

                  {session.transcript ? (
                    <p className="bg-muted/50 mt-3 rounded px-3 py-2 text-sm italic">
                      “{session.transcript}”
                    </p>
                  ) : null}

                  {feedback?.summary_pt ? (
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                      {feedback.summary_pt}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
