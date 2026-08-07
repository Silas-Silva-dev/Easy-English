import { Award, BookOpenCheck, CheckCircle2, Lock, Mic, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CertificateEligibility } from "@/lib/types/database";

interface CertificateLockedProps {
  eligibility: CertificateEligibility;
  courseTitle: string;
}

export function CertificateLocked({ eligibility, courseTitle }: CertificateLockedProps) {
  const isLessonsDone = eligibility.completedLessons >= eligibility.publishedLessons;
  // Sem gravação avaliada não existe média, então o critério não pode ser dado
  // como cumprido nem exibido como "0.0" — seria nota, e não ausência de nota.
  const hasEvaluations = eligibility.speakingEvaluations > 0;
  const isScoreDone = hasEvaluations && eligibility.averageScore >= eligibility.minScoreRequired;
  const minScoreLabel = eligibility.minScoreRequired.toFixed(1);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="border-amber-500/30 bg-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-amber-500/10 ring-8 ring-amber-500/5">
            <Lock className="size-7 text-amber-600 dark:text-amber-400" />
          </div>

          <Badge variant="outline" className="mx-auto border-amber-500/40 text-amber-600 dark:text-amber-400">
            Requisitos de Emissão
          </Badge>

          <CardTitle className="mt-2 text-2xl font-bold">Certificado em Progresso</CardTitle>

          <CardDescription className="text-base">
            O certificado oficial de conclusão do curso <strong className="text-foreground">{courseTitle}</strong> será emitido e liberado assim que você cumprir todos os requisitos abaixo.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Carga Horária do Curso */}
          <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Award className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Carga Horária Reconhecida</p>
                <p className="text-xs text-muted-foreground">Calculada sobre a grade completa do curso</p>
              </div>
            </div>
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {eligibility.calculatedWorkloadHours} Horas
            </span>
          </div>

          {/* Requisito 1: Progresso das Lições (100%) */}
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-sm">
                <BookOpenCheck className="size-4 text-primary" />
                <span>1. Conclusão de 100% das lições</span>
              </div>
              <Badge variant={isLessonsDone ? "success" : "neutral"}>
                {eligibility.completedLessons} / {eligibility.publishedLessons} lições
              </Badge>
            </div>
            <Progress value={eligibility.lessonsProgressPct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {isLessonsDone
                ? "✓ Todas as lições foram concluídas!"
                : `Faltam ${eligibility.publishedLessons - eligibility.completedLessons} lições para completar a grade.`}
            </p>
          </div>

          {/* Requisito 2: media minima cadastrada no curso, sobre as praticas de fala */}
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mic className="size-4 text-primary" />
                {/*
                  "das aulas" não é enfeite: a prática livre de "Praticar Fala"
                  não entra nesta média. Sem dizer isso, o aluno grava no lugar
                  errado esperando que a nota conte.
                */}
                <span>2. Média mínima de {minScoreLabel} nas práticas de fala das aulas</span>
              </div>
              <Badge variant={isScoreDone ? "success" : "warning"}>
                {hasEvaluations
                  ? `Sua Média: ${eligibility.averageScore.toFixed(1)} / 10.0`
                  : "Sem avaliações ainda"}
              </Badge>
            </div>
            <Progress
              value={hasEvaluations ? Math.min(100, (eligibility.averageScore / 10) * 100) : 0}
              className="h-2"
            />
            <p className="text-xs text-muted-foreground">
              {!hasEvaluations
                ? `Grave suas práticas de conversação para que a média seja calculada. É ela que precisa alcançar ${minScoreLabel}.`
                : isScoreDone
                  ? "✓ Sua média atual atende ao critério de aprovação!"
                  : `Nota média atual é ${eligibility.averageScore.toFixed(1)} em ${eligibility.speakingEvaluations} ${eligibility.speakingEvaluations === 1 ? "avaliação" : "avaliações"}. Continue praticando a fala para alcançar ${minScoreLabel}.`}
            </p>
          </div>

          {/* Lista de Impeditivos se houver */}
          {eligibility.reasons.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert className="size-4 text-amber-600" />
                <span>Passos pendentes para a emissão:</span>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                {eligibility.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA */}
          <div className="pt-2 text-center">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/app">Continuar Estudando o Curso</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
