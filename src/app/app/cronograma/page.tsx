import { CheckCircle2, ChevronRight, Circle, Clock, Lock, PlayCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CircuitAccordionItem } from "@/components/cronograma/circuit-accordion-item";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { requireActiveUser } from "@/lib/auth/guards";
import { getOrCreateEnrollment, getPrimaryCourse, LESSON_KIND_LABEL } from "@/lib/learning";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn, pct } from "@/lib/utils";
import { DAYS_PER_CIRCUIT, TOTAL_DAYS } from "@content/curriculum";

export const metadata: Metadata = { title: "Cronograma" };

/** Cor de acento por Canto: dá identidade visual a cada fase do curso. */
const CANTO_ACCENT: Record<string, { ring: string; chip: string; bar: string }> = {
  C1: { ring: "border-primary/60 bg-primary/8", chip: "bg-primary/15 text-primary", bar: "bg-primary" },
  C2: { ring: "border-chart-2/60 bg-chart-2/8", chip: "bg-chart-2/15 text-chart-2", bar: "bg-chart-2" },
  C3: { ring: "border-streak/60 bg-streak/8", chip: "bg-streak/15 text-streak", bar: "bg-streak" },
  C4: { ring: "border-success/60 bg-success/8", chip: "bg-success/15 text-success", bar: "bg-success" },
};

const FALLBACK_ACCENT = CANTO_ACCENT.C1;

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ modulo?: string; circuito?: string }>;
}) {
  const { modulo, circuito } = await searchParams;
  const { userId } = await requireActiveUser("/app/cronograma");

  const course = await getPrimaryCourse();
  if (!course) {
    return <EmptyState title="Nenhum curso publicado" description="Volte em breve." />;
  }

  const enrollment = await getOrCreateEnrollment(userId, course);
  const supabase = await createServerSupabase();

  // `week_start`/`week_end` guardam a faixa de CIRCUITOS do canto (1..52),
  // não semanas de calendário: o cronograma é solto do calendário.
  const currentDay = enrollment?.current_day ?? 1;
  const currentCircuit = Math.ceil(currentDay / DAYS_PER_CIRCUIT);

  const [{ data: modules }, { data: allLessons }, { data: completedRows }] = await Promise.all([
    supabase.from("modules").select("*").eq("course_id", course.id).order("position"),
    // Só (id, module_id): é o suficiente para o progresso dos 4 cantos e cabe
    // folgado no limite de linhas do PostgREST.
    supabase.from("lessons").select("id, module_id").eq("course_id", course.id),
    enrollment
      ? supabase
          .from("lesson_progress")
          .select("lesson_id")
          .eq("enrollment_id", enrollment.id)
          .eq("status", "completed")
      : Promise.resolve({ data: [] as { lesson_id: string }[] }),
  ]);

  const moduleList = modules ?? [];
  const completedIds = new Set((completedRows ?? []).map((r) => r.lesson_id));

  // Progresso por canto, calculado em memória: evita 8 queries de contagem.
  const perModule = new Map<string, { total: number; done: number }>();
  for (const lesson of allLessons ?? []) {
    const bucket = perModule.get(lesson.module_id) ?? { total: 0, done: 0 };
    bucket.total++;
    if (completedIds.has(lesson.id)) bucket.done++;
    perModule.set(lesson.module_id, bucket);
  }

  const activeModule =
    moduleList.find((m) => m.id === modulo) ??
    moduleList.find((m) => currentCircuit >= m.week_start && currentCircuit <= m.week_end) ??
    moduleList[0];

  const [{ data: lessons }, { data: circuits }] = await Promise.all([
    activeModule
      ? supabase.from("lessons").select("*").eq("module_id", activeModule.id).order("day_number")
      : Promise.resolve({ data: [] }),
    activeModule
      ? supabase
          .from("circuits")
          .select("number, title")
          .eq("module_id", activeModule.id)
          .order("number")
      : Promise.resolve({ data: [] as { number: number; title: string }[] }),
  ]);

  const lessonList = lessons ?? [];
  const circuitName = new Map((circuits ?? []).map((c) => [c.number, c.title]));

  // Agrupa por circuito. Cada circuito são 14 dias: 7 de aquisição, 7 de
  // consolidação. Não existe agrupamento por semana de calendário.
  const byCircuit = new Map<number, typeof lessonList>();
  for (const lesson of lessonList) {
    const list = byCircuit.get(lesson.week_number) ?? [];
    list.push(lesson);
    byCircuit.set(lesson.week_number, list);
  }

  // Qual circuito abre expandido: o pedido na URL, senão o circuito atual do
  // aluno, senão o primeiro do canto. Só um por vez fica aberto.
  const requested = Number(circuito);
  const openCircuit =
    byCircuit.has(requested) ? requested
    : byCircuit.has(currentCircuit) ? currentCircuit
    : [...byCircuit.keys()][0];

  const moduleStats = activeModule ? perModule.get(activeModule.id) : undefined;
  const activeShortTitle = activeModule
    ? activeModule.title.split(/[\u2014\u2013-]/).pop()?.trim() ?? activeModule.title
    : "";
  const activeCantoTitle = activeModule
    ? `Canto ${activeModule.code.replace("C", "")}: ${activeShortTitle}`
    : "Cronograma de Aulas";
  const activeDonePct = activeModule && moduleStats ? pct(moduleStats.done, moduleStats.total) : 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      {activeModule ? (
        <>
          {/* ------------------------------------------ Resumo do canto ativo */}
          <div className="bg-card shadow-xs rounded-2xl border p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-2.5">
                <span className="bg-primary/15 text-primary font-mono text-xs font-bold px-2.5 py-1 rounded-lg">
                  {activeModule.code}
                </span>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{activeCantoTitle}</h1>
                <Badge variant="neutral" className="text-xs font-medium">
                  {activeModule.level}
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-xs font-medium tabular-nums">
                  Circuitos {activeModule.week_start}: {activeModule.week_end} · {moduleStats?.done ?? 0} de {moduleStats?.total ?? 0} lições ({activeDonePct}%)
                </span>
                <Progress
                  value={activeDonePct}
                  className="hidden h-2 w-28 sm:block"
                  indicatorClassName="bg-primary"
                />
              </div>
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed">
              {activeModule.description}
            </p>

            {activeModule.can_do.length ? (
              <div className="pt-2 space-y-2.5">
                <p className="text-muted-foreground max-sm:text-xs text-[11px] font-semibold tracking-wider uppercase">
                  Ao final deste canto você consegue
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeModule.can_do.map((item) => (
                    <div
                      key={item}
                      className="bg-muted/60 text-foreground border-border/80 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium"
                    >
                      <CheckCircle2 className="text-success size-3.5 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* -------------------------------- Circuitos (só um aberto por vez) */}
          <div className="space-y-2.5">
            {[...byCircuit.entries()].map(([circuit, circuitLessons]) => {
              const firstDay = (circuit - 1) * DAYS_PER_CIRCUIT + 1;
              const lastDay = circuit * DAYS_PER_CIRCUIT;
              const done = circuitLessons.filter((l) => completedIds.has(l.id)).length;
              const isCurrent = circuit === currentCircuit;
              const isOpen = circuit === openCircuit;

              return (
                <CircuitAccordionItem
                  key={circuit}
                  circuit={circuit}
                  isOpen={isOpen}
                  isCurrent={isCurrent}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-open:rotate-90" />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="text-sm font-semibold">Circuito {circuit}</span>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          Dias {firstDay} a {lastDay}
                        </span>
                        {isCurrent ? <Badge variant="success">Atual</Badge> : null}
                        {done === circuitLessons.length && circuitLessons.length > 0 ? (
                          <Badge variant="neutral">Concluído</Badge>
                        ) : null}
                      </div>
                      {circuitName.get(circuit) ? (
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                          {circuitName.get(circuit)}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {done}/{circuitLessons.length}
                      </span>
                      <Progress
                        value={pct(done, circuitLessons.length)}
                        className="hidden h-1.5 w-20 sm:block"
                        indicatorClassName="bg-success"
                      />
                    </div>
                  </summary>

                  <div className="space-y-4 border-t p-4">
                    {(["A", "B"] as const).map((phase) => {
                      const phaseLessons = circuitLessons.filter((l) => l.phase === phase);
                      if (!phaseLessons.length) return null;

                      return (
                        <div key={phase}>
                          <p className="text-muted-foreground mb-2 max-sm:text-xs text-[10px] font-bold tracking-wider uppercase">
                            {phase === "A"
                              ? `Aquisição · dias ${firstDay} a ${firstDay + 6}`
                              : `Consolidação · dias ${firstDay + 7} a ${lastDay}`}
                          </p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
                            {phaseLessons.map((lesson) => (
                              <DayCard
                                key={lesson.id}
                                lesson={lesson}
                                completed={completedIds.has(lesson.id)}
                                isCurrent={lesson.day_number === enrollment?.current_day}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CircuitAccordionItem>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState
          icon={<Clock />}
          title="Nenhum canto encontrado"
          description="Rode `npm run seed:curriculum` para popular o curso."
        />
      )}
    </div>
  );
}

function DayCard({
  lesson,
  completed,
  isCurrent,
}: {
  lesson: { id: string; day_number: number; title: string; kind: string; is_published: boolean };
  completed: boolean;
  isCurrent: boolean;
}) {
  const locked = !lesson.is_published;
  const Icon = completed ? CheckCircle2 : locked ? Lock : isCurrent ? PlayCircle : Circle;

  const body = (
    <div
      className={cn(
        "h-full rounded-lg border p-3 transition-colors",
        completed && "border-success/35 bg-success/6",
        isCurrent && !completed && "border-primary bg-primary/6",
        locked && "opacity-55",
        !locked && "hover:bg-accent",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="max-sm:text-xs text-[11px] font-semibold tabular-nums">Dia {lesson.day_number}</span>
        <Icon
          className={cn(
            "size-3.5 shrink-0",
            completed && "text-success",
            isCurrent && !completed && "text-primary",
            !completed && !isCurrent && "text-muted-foreground/50",
          )}
        />
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs leading-snug font-medium">{lesson.title}</p>
      <p className="text-muted-foreground mt-1.5 max-sm:text-xs text-[10px]">
        {LESSON_KIND_LABEL[lesson.kind as keyof typeof LESSON_KIND_LABEL]}
      </p>
    </div>
  );

  return locked ? body : <Link href={`/app/licao/${lesson.day_number}`}>{body}</Link>;
}
