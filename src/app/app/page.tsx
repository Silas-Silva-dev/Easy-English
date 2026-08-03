import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  Flame,
  Mic,
  Sparkles,
  Target,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Progress, ProgressRing } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { requireActiveUser } from "@/lib/auth/guards";
import {
  forecastCompletion,
  getCourseStats,
  getNextLesson,
  getOrCreateEnrollment,
  getPrimaryCourse,
  getRecentStudyDays,
  LESSON_KIND_LABEL,
} from "@/lib/learning";
import { formatMinutes, pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Meu dia" };

export default async function StudentDashboard() {
  const { userId, profile } = await requireActiveUser("/app");
  const course = await getPrimaryCourse();

  if (!course) {
    return (
      <EmptyState
        icon={<BookOpenCheck />}
        title="Nenhum curso publicado ainda"
        description="O conteúdo está sendo preparado. Assim que o primeiro curso for publicado, ele aparece aqui."
      />
    );
  }

  const enrollment = await getOrCreateEnrollment(userId, course);
  if (!enrollment) {
    return (
      <EmptyState
        icon={<BookOpenCheck />}
        title="Não foi possível abrir sua matrícula"
        description="Tente recarregar a página. Se o problema persistir, fale com o suporte."
      />
    );
  }

  const [lesson, stats, studyDays] = await Promise.all([
    getNextLesson(course.id, enrollment.current_day),
    getCourseStats(course.id, enrollment.id),
    getRecentStudyDays(enrollment.id, 28),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const todayRecord = studyDays.find((d) => d.study_date === today);
  const minutesToday = todayRecord?.minutes ?? 0;
  const goal = profile.daily_goal_minutes;
  const goalPct = pct(minutesToday, goal);

  const coursePct = pct(stats.completedLessons, stats.publishedLessons || course.duration_days);
  const firstName = profile.full_name?.split(" ")[0] ?? "por aí";

  const forecast = forecastCompletion({
    currentDay: enrollment.current_day,
    totalDays: course.duration_days,
    studyDays,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* -------------------------------------------------------- Saudação */}
      <header className="flex flex-col gap-1">
        <p className="text-primary text-xs font-semibold tracking-widest uppercase">
          Dia {enrollment.current_day} de {course.duration_days}
        </p>
        <h1 className="text-2xl font-semibold sm:text-3xl">Olá, {firstName} 👋</h1>
        <p className="text-muted-foreground text-sm">
          {minutesToday >= goal
            ? "Meta de hoje batida. Tudo o que vier agora é lucro."
            : `Faltam ${goal - minutesToday} minutos para bater a meta de hoje.`}
        </p>
      </header>

      {/* ------------------------------------------------- Lição do dia */}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {lesson ? (
          <Card className="from-primary/8 card-hover overflow-hidden bg-gradient-to-br to-transparent">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{LESSON_KIND_LABEL[lesson.kind]}</Badge>
                <Badge variant="neutral">{lesson.level}</Badge>
                <Badge variant="neutral">
                  <Clock className="size-3" /> {lesson.estimated_minutes} min
                </Badge>
                <Badge variant="neutral">
                  Circuito {lesson.week_number} · dia {lesson.circuit_day} de 14
                </Badge>
              </div>

              <CardTitle className="mt-3 text-xl leading-snug sm:text-2xl">{lesson.title}</CardTitle>
              {lesson.objective ? (
                <CardDescription className="text-[0.925rem] leading-relaxed">
                  {lesson.objective}
                </CardDescription>
              ) : null}
            </CardHeader>

            <CardContent className="space-y-5">
              {lesson.grammar_focus ? (
                <div className="bg-card/70 rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Foco desta lição
                  </p>
                  <p className="mt-1.5 text-sm font-medium">{lesson.grammar_focus}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" variant="gradient">
                  <Link href={`/app/licao/${lesson.day_number}`}>
                    Começar a lição <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/app/conversacao">
                    <Mic className="size-4" /> Praticar fala
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={<Sparkles />}
            title="Você chegou ao fim do cronograma"
            description="Os 728 dias foram concluídos. Daqui em diante o inglês cresce pelo uso: converse ao vivo, mantenha a fila de revisão em dia e consuma material real."
            action={
              <Button asChild variant="outline">
                <Link href="/app/cronograma">Ver o cronograma</Link>
              </Button>
            }
          />
        )}

        {/* --------------------------------------------- Meta diária */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Meta de hoje</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <ProgressRing value={goalPct} size={132} strokeWidth={10}>
              <span className="text-2xl font-semibold tabular-nums">{minutesToday}</span>
              <span className="text-muted-foreground text-xs">de {goal} min</span>
            </ProgressRing>

            {minutesToday >= goal ? (
              <p className="text-success flex items-center gap-1.5 text-sm font-medium">
                <CheckCircle2 className="size-4" /> Meta concluída
              </p>
            ) : (
              <p className="text-muted-foreground text-center text-xs">
                Todo dia, no seu ritmo. Constância vence intensidade — e é ela que constrói fluência.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---------------------------------------------------------- Métricas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ofensiva atual"
          value={`${enrollment.streak_current} dias`}
          hint={`Recorde: ${enrollment.streak_longest} dias`}
          icon={<Flame />}
          tone="streak"
        />
        <StatCard
          label="Lições concluídas"
          value={stats.completedLessons}
          hint={`de ${stats.publishedLessons} disponíveis`}
          icon={<BookOpenCheck />}
          tone="success"
        />
        <StatCard
          label="Tempo total"
          value={formatMinutes(enrollment.minutes_total)}
          hint="desde o início do curso"
          icon={<Clock />}
        />
        <StatCard
          label="Conclusão prevista"
          value={
            forecast.date
              ? forecast.date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
              : "—"
          }
          hint={
            forecast.assumed
              ? `Faltam ${forecast.remainingLessons} lições. Estimativa a 1 por dia — conclua algumas e ela passa a usar o seu ritmo.`
              : `Faltam ${forecast.remainingLessons} lições, no seu ritmo de ${forecast.lessonsPerWeek.toFixed(1)} por semana.`
          }
          icon={<CalendarClock />}
          tone="neutral"
        />
      </div>

      {/* ------------------------------------------------------ Progresso */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="size-4" /> Progresso no curso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between">
            <span className="text-3xl font-semibold tabular-nums">{coursePct}%</span>
            <span className="text-muted-foreground text-sm">
              {stats.completedLessons} / {stats.publishedLessons || course.duration_days} lições
            </span>
          </div>
          <Progress value={coursePct} className="h-2.5" />

          {/* Consistência das últimas 4 semanas */}
          <div className="pt-2">
            <p className="text-muted-foreground mb-2.5 text-xs font-medium tracking-wide uppercase">
              Últimas 4 semanas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 28 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (27 - i));
                const key = date.toISOString().slice(0, 10);
                const record = studyDays.find((d) => d.study_date === key);
                return (
                  <div
                    key={key}
                    title={`${new Date(`${key}T12:00:00`).toLocaleDateString("pt-BR")} — ${record?.minutes ?? 0} min`}
                    className={
                      record?.goal_met
                        ? "bg-success size-5 rounded-[5px]"
                        : record?.minutes
                          ? "bg-success/40 size-5 rounded-[5px]"
                          : "bg-muted size-5 rounded-[5px]"
                    }
                  />
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
