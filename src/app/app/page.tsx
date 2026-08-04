import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Brain,
  CalendarClock,
  CheckCircle2,
  Clock,
  Flame,
  Globe,
  Layers,
  Mic,
  Radio,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  Volume2,
  Zap,
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
import { createServerSupabase } from "@/lib/supabase/server";
import { formatMinutes, pct } from "@/lib/utils";
import { CANTOS, type CantoSpec } from "@content/curriculum";

export const metadata: Metadata = { title: "Meu Painel" };

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

  const supabase = await createServerSupabase();

  const [lesson, stats, studyDays, { data: lessonProgress }] = await Promise.all([
    getNextLesson(course.id, enrollment.current_day),
    getCourseStats(course.id, enrollment.id),
    getRecentStudyDays(enrollment.id, 28),
    supabase
      .from("lesson_progress")
      .select("lesson_id, status")
      .eq("enrollment_id", enrollment.id)
      .eq("status", "completed"),
  ]);

  const completedLessonIds = new Set((lessonProgress ?? []).map((p) => p.lesson_id));

  // Cálculo de progresso por Canto
  const { data: allLessons } = await supabase
    .from("lessons")
    .select("id, week_number")
    .eq("course_id", course.id);

  const cantoProgress: Record<string, { done: number; total: number; pct: number }> = {};
  for (const c of CANTOS) {
    const cantoLessons = (allLessons ?? []).filter(
      (l) => l.week_number >= c.weekStart && l.week_number <= c.weekEnd,
    );
    const done = cantoLessons.filter((l) => completedLessonIds.has(l.id)).length;
    const total = cantoLessons.length || 1;
    cantoProgress[c.code] = { done, total, pct: pct(done, total) };
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayRecord = studyDays.find((d) => d.study_date === today);
  const minutesToday = todayRecord?.minutes ?? 0;
  const goal = profile.daily_goal_minutes;
  const goalPct = pct(minutesToday, goal);

  const coursePct = pct(stats.completedLessons, stats.publishedLessons || course.duration_days);
  const firstName = profile.full_name?.split(" ")[0] ?? "Aluno";

  // Identificação do Canto atual da lição
  const currentWeek = lesson?.week_number ?? Math.ceil(enrollment.current_day / 14);
  const currentCantoSpec = CANTOS.find((c) => currentWeek >= c.weekStart && currentWeek <= c.weekEnd) ?? CANTOS[0];

  const forecast = forecastCompletion({
    currentDay: enrollment.current_day,
    totalDays: course.duration_days,
    studyDays,
  });

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8">
      {/* -------------------------------------------------------- Cabeçalho */}
      <header className="flex flex-col gap-2 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-primary/15 text-primary font-mono text-xs font-bold px-2.5 py-0.5 rounded-md">
              {currentCantoSpec.code}
            </span>
            <span className="text-muted-foreground text-xs font-medium">
              {currentCantoSpec.title} · Dia {enrollment.current_day} de {course.duration_days}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Olá, {firstName}! 👋
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {minutesToday >= goal
              ? "🎉 Parabéns! Sua meta diária de estudo foi batida hoje."
              : `Faltam ${goal - minutesToday} minutos de prática para concluir sua meta de hoje.`}
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2 sm:pt-0">
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/canto/${currentCantoSpec.code.toLowerCase()}`}>
              <Layers className="size-4" /> Ver circuito atual
            </Link>
          </Button>
          <Button asChild variant="gradient" size="sm">
            <Link href={lesson ? `/app/licao/${lesson.day_number}` : "/app/cronograma"}>
              Continuar estudo <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* ------------------------------------------------- Destaque Próxima Lição + Meta */}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        {lesson ? (
          <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm overflow-hidden flex flex-col justify-between">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary/15 text-primary border-primary/25">
                  Dia {lesson.day_number}
                </Badge>
                <Badge variant="neutral">{LESSON_KIND_LABEL[lesson.kind]}</Badge>
                <Badge variant="neutral">{lesson.level}</Badge>
                <Badge variant="neutral">
                  <Clock className="size-3" /> {lesson.estimated_minutes} min
                </Badge>
                <Badge variant="neutral">
                  Circuito {lesson.week_number} · Dia {lesson.circuit_day} de 14
                </Badge>
              </div>

              <div>
                <CardTitle className="text-xl font-bold leading-snug sm:text-2xl">
                  {lesson.title}
                </CardTitle>
                {lesson.objective ? (
                  <CardDescription className="text-foreground/80 mt-2 text-sm leading-relaxed">
                    {lesson.objective}
                  </CardDescription>
                ) : null}
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-0">
              {lesson.grammar_focus ? (
                <div className="bg-muted/60 border-border/80 rounded-xl border p-3.5">
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                    Foco prático desta lição
                  </p>
                  <p className="mt-1 text-sm font-medium">{lesson.grammar_focus}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button asChild size="lg" variant="gradient" className="shadow-md shadow-primary/20">
                  <Link href={`/app/licao/${lesson.day_number}`}>
                    Iniciar lição do dia <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/app/conversacao">
                    <Mic className="size-4" /> Treinar fala com Emma (IA)
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={<Sparkles />}
            title="Você concluiu todos os 728 dias!"
            description="Parabéns! Sua jornada completa foi finalizada. Mantenha seu hábito praticando conversa ao vivo e revisando seus blocos."
            action={
              <Button asChild variant="outline">
                <Link href="/app/cronograma">Ver cronograma completo</Link>
              </Button>
            }
          />
        )}

        {/* --------------------------------------------- Meta Diária */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-bold">
              <span>Meta Diária</span>
              <Target className="text-primary size-4" />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <ProgressRing value={goalPct} size={135} strokeWidth={10}>
              <span className="text-2xl font-bold tabular-nums">{minutesToday}</span>
              <span className="text-muted-foreground text-xs font-medium">de {goal} min</span>
            </ProgressRing>

            {minutesToday >= goal ? (
              <div className="bg-success/10 text-success border-success/20 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold">
                <CheckCircle2 className="size-4" /> Meta concluída hoje!
              </div>
            ) : (
              <p className="text-muted-foreground text-xs leading-relaxed max-w-[220px]">
                Quinze minutos por dia constroem memórias definitivas de fala.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------- Atalhos Rápidos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href={`/app/canto/${currentCantoSpec.code.toLowerCase()}`}
          className="group bg-card card-hover flex flex-col justify-between rounded-xl border p-4"
        >
          <div className="flex items-center justify-between">
            <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-lg">
              <Layers className="size-4.5" />
            </span>
            <Badge variant="neutral" className="text-[10px]">
              {cantoProgress[currentCantoSpec.code]?.pct ?? 0}%
            </Badge>
          </div>
          <div className="mt-4">
            <h3 className="font-bold text-sm group-hover:text-primary transition-colors">
              {currentCantoSpec.title}
            </h3>
            <p className="text-muted-foreground text-xs mt-0.5">Acessar os circuitos e lições</p>
          </div>
        </Link>

        <Link
          href="/app/conversacao"
          className="group bg-card card-hover flex flex-col justify-between rounded-xl border p-4"
        >
          <div className="flex items-center justify-between">
            <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-lg">
              <Mic className="size-4.5" />
            </span>
            <Badge variant="neutral" className="text-[10px]">IA Voz</Badge>
          </div>
          <div className="mt-4">
            <h3 className="font-bold text-sm group-hover:text-primary transition-colors">
              Praticar Fala
            </h3>
            <p className="text-muted-foreground text-xs mt-0.5">Grave e receba correções com IPA</p>
          </div>
        </Link>

        <Link
          href="/app/ao-vivo"
          className="group bg-card card-hover flex flex-col justify-between rounded-xl border p-4"
        >
          <div className="flex items-center justify-between">
            <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-lg">
              <Radio className="size-4.5" />
            </span>
            <Badge variant="neutral" className="text-[10px]">Ao Vivo</Badge>
          </div>
          <div className="mt-4">
            <h3 className="font-bold text-sm group-hover:text-primary transition-colors">
              Conversa ao Vivo
            </h3>
            <p className="text-muted-foreground text-xs mt-0.5">Sala de áudio em tempo real com Emma</p>
          </div>
        </Link>

        <Link
          href="/app/revisao"
          className="group bg-card card-hover flex flex-col justify-between rounded-xl border p-4"
        >
          <div className="flex items-center justify-between">
            <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-lg">
              <RotateCcw className="size-4.5" />
            </span>
            <Badge variant="neutral" className="text-[10px]">SRS</Badge>
          </div>
          <div className="mt-4">
            <h3 className="font-bold text-sm group-hover:text-primary transition-colors">
              Revisão Espaçada
            </h3>
            <p className="text-muted-foreground text-xs mt-0.5">Fixe os blocos na memória</p>
          </div>
        </Link>
      </div>

      {/* ---------------------------------------------------------- Métricas de Desempenho */}
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
          hint={`de ${stats.publishedLessons} lições disponíveis`}
          icon={<BookOpenCheck />}
          tone="success"
        />
        <StatCard
          label="Tempo total praticado"
          value={formatMinutes(enrollment.minutes_total)}
          hint="dedicados à fluência"
          icon={<Clock />}
        />
        <StatCard
          label="Previsão de conclusão"
          value={
            forecast.date
              ? forecast.date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
              : "Em dia"
          }
          hint={
            forecast.assumed
              ? `Faltam ${forecast.remainingLessons} lições.`
              : `Faltam ${forecast.remainingLessons} lições no seu ritmo.`
          }
          icon={<CalendarClock />}
          tone="neutral"
        />
      </div>

      {/* -------------------------------------------------- Progresso por Canto & Consistência */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Progresso Geral + Histórico dos 4 Cantos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <Target className="text-primary size-4" /> Progresso nos 4 Cantos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-end justify-between border-b pb-4">
              <div>
                <span className="text-3xl font-bold tabular-nums">{coursePct}%</span>
                <p className="text-muted-foreground text-xs mt-0.5">Progresso total no curso</p>
              </div>
              <span className="text-muted-foreground text-xs font-medium tabular-nums">
                {stats.completedLessons} / {stats.publishedLessons || course.duration_days} lições
              </span>
            </div>

            <div className="space-y-3.5 pt-1">
              {CANTOS.map((canto) => {
                const info = cantoProgress[canto.code] ?? { done: 0, total: 1, pct: 0 };
                return (
                  <div key={canto.code} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="bg-primary/10 text-primary font-mono text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {canto.code}
                        </span>
                        <span>{canto.title}</span>
                      </div>
                      <span className="text-muted-foreground tabular-nums">
                        {info.done}/{info.total} ({info.pct}%)
                      </span>
                    </div>
                    <Progress value={info.pct} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Consistência dos últimos 28 dias */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <Flame className="text-streak size-4" /> Consistência de Estudo (Últimas 4 Semanas)
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Cada quadrado representa 1 dia. Praticar diariamente cria a retenção permanente do vocabulário.
            </p>

            <div className="flex flex-wrap gap-2 pt-2 justify-center sm:justify-start">
              {Array.from({ length: 28 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (27 - i));
                const key = date.toISOString().slice(0, 10);
                const record = studyDays.find((d) => d.study_date === key);
                return (
                  <div
                    key={key}
                    title={`${new Date(`${key}T12:00:00`).toLocaleDateString("pt-BR")}: ${record?.minutes ?? 0} min`}
                    className={
                      record?.goal_met
                        ? "bg-success size-6 rounded-md shadow-xs"
                        : record?.minutes
                          ? "bg-success/40 size-6 rounded-md"
                          : "bg-muted size-6 rounded-md"
                    }
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-4 border-t">
              <span className="flex items-center gap-1.5">
                <span className="bg-success size-3 rounded-sm" /> Meta batida
              </span>
              <span className="flex items-center gap-1.5">
                <span className="bg-success/40 size-3 rounded-sm" /> Parcial
              </span>
              <span className="flex items-center gap-1.5">
                <span className="bg-muted size-3 rounded-sm" /> Sem treino
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
