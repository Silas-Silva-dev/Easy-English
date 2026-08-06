"use client";

import { Save, SlidersHorizontal } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { updateCourseMinScoreAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface CourseScoreSetting {
  id: string;
  title: string;
  minScore: number;
}

/**
 * Cadastro da nota de corte do certificado, por curso.
 *
 * O aluno só recebe o certificado depois de concluir todas as lições
 * publicadas e atingir esta média nas avaliações de fala — e é preciso ter
 * pelo menos uma gravação avaliada, porque sem gravação não existe média.
 */
export function CertificateScoreSettings({ courses }: { courses: CourseScoreSetting[] }) {
  if (!courses.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="size-4 text-amber-600 dark:text-amber-400" />
          Requisitos de emissão
        </CardTitle>
        <CardDescription>
          Média mínima nas avaliações de fala para o certificado ser emitido. O aluno também precisa
          concluir 100% das lições publicadas e ter ao menos uma prática de fala gravada e avaliada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {courses.map((course) => (
          <CourseScoreRow key={course.id} course={course} />
        ))}
      </CardContent>
    </Card>
  );
}

function CourseScoreRow({ course }: { course: CourseScoreSetting }) {
  const [value, setValue] = React.useState(course.minScore.toFixed(1));
  const [pending, startTransition] = React.useTransition();

  // O valor salvo manda: se o servidor revalidar a página com outro número, o
  // campo acompanha em vez de continuar exibindo o que foi digitado.
  React.useEffect(() => {
    setValue(course.minScore.toFixed(1));
  }, [course.minScore]);

  const parsed = Number(value.replace(",", "."));
  const invalid = !Number.isFinite(parsed) || parsed < 0 || parsed > 10;
  const changed = !invalid && Math.round(parsed * 10) / 10 !== course.minScore;

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateCourseMinScoreAction(course.id, parsed);
      if (result.ok) toast.success(result.message ?? "Média atualizada.");
      else toast.error(result.error ?? "Falha ao salvar a média mínima.");
    });
  };

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{course.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Média mínima atual:{" "}
          <strong className="font-semibold text-foreground">{course.minScore.toFixed(1)}</strong> de
          10.0
        </p>
      </div>

      <div className="flex items-end gap-2">
        <div className="space-y-1.5">
          <label
            htmlFor={`min-score-${course.id}`}
            className="block text-xs font-semibold text-foreground"
          >
            Nova média mínima
          </label>
          <input
            id={`min-score-${course.id}`}
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            max={10}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={invalid}
            className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm tabular-nums text-foreground focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none aria-[invalid=true]:border-destructive"
          />
        </div>

        <Button size="sm" className="gap-2" onClick={handleSave} loading={pending} disabled={!changed}>
          <Save className="size-3.5" />
          Salvar
        </Button>
      </div>

      {invalid ? (
        <p className="w-full text-xs font-medium text-destructive">
          Informe um valor entre 0 e 10.
        </p>
      ) : null}
    </div>
  );
}
