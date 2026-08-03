import { ArrowLeft, Bot, Eye, PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LessonBlockView } from "@/components/lesson/lesson-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireStaff } from "@/lib/auth/guards";
import { LESSON_KIND_LABEL } from "@/lib/learning";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

import { PublishToggle } from "../lesson-actions";
import { LessonEditor } from "./lesson-editor";

export const metadata: Metadata = { title: "Editar lição" };

export default async function AdminLessonDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireStaff("/admin/licoes");

  const supabase = await createServerSupabase();
  const { data: lesson } = await supabase.from("lessons").select("*").eq("id", id).maybeSingle();

  if (!lesson) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header className="space-y-3">
        <Link
          href="/admin/licoes"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Todas as lições
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge>Dia {lesson.day_number}</Badge>
              <Badge variant="neutral">{LESSON_KIND_LABEL[lesson.kind]}</Badge>
              <Badge variant="neutral">{lesson.level}</Badge>
              <Badge variant={lesson.is_published ? "success" : "warning"}>
                {lesson.is_published ? "Publicada" : "Rascunho"}
              </Badge>
              {lesson.generated_by?.startsWith("gemini") ? (
                <Badge variant="default">
                  <Bot className="size-3" /> {lesson.generated_by}
                </Badge>
              ) : lesson.generated_by === "handwritten" ? (
                <Badge variant="success">
                  <PenLine className="size-3" /> Editorial
                </Badge>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold">{lesson.title}</h1>
            <p className="text-muted-foreground mt-1 text-xs">
              Circuito {lesson.week_number} · dia {lesson.circuit_day} de 14 · atualizada em{" "}
              {formatDateTime(lesson.updated_at)}
              {lesson.reviewed_at ? ` · revisada em ${formatDateTime(lesson.reviewed_at)}` : ""}
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            {lesson.is_published ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/licao/${lesson.day_number}`} target="_blank">
                  <Eye className="size-3.5" /> Ver como aluno
                </Link>
              </Button>
            ) : null}
            <PublishToggle lessonId={lesson.id} published={lesson.is_published} />
          </div>
        </div>
      </header>

      <Tabs defaultValue="editar">
        <TabsList>
          <TabsTrigger value="editar">Editar</TabsTrigger>
          <TabsTrigger value="preview">Prévia</TabsTrigger>
          <TabsTrigger value="dados">Vocabulário e quiz</TabsTrigger>
        </TabsList>

        <TabsContent value="editar">
          <Card>
            <CardContent className="pt-5">
              <LessonEditor lesson={lesson} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <div className="space-y-6">
            {lesson.content.warmup ? (
              <div className="border-l-primary bg-muted/50 rounded-xl border-l-3 p-5">
                <p className="text-primary mb-1.5 text-xs font-semibold tracking-wide uppercase">
                  Aquecimento
                </p>
                <p className="text-sm leading-relaxed">{lesson.content.warmup}</p>
              </div>
            ) : null}

            {(lesson.content.blocks ?? []).map((block, i) => (
              <LessonBlockView key={i} block={block} />
            ))}

            {/* Os blocos do portão de imersão (dia 1) só aparecem no player
                depois de 3 escutas — aqui o revisor vê tudo de uma vez. */}
            {(lesson.content.gated ?? []).map((block, i) => (
              <LessonBlockView key={`gated-${i}`} block={block} />
            ))}

            {!lesson.content.blocks?.length && !lesson.content.gated?.length ? (
              <Card>
                <CardContent className="text-muted-foreground py-12 text-center text-sm">
                  Esta lição está sem conteúdo, o que não deveria acontecer.
                  <br />
                  Todo o material vive em{" "}
                  <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                    content/circuits/
                  </code>
                  . Rode{" "}
                  <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                    npm run seed:curriculum
                  </code>{" "}
                  para repopular.
                </CardContent>
              </Card>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="dados">
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Vocabulário ({lesson.vocabulary.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {lesson.vocabulary.map((item, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium">{item.term}</span>
                      {item.ipa ? (
                        <code className="text-primary font-mono text-xs">{item.ipa}</code>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-sm">{item.translation}</p>
                    {item.example ? (
                      <p className="mt-1.5 text-xs italic">{item.example}</p>
                    ) : null}
                  </div>
                ))}
                {!lesson.vocabulary.length ? (
                  <p className="text-muted-foreground py-4 text-sm">Sem vocabulário cadastrado.</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Quiz ({lesson.quiz.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lesson.quiz.map((question, qi) => (
                  <div key={question.id || qi} className="rounded-lg border p-4">
                    <p className="text-sm font-medium">
                      {qi + 1}. {question.question}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {question.options.map((option, oi) => (
                        <li
                          key={oi}
                          className={
                            oi === question.answerIndex
                              ? "text-success text-sm font-medium"
                              : "text-muted-foreground text-sm"
                          }
                        >
                          {String.fromCharCode(65 + oi)}. {option}
                          {oi === question.answerIndex ? " ✓" : ""}
                        </li>
                      ))}
                    </ul>
                    {question.explanation ? (
                      <p className="text-muted-foreground bg-muted/50 mt-2 rounded px-3 py-2 text-xs">
                        {question.explanation}
                      </p>
                    ) : null}
                  </div>
                ))}
                {!lesson.quiz.length ? (
                  <p className="text-muted-foreground py-4 text-sm">Sem quiz cadastrado.</p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
