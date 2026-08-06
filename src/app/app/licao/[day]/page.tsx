import { ArrowLeft, Clock, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LessonPlayer } from "@/components/lesson/lesson-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { requireActiveUser } from "@/lib/auth/guards";
import {
  getLessonByDay,
  getNextLesson,
  getOrCreateEnrollment,
  getPrimaryCourse,
  LESSON_KIND_LABEL,
} from "@/lib/learning";
import { getLastSpeakingResult } from "@/lib/speaking";
import { createServerSupabase } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ day: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { day } = await params;
  const course = await getPrimaryCourse();
  if (!course) return { title: `Dia ${day}` };

  const lesson = await getLessonByDay(course.id, Number(day));
  return { title: lesson ? `Dia ${lesson.day_number} · ${lesson.title}` : `Dia ${day}` };
}

export default async function LessonPage({ params }: Params) {
  const { day: dayParam } = await params;
  const day = Number(dayParam);

  if (!Number.isInteger(day) || day < 1) notFound();

  const { userId } = await requireActiveUser(`/app/licao/${dayParam}`);
  const course = await getPrimaryCourse();
  if (!course) notFound();

  const [lesson, enrollment] = await Promise.all([
    getLessonByDay(course.id, day),
    getOrCreateEnrollment(userId, course),
  ]);

  if (!lesson) notFound();

  function getCantoInfo(weekNumber: number) {
    if (weekNumber <= 13) return { href: "/app/canto/c1", label: "Voltar ao Canto 1: Destravar" };
    if (weekNumber <= 26) return { href: "/app/canto/c2", label: "Voltar ao Canto 2: Contar" };
    if (weekNumber <= 39) return { href: "/app/canto/c3", label: "Voltar ao Canto 3: Resolver" };
    return { href: "/app/canto/c4", label: "Voltar ao Canto 4: Soar natural" };
  }

  const cantoInfo = getCantoInfo(lesson.week_number);

  // Lição em rascunho só é visível para quem administra o conteúdo.
  if (!lesson.is_published) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          icon={<Lock />}
          title="Esta lição ainda não foi publicada"
          description={`O conteúdo do dia ${day} está em preparação. Continue pelo seu cronograma normal.`}
          action={
            <Button asChild variant="outline">
              <Link href={cantoInfo.href}>{cantoInfo.label}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const supabase = await createServerSupabase();

  const [{ data: progress }, nextLesson, speakingResult] = await Promise.all([
    enrollment
      ? supabase
          .from("lesson_progress")
          .select("status, quiz_answers, score")
          .eq("enrollment_id", enrollment.id)
          .eq("lesson_id", lesson.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getNextLesson(course.id, day + 1),
    // A fala já corrigida volta com a lição: o aluno reabre e continua vendo o
    // próprio áudio e a avaliação da tutora, em vez de recomeçar do zero.
    lesson.speaking_prompt ? getLastSpeakingResult(userId, lesson.id) : Promise.resolve(null),
  ]);

  // Reidrata as respostas do quiz salvas no banco para que o aluno que reabrir
  // uma lição já concluída veja suas respostas e as correções sem precisar
  // refazer o quiz do zero.
  const savedAnswers =
    progress?.status === "completed" && Array.isArray(progress.quiz_answers)
      ? Object.fromEntries(
          (progress.quiz_answers as number[]).map((answer, i) => [i, answer] as [number, number]),
        )
      : {};

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header className="space-y-3">
        <Link
          href={cantoInfo.href}
          className="text-muted-foreground hover:text-foreground -ml-2 inline-flex min-h-10 items-center gap-1.5 px-2 text-sm transition-colors"
        >
          <ArrowLeft className="size-3.5" /> {cantoInfo.label}
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Badge>Dia {lesson.day_number}</Badge>
          <Badge variant="neutral">{LESSON_KIND_LABEL[lesson.kind]}</Badge>
          <Badge variant="neutral">{lesson.level}</Badge>
          <Badge variant="neutral">
            <Clock className="size-3" /> {lesson.estimated_minutes} min
          </Badge>
          <Badge variant="neutral">
            Circuito {lesson.week_number} · dia {lesson.circuit_day} de 14
          </Badge>
          {progress?.status === "completed" ? <Badge variant="success">Concluída</Badge> : null}
        </div>

        <div>
          <h1 className="text-2xl leading-tight font-semibold sm:text-3xl">{lesson.title}</h1>
          {lesson.objective ? (
            <p className="text-muted-foreground mt-2 leading-relaxed">{lesson.objective}</p>
          ) : null}
        </div>
      </header>

      <LessonPlayer
        lesson={lesson}
        alreadyCompleted={progress?.status === "completed"}
        nextPublishedDay={nextLesson?.day_number ?? null}
        initialSpeakingResult={speakingResult}
        initialAnswers={savedAnswers}
      />
    </div>
  );
}
