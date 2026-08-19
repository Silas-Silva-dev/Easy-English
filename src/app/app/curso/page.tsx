import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Flame,
  Layers,
  Lock,
  Mic,
  PlayCircle,
  Radio,
  Sparkles,
  Volume2,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CourseSidebar,
  type SidebarLessonItem,
} from "@/components/curso/course-sidebar";
import {
  LessonPlayer,
  type ExposicaoDaLicao,
} from "@/components/lesson/lesson-player";
import { AtalhoDoPortao } from "@/components/portao/painel-do-portao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { audioSrc } from "@/lib/audio-id";
import { requireActiveUser } from "@/lib/auth/guards";
import {
  chaveDaPeca,
  estadoDe,
  semTextoTravado,
  type PapelDaExposicao,
} from "@/lib/exposicao";
import {
  getLessonByDay,
  getNextLesson,
  getOrCreateEnrollment,
  getPrimaryCourse,
  LESSON_KIND_LABEL,
} from "@/lib/learning";
import { getLastSpeakingResult } from "@/lib/speaking";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn, pct } from "@/lib/utils";
import {
  CANTOS,
  CIRCUITS,
  DAY_RHYTHM,
  DAYS_PER_CIRCUIT,
  TOTAL_DAYS,
} from "@content/curriculum";
import { escutasExigidas } from "@content/metodo";

interface PageProps {
  searchParams: Promise<{
    day?: string;
    dia?: string;
    canto?: string;
    circuito?: string;
  }>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const rawDay = params.day || params.dia;
  const day = rawDay ? Number(rawDay) : null;

  if (day && Number.isInteger(day)) {
    return {
      title: `Dia ${day} · Curso 4 Cantos`,
    };
  }

  return {
    title: "Curso 4 Cantos · Fácil e Destravado",
  };
}

export default async function Curso4CantosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { userId, profile } = await requireActiveUser("/app/curso");

  const course = await getPrimaryCourse();
  if (!course) {
    return (
      <EmptyState
        icon={<BookOpen />}
        title="Nenhum curso publicado ainda"
        description="O currículo do Curso 4 Cantos está sendo preparado."
      />
    );
  }

  const enrollment = await getOrCreateEnrollment(userId, course);
  const supabase = await createServerSupabase();

  // Determinar o dia selecionado (URL > Matrícula > Dia 1)
  const currentDay = enrollment?.current_day ?? 1;
  const requestedDay = Number(params.day || params.dia);

  // Se passou canto ou circuito na URL mas não dia
  let targetDay = requestedDay;
  if (!targetDay || !Number.isInteger(targetDay) || targetDay < 1) {
    if (params.circuito) {
      const circNum = Number(params.circuito);
      if (circNum >= 1 && circNum <= 52) {
        targetDay = (circNum - 1) * DAYS_PER_CIRCUIT + 1;
      }
    } else if (params.canto) {
      const cantoCode = params.canto.toUpperCase();
      const spec = CANTOS.find((c) => c.code.toUpperCase() === cantoCode);
      if (spec) {
        targetDay = (spec.weekStart - 1) * DAYS_PER_CIRCUIT + 1;
      }
    }
  }

  const selectedDay =
    targetDay && Number.isInteger(targetDay) && targetDay >= 1 && targetDay <= TOTAL_DAYS
      ? targetDay
      : currentDay;

  // Busca todas as lições (apenas colunas necessárias para o menu) e progresso
  const [{ data: allLessons }, { data: completedRows }] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        "id, module_id, week_number, circuit_day, day_number, title, kind, is_published, phase",
      )
      .eq("course_id", course.id)
      .order("day_number"),
    enrollment
      ? supabase
          .from("lesson_progress")
          .select("lesson_id")
          .eq("enrollment_id", enrollment.id)
          .eq("status", "completed")
      : Promise.resolve({ data: [] as { lesson_id: string }[] }),
  ]);

  const completedLessonIds = (completedRows ?? []).map((r) => r.lesson_id);
  const sidebarLessons: SidebarLessonItem[] = (allLessons ?? []).map((l) => ({
    id: l.id,
    day_number: l.day_number,
    week_number: l.week_number,
    circuit_day: l.circuit_day,
    title: l.title,
    kind: l.kind,
    is_published: l.is_published,
    phase: l.phase as "A" | "B" | undefined,
  }));

  // Busca a lição completa do dia selecionado
  const [selectedLesson, nextLesson] = await Promise.all([
    getLessonByDay(course.id, selectedDay),
    getNextLesson(course.id, selectedDay + 1),
  ]);

  // Se não encontrar lição do dia selecionado, renderiza aviso ou busca do currículo estático
  const circuitNumber = Math.ceil(selectedDay / DAYS_PER_CIRCUIT);
  const circuitDay = ((selectedDay - 1) % DAYS_PER_CIRCUIT) + 1;
  const circuitSpec = CIRCUITS.find((c) => c.number === circuitNumber);
  const cantoSpec =
    CANTOS.find(
      (c) => circuitNumber >= c.weekStart && circuitNumber <= c.weekEnd,
    ) ?? CANTOS[0];
  const dayRole = DAY_RHYTHM[circuitDay - 1];

  // Avaliação do portão do circuito (se houver)
  const { data: portaoStatus } = await supabase
    .from("circuit_gate_status")
    .select("passed, evaluated_at, components")
    .eq("user_id", userId)
    .eq("circuit_number", circuitNumber)
    .maybeSingle();

  // Dados da lição para o LessonPlayer
  let lessonPlayerComponent = null;

  if (selectedLesson) {
    if (!selectedLesson.is_published) {
      lessonPlayerComponent = (
        <div className="rounded-2xl border border-border bg-card/50 p-8 text-center">
          <EmptyState
            icon={<Lock />}
            title="Esta lição ainda está em preparação"
            description={`O conteúdo do dia ${selectedDay} (${selectedLesson.title}) será publicado em breve.`}
            action={
              <Button asChild variant="outline">
                <Link href={`/app/curso?day=${currentDay}`}>
                  Ir para o seu dia atual ({currentDay})
                </Link>
              </Button>
            }
          />
        </div>
      );
    } else {
      const papel: PapelDaExposicao | null = selectedLesson.immersion_script
        ? "imersao"
        : selectedLesson.listening_script
          ? "escuta"
          : null;

      const diaDeOrigem = papel === "imersao" ? 1 : 4;
      const chave = papel
        ? chaveDaPeca(selectedLesson.week_number, diaDeOrigem, papel)
        : null;

      const [
        { data: progress },
        speakingResult,
        { data: exposicao },
      ] = await Promise.all([
        enrollment
          ? supabase
              .from("lesson_progress")
              .select("status, quiz_answers, score")
              .eq("enrollment_id", enrollment.id)
              .eq("lesson_id", selectedLesson.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        selectedLesson.speaking_prompt
          ? getLastSpeakingResult(userId, selectedLesson.id)
          : Promise.resolve(null),
        chave
          ? supabase
              .from("listening_exposures")
              .select("*")
              .eq("user_id", userId)
              .eq("exposure_key", chave)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const estado = chave
        ? estadoDe(chave, exposicao, escutasExigidas(selectedLesson.week_number))
        : null;

      const roteiroDaPeca =
        papel === "imersao"
          ? selectedLesson.immersion_script
          : selectedLesson.listening_script;

      const exposure: ExposicaoDaLicao | null =
        estado && papel
          ? {
              papel,
              key: estado.chave,
              requiredPlays: estado.exigidas,
              initialPlays: estado.escutas,
              unlocked: estado.desbloqueada,
              blocks: estado.desbloqueada ? selectedLesson.content.gated ?? [] : [],
              audioExempt: profile.audio_exempt,
              audioUrl: estado.desbloqueada ? null : audioSrc(roteiroDaPeca ?? ""),
            }
          : null;

      const licaoDoAluno =
        exposure && !exposure.unlocked
          ? semTextoTravado(selectedLesson, exposure.papel)
          : selectedLesson;

      const savedAnswers =
        progress?.status === "completed" && Array.isArray(progress.quiz_answers)
          ? Object.fromEntries(
              (progress.quiz_answers as number[]).map(
                (answer, i) => [i, answer] as [number, number],
              ),
            )
          : {};

      lessonPlayerComponent = (
        <LessonPlayer
          lesson={licaoDoAluno}
          exposure={exposure}
          alreadyCompleted={progress?.status === "completed"}
          nextPublishedDay={nextLesson?.day_number ?? null}
          initialSpeakingResult={speakingResult}
          initialAnswers={savedAnswers}
        />
      );
    }
  } else {
    // Caso a lição ainda não exista no banco (ex: dias > 52 ainda não semeados)
    lessonPlayerComponent = (
      <div className="rounded-2xl border border-border bg-card/60 p-8 text-center space-y-4">
        <EmptyState
          icon={<Clock />}
          title={`Conteúdo do Dia ${selectedDay}`}
          description={`Circuito ${circuitNumber}: ${circuitSpec?.title ?? "Inglês falado"} — Papel: ${dayRole?.label ?? "Prática"}.`}
          action={
            <Button asChild variant="outline">
              <Link href={`/app/curso?day=${currentDay}`}>
                Voltar para o Dia {currentDay}
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const isCurrentDay = selectedDay === currentDay;
  const isSelectedCompleted = selectedLesson
    ? completedLessonIds.includes(selectedLesson.id)
    : false;

  return (
    <div className="flex w-full min-w-0 flex-1 items-start">
      {/* ---------------------------------------------------- CENTRO DA TELA */}
      <div className="flex-1 min-w-0 px-4 py-6 sm:px-6 md:px-8 space-y-6 max-w-4xl mx-auto w-full pb-16 lg:pb-10">
        {/* Breadcrumb e Navegação Rápida Superior */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
          {/* Breadcrumb Contextual */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
            <span className="font-semibold text-primary">
              {cantoSpec.code} · {cantoSpec.title.split(":")[1]?.trim() ?? cantoSpec.title}
            </span>
            <span className="text-muted-foreground/60">/</span>
            <span className="font-medium text-foreground">
              Circuito {circuitNumber}
              {circuitSpec ? `: ${circuitSpec.title}` : ""}
            </span>
            <span className="text-muted-foreground/60">/</span>
            <span className="font-bold text-foreground">
              Dia {selectedDay}
            </span>
          </div>

          {/* Botões de Pular Dia Anterior / Próximo */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={selectedDay <= 1}
              className={cn(
                "h-8 text-xs gap-1",
                selectedDay <= 1 && "pointer-events-none opacity-40",
              )}
            >
              <Link href={`/app/curso?day=${selectedDay - 1}`}>
                <ChevronLeft className="size-3.5" /> Dia anterior
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={selectedDay >= TOTAL_DAYS}
              className={cn(
                "h-8 text-xs gap-1",
                selectedDay >= TOTAL_DAYS && "pointer-events-none opacity-40",
              )}
            >
              <Link href={`/app/curso?day=${selectedDay + 1}`}>
                Próximo dia <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Banner do Portão do Circuito (se aplicável ao circuito) */}
        {circuitNumber ? (
          <AtalhoDoPortao circuito={circuitNumber} status={portaoStatus} />
        ) : null}

        {/* Cabeçalho do Dia em Foco */}
        <div className="bg-card/90 border border-border/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs relative overflow-hidden">
          {/* Luz sutil de destaque no topo */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Badges de contextualização */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary text-primary-foreground font-semibold px-2.5 py-0.5">
                Dia {selectedDay}
              </Badge>
              <Badge variant="neutral" className="text-xs">
                {dayRole?.label ?? LESSON_KIND_LABEL[selectedLesson?.kind as keyof typeof LESSON_KIND_LABEL] ?? "Lição"}
              </Badge>
              <Badge variant="neutral" className="text-xs">
                {dayRole?.phase === "A" ? "Fase A · Aquisição" : "Fase B · Consolidação"}
              </Badge>
              <Badge variant="neutral" className="text-xs">
                {cantoSpec.level}
              </Badge>
              <Badge variant="neutral" className="text-xs flex items-center gap-1">
                <Clock className="size-3" /> {selectedLesson?.estimated_minutes ?? 15} min
              </Badge>

              {isSelectedCompleted ? (
                <Badge variant="success" className="text-xs flex items-center gap-1 font-medium">
                  <CheckCircle2 className="size-3" /> Concluída
                </Badge>
              ) : isCurrentDay ? (
                <Badge variant="streak" className="text-xs flex items-center gap-1 font-medium">
                  <PlayCircle className="size-3" /> Seu dia de hoje
                </Badge>
              ) : null}
            </div>

            {/* Posição no circuito */}
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              Circuito {circuitNumber} · Dia {circuitDay} de 14
            </span>
          </div>

          {/* Título e Objetivo da Lição */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {selectedLesson?.title ?? circuitSpec?.title ?? `Dia ${selectedDay}`}
            </h1>
            {selectedLesson?.objective ? (
              <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                {selectedLesson.objective}
              </p>
            ) : circuitSpec?.situation ? (
              <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                <span className="font-medium text-foreground">Cena real:</span>{" "}
                {circuitSpec.situation}
              </p>
            ) : null}
          </div>

          {/* Card de contexto situacional do circuito (quando disponível) */}
          {circuitSpec && (
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-border/60">
              <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                <span className="font-semibold text-primary uppercase text-[10px] tracking-wider block">
                  Molde da Semana
                </span>
                <p className="font-mono text-foreground font-medium">
                  {circuitSpec.pattern}
                </p>
                {circuitSpec.patternNote && (
                  <p className="text-muted-foreground text-[11px]">
                    {circuitSpec.patternNote}
                  </p>
                )}
              </div>

              <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                <span className="font-semibold text-foreground uppercase text-[10px] tracking-wider block">
                  Missão do Circuito
                </span>
                <p className="text-muted-foreground">
                  {circuitSpec.mission}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Componente Interativo da Lição */}
        <div className="pt-2">
          {lessonPlayerComponent}
        </div>

        {/* Navegação Inferior de Conclusão */}
        <div className="flex items-center justify-between border-t border-border/70 pt-6 pb-12">
          <Button
            asChild
            variant="outline"
            disabled={selectedDay <= 1}
            className={cn(
              "text-xs gap-1.5",
              selectedDay <= 1 && "pointer-events-none opacity-40",
            )}
          >
            <Link href={`/app/curso?day=${selectedDay - 1}`}>
              <ArrowLeft className="size-4" /> Dia anterior
            </Link>
          </Button>

          <Button
            asChild
            variant="default"
            disabled={selectedDay >= TOTAL_DAYS}
            className={cn(
              "text-xs gap-1.5",
              selectedDay >= TOTAL_DAYS && "pointer-events-none opacity-40",
            )}
          >
            <Link href={`/app/curso?day=${selectedDay + 1}`}>
              Próximo dia ({selectedDay + 1}) <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------- MENU LATERAL DIREITO */}
      <CourseSidebar
        cantos={CANTOS}
        circuits={CIRCUITS}
        lessons={sidebarLessons}
        completedLessonIds={completedLessonIds}
        selectedDay={selectedDay}
        currentDay={currentDay}
      />
    </div>
  );
}
