import { BookOpen, Bot, PenLine, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/guards";
import { LESSON_KIND_LABEL } from "@/lib/learning";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { BulkPublishButton, PublishToggle } from "./lesson-actions";

export const metadata: Metadata = { title: "Lições" };

const PAGE_SIZE = 30;

const FILTERS = [
  { key: "", label: "Todas" },
  { key: "publicada", label: "Publicadas" },
  { key: "rascunho", label: "Despublicadas" },
];

export default async function AdminLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; semana?: string; p?: string }>;
}) {
  const { status, q, semana, p } = await searchParams;
  await requireStaff("/admin/licoes");

  const page = Math.max(1, Number(p) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createServerSupabase();

  let query = supabase
    .from("lessons")
    .select("*", { count: "exact" })
    .order("day_number")
    .range(from, from + PAGE_SIZE - 1);

  if (status === "publicada") query = query.eq("is_published", true);
  if (status === "rascunho") query = query.eq("is_published", false);
  if (semana) query = query.eq("week_number", Number(semana));
  if (q?.trim()) query = query.ilike("title", `%${q.trim()}%`);

  const { data: lessons, count } = await query;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const unpublishedOnPage = (lessons ?? []).filter((l) => !l.is_published).map((l) => l.id);

  const buildHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ status, q, semana, p: String(page), ...patch })) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return `/admin/licoes${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <PageHeader
        eyebrow="Conteúdo"
        title="Lições"
        description={`${total} lição(ões) no cronograma, todas redigidas e versionadas no repositório. Para alterar o texto de uma lição, edite content/circuits/ e rode o seed de novo.`}
        action={<BulkPublishButton lessonIds={unpublishedOnPage} />}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <Link
              key={filter.key || "all"}
              href={buildHref({ status: filter.key || undefined, p: undefined })}
              className={cn(
                "inline-flex min-h-10 items-center rounded-full px-4 text-xs font-medium transition-colors",
                (status ?? "") === filter.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent",
              )}
            >
              {filter.label}
            </Link>
          ))}
        </div>

        <form className="relative sm:w-72">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input name="q" defaultValue={q} placeholder="Buscar por título…" className="pl-9" />
        </form>
      </div>

      {lessons?.length ? (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Dia</TableHead>
                <TableHead>Lição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-44" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lessons.map((lesson) => {
                const hasContent =
                  Boolean(lesson.content?.blocks?.length) || Boolean(lesson.grammar_explanation);

                return (
                  <TableRow key={lesson.id}>
                    <TableCell className="text-muted-foreground font-mono text-xs tabular-nums">
                      {lesson.day_number}
                    </TableCell>

                    <TableCell>
                      <Link
                        href={`/admin/licoes/${lesson.id}`}
                        className="hover:text-primary text-sm font-medium transition-colors"
                      >
                        {lesson.title}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        Circuito {lesson.week_number} · dia {lesson.circuit_day}/14 · {lesson.level} ·{" "}
                        {lesson.quiz.length} questões
                      </p>
                    </TableCell>

                    <TableCell>
                      <Badge variant="neutral" className="text-[10px]">
                        {LESSON_KIND_LABEL[lesson.kind]}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {lesson.generated_by?.startsWith("gemini") ? (
                        <Badge variant="default" className="text-[10px]">
                          <Bot className="size-3" /> IA
                        </Badge>
                      ) : lesson.generated_by === "handwritten" ? (
                        <Badge variant="success" className="text-[10px]">
                          <PenLine className="size-3" /> Editorial
                        </Badge>
                      ) : (
                        <Badge variant="neutral" className="text-[10px]">
                          Vazia
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant={lesson.is_published ? "success" : "warning"}>
                        {lesson.is_published ? "Publicada" : "Rascunho"}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        {hasContent ? (
                          <PublishToggle lessonId={lesson.id} published={lesson.is_published} />
                        ) : (
                          <span className="text-muted-foreground text-xs">sem conteúdo</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={<BookOpen />}
          title="Nenhuma lição encontrada"
          description="Rode `npm run seed:curriculum` para criar o cronograma de 365 dias."
        />
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={buildHref({ p: String(page - 1) })}
                className="hover:bg-accent inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm transition-colors"
              >
                Anterior
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={buildHref({ p: String(page + 1) })}
                className="hover:bg-accent inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm transition-colors"
              >
                Próxima
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
