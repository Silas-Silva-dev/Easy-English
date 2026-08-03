import { BookOpen, Layers, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { requireStaff } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";
import { pct } from "@/lib/utils";

import { CoursePublishToggle } from "./course-actions";

export const metadata: Metadata = { title: "Cursos" };

export default async function AdminCoursesPage() {
  await requireStaff("/admin/cursos");
  const supabase = await createServerSupabase();

  const { data: courses } = await supabase.from("courses").select("*").order("created_at");

  if (!courses?.length) {
    return (
      <div className="mx-auto max-w-5xl space-y-7">
        <PageHeader eyebrow="Conteúdo" title="Cursos" />
        <EmptyState
          icon={<BookOpen />}
          title="Nenhum curso cadastrado"
          description="Rode `npm run seed:curriculum` para criar o curso de inglês para conversação com os 4 Cantos, 52 circuitos e 728 lições."
        />
      </div>
    );
  }

  const stats = await Promise.all(
    courses.map(async (course) => {
      const [{ count: modules }, { count: lessons }, { count: published }, { count: students }] =
        await Promise.all([
          supabase
            .from("modules")
            .select("*", { count: "exact", head: true })
            .eq("course_id", course.id),
          supabase
            .from("lessons")
            .select("*", { count: "exact", head: true })
            .eq("course_id", course.id),
          supabase
            .from("lessons")
            .select("*", { count: "exact", head: true })
            .eq("course_id", course.id)
            .eq("is_published", true),
          supabase
            .from("enrollments")
            .select("*", { count: "exact", head: true })
            .eq("course_id", course.id),
        ]);

      return {
        course,
        modules: modules ?? 0,
        lessons: lessons ?? 0,
        published: published ?? 0,
        students: students ?? 0,
      };
    }),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <PageHeader
        eyebrow="Conteúdo"
        title="Cursos"
        description="Catálogo da plataforma e estado de publicação de cada curso."
      />

      <div className="space-y-5">
        {stats.map(({ course, modules, lessons, published, students }) => (
          <Card key={course.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant={course.is_published ? "success" : "warning"}>
                      {course.is_published ? "Publicado" : "Rascunho"}
                    </Badge>
                    <Badge variant="neutral">
                      {course.level_from} → {course.level_to}
                    </Badge>
                    <Badge variant="neutral">
                      {course.duration_days} dias · {course.daily_minutes} min/dia
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{course.title}</CardTitle>
                  {course.subtitle ? (
                    <p className="text-muted-foreground mt-1 text-sm">{course.subtitle}</p>
                  ) : null}
                </div>

                <CoursePublishToggle courseId={course.id} published={course.is_published} />
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {course.description ? (
                <p className="text-muted-foreground text-sm leading-relaxed">{course.description}</p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs tracking-wide uppercase">
                    <Layers className="size-3" /> Módulos
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{modules}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs tracking-wide uppercase">
                    <BookOpen className="size-3" /> Lições
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{lessons}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">Publicadas</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{published}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs tracking-wide uppercase">
                    <Users className="size-3" /> Alunos
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{students}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Conteúdo publicado</span>
                  <span className="tabular-nums">{pct(published, lessons)}%</span>
                </div>
                <Progress
                  value={pct(published, lessons)}
                  className="h-2"
                  indicatorClassName="bg-success"
                />
              </div>

              <Link
                href="/admin/licoes"
                className="text-primary inline-block text-sm font-medium hover:underline"
              >
                Gerenciar lições →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
