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
              <Link href="/app">Voltar ao painel</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const supabase = await createServerSupabase();

  const [{ data: progress }, nextLesson] = await Promise.all([
    enrollment
      ? supabase
          .from("lesson_progress")
          .select("status")
          .eq("enrollment_id", enrollment.id)
          .eq("lesson_id", lesson.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getNextLesson(course.id, day + 1),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header className="space-y-3">
        <Link
          href="/app"
          className="text-muted-foreground hover:text-foreground -ml-2 inline-flex min-h-10 items-center gap-1.5 px-2 text-sm transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao painel
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
      />
    </div>
  );
}
