"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Flame,
  Globe,
  GraduationCap,
  ListChecks,
  Mic,
  PartyPopper,
  Radio,
  Sparkles,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { AudioPlayer, ImmersionGate } from "@/components/audio/audio-player";
import { PronunciationLine } from "@/components/lesson/pronunciation-line";
import { LessonBlockView, RichText } from "@/components/lesson/lesson-blocks";
import type { SpeakingResult } from "@/components/speaking/feedback-panel";
import { PracticeStation } from "@/components/speaking/practice-station";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Lesson } from "@/lib/types/database";

import { completeLessonAction } from "@/app/app/actions";

type Step = "content" | "vocabulary" | "quiz" | "practice" | "done";

const STEP_META: { id: Step; label: string; icon: typeof BookOpen }[] = [
  { id: "content", label: "Lição", icon: BookOpen },
  { id: "vocabulary", label: "Blocos", icon: GraduationCap },
  { id: "quiz", label: "Quiz", icon: ListChecks },
  { id: "practice", label: "Fala", icon: Mic },
];

export function LessonPlayer({
  lesson,
  alreadyCompleted,
  nextPublishedDay,
  initialSpeakingResult = null,
}: {
  lesson: Lesson;
  alreadyCompleted: boolean;
  nextPublishedDay: number | null;
  /** Avaliação de fala já salva desta lição, reidratada do banco. */
  initialSpeakingResult?: SpeakingResult | null;
}) {
  const hasVocabulary = lesson.chunks?.length > 0 || lesson.vocabulary.length > 0;
  const hasQuiz = lesson.quiz.length > 0;
  const hasPractice = Boolean(lesson.speaking_prompt);

  const steps = React.useMemo(
    () =>
      STEP_META.filter(
        (s) =>
          s.id === "content" ||
          (s.id === "vocabulary" && hasVocabulary) ||
          (s.id === "quiz" && hasQuiz) ||
          (s.id === "practice" && hasPractice),
      ),
    [hasVocabulary, hasQuiz, hasPractice],
  );

  const [step, setStep] = React.useState<Step>("content");
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [revealed, setRevealed] = React.useState(false);
  // A avaliação mora AQUI, e não dentro do PracticeStation: trocar de etapa
  // desmonta a estação e o resultado recém-recebido morria junto com ela.
  const [speakingResult, setSpeakingResult] = React.useState<SpeakingResult | null>(
    initialSpeakingResult,
  );
  // Quem já gravou nesta lição não é cobrado de novo ao reabrir. `spoke` é
  // monotônico: pedir para regravar não faz o aviso voltar.
  const [spoke, setSpoke] = React.useState(Boolean(initialSpeakingResult));
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<{ streak: number; nextDay: number | null } | null>(null);
  const startedAt = React.useRef(Date.now());

  const currentIndex = steps.findIndex((s) => s.id === step);
  const progressPct = step === "done" ? 100 : Math.round((currentIndex / steps.length) * 100);

  const quizScore = React.useMemo(() => {
    if (!hasQuiz) return null;
    const correct = lesson.quiz.filter((q, i) => answers[i] === q.answerIndex).length;
    return Math.round((correct / lesson.quiz.length) * 100);
  }, [answers, hasQuiz, lesson.quiz]);

  const allAnswered = hasQuiz && Object.keys(answers).length === lesson.quiz.length;

  function goNext() {
    const next = steps[currentIndex + 1];
    if (next) {
      setStep(next.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      void finish();
    }
  }

  function goPrev() {
    const prev = steps[currentIndex - 1];
    if (prev) {
      setStep(prev.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function finish() {
    setSaving(true);
    const minutes = Math.max(
      1,
      Math.min(120, Math.round((Date.now() - startedAt.current) / 60000)),
    );

    const response = await completeLessonAction({
      lessonId: lesson.id,
      minutes,
      score: quizScore,
      quizAnswers: lesson.quiz.map((_, i) => answers[i] ?? -1),
    });

    setSaving(false);

    if (!response.ok) {
      toast.error(response.error ?? "Não foi possível concluir a lição");
      return;
    }

    setResult({ streak: response.streak ?? 0, nextDay: response.nextDay ?? null });
    setStep("done");
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success("Lição concluída!");
  }

  // ------------------------------------------------------------- Conclusão
  if (step === "done") {
    return (
      <div className="animate-in-up mx-auto max-w-2xl">
        <Card className="overflow-hidden text-center">
          <div className="from-success/15 bg-gradient-to-b to-transparent px-6 pt-10 pb-6">
            <div className="bg-success/15 text-success mx-auto grid size-16 place-items-center rounded-full">
              <PartyPopper className="size-7" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold">Lição concluída!</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Dia {lesson.day_number} fechado. Consistência é o que constrói fluência.
            </p>
          </div>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-streak/10 rounded-xl p-4">
                <Flame className="text-streak mx-auto size-5" />
                <p className="mt-2 text-2xl font-semibold tabular-nums">{result?.streak ?? 0}</p>
                <p className="text-muted-foreground text-xs">dias de ofensiva</p>
              </div>
              <div className="bg-success/10 rounded-xl p-4">
                <CheckCircle2 className="text-success mx-auto size-5" />
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {quizScore != null ? `${quizScore}%` : ": "}
                </p>
                <p className="text-muted-foreground text-xs">no quiz</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              {nextPublishedDay ? (
                <Button asChild size="lg" variant="gradient">
                  <Link href={`/app/licao/${nextPublishedDay}`}>
                    Próxima lição <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : null}
              <Button asChild size="lg" variant="outline">
                <Link href="/app">Voltar ao painel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* -------------------------------------------------------- Progresso */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isDoneStep = alreadyCompleted || i < currentIndex;
              const active = i === currentIndex;
              return (
                <button
                  key={s.id}
                  onClick={() => setStep(s.id)}
                  className={cn(
                    "flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-medium transition-colors",
                    alreadyCompleted
                      ? active
                        ? "bg-success/20 text-success ring-2 ring-success/50 font-bold"
                        : "bg-success/12 text-success hover:bg-success/20"
                      : active
                        ? "bg-primary text-primary-foreground"
                        : isDoneStep
                          ? "bg-success/12 text-success"
                          : "bg-muted text-muted-foreground hover:bg-accent",
                  )}
                >
                  {isDoneStep ? <CheckCircle2 className="size-3.5" /> : <Icon className="size-3.5" />}
                  {s.label}
                </button>
              );
            })}
          </div>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {currentIndex + 1}/{steps.length}
          </span>
        </div>
        <Progress value={progressPct} className="h-1.5" />
      </div>

      {/* ---------------------------------------------------------- Conteúdo */}
      {step === "content" ? (
        <article className="space-y-6">
          {/* A situação vem antes de tudo: é ela que organiza a lição, não a regra */}
          {lesson.situation ? (
            <div className="border-primary/25 bg-primary/5 rounded-xl border p-5">
              <p className="text-primary mb-1.5 text-xs font-semibold tracking-wide uppercase">
                A situação
              </p>
              <p className="text-[0.95rem] leading-relaxed">{lesson.situation}</p>
              {lesson.pattern ? (
                <p className="bg-card mt-3 rounded-lg px-3.5 py-2 font-mono text-sm">
                  {lesson.pattern}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Dia 1 do circuito: o texto só destrava depois de 3 escutas.
              Os blocos de dentro do portão vêm em `content.gated`, nunca em
              `content.blocks`: senão a transcrição apareceria antes da escuta. */}
          {lesson.immersion_script ? (
            <ImmersionGate text={lesson.immersion_script}>
              {(lesson.content.gated ?? []).map((block, i) => (
                <LessonBlockView key={i} block={block} />
              ))}
              {!lesson.content.gated?.length ? (
                <div className="bg-muted/50 rounded-xl p-5">
                  <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                    Transcrição
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-line">
                    {lesson.immersion_script.replace(/\s*\/\s*/g, "\n")}
                  </p>
                </div>
              ) : null}
            </ImmersionGate>
          ) : null}

          {lesson.content.warmup ? (
            <div className="bg-muted/50 rounded-xl border-l-3 border-l-primary p-5">
              <p className="text-primary mb-1.5 text-xs font-semibold tracking-wide uppercase">
                Aquecimento · 2 min
              </p>
              <RichText text={lesson.content.warmup} />
            </div>
          ) : null}

          {lesson.grammar_explanation ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className="text-primary size-4" /> Gramática
                  {lesson.grammar_focus ? (
                    <Badge variant="neutral" className="ml-1">
                      {lesson.grammar_focus}
                    </Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RichText text={lesson.grammar_explanation} />
              </CardContent>
            </Card>
          ) : null}

          {(lesson.content.blocks ?? []).map((block, i) => (
            <LessonBlockView key={i} block={block} />
          ))}

          {lesson.listening_script && !lesson.immersion_script ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Volume2 className="size-4" /> Áudio da lição
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <AudioPlayer
                  text={lesson.listening_script}
                  mode="dialogue"
                  label="Diálogo completo"
                />
                <details className="group">
                  {/* py-3 em vez de min-h/inline-flex: mudar o `display` do
                      <summary> apaga o triângulo de "abrir" do navegador. */}
                  <summary className="text-muted-foreground hover:text-foreground -my-1 cursor-pointer py-3 text-xs">
                    Ver a transcrição
                  </summary>
                  <p className="bg-muted/55 mt-2 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-line">
                    {lesson.listening_script.replace(/\s*\/\s*/g, "\n")}
                  </p>
                </details>
              </CardContent>
            </Card>
          ) : null}

          {/* Input autêntico: dia 8, só nas trilhas que o incluem */}
          {lesson.extensions?.authentic_input?.length ? (
            <Card className="border-chart-2/30 bg-chart-2/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Globe className="size-4" /> Inglês de verdade, não de curso
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lesson.extensions.authentic_input.map((item, i) => (
                  <div key={i} className="bg-card rounded-lg border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="neutral" className="text-[10px]">
                        {item.kind}
                      </Badge>
                      <span className="text-sm font-medium">{item.title}</span>
                      <span className="text-muted-foreground text-xs">~{item.minutes} min</span>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{item.why}</p>
                    <p className="bg-muted mt-2 rounded px-2.5 py-1.5 font-mono text-xs">
                      Busque: {item.search}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {/* Conversa ao vivo: dia 11 */}
          {lesson.extensions?.live_prompt ? (
            <Card className="border-primary/25 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-primary flex items-center gap-2 text-sm">
                  <Radio className="size-4" /> Hoje é conversa ao vivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Voz em tempo real com a Emma, no cenário deste circuito. Sem roteiro e sem pausa
                  para pensar.
                </p>
                <Button asChild className="mt-4" variant="gradient">
                  <Link href="/app/ao-vivo">
                    Abrir a sala <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {/* Mentalidade: a trilha que sustenta o hábito */}
          {lesson.mindset_note ? (
            <div className="bg-muted/40 rounded-xl border-l-3 border-l-streak p-5">
              <p className="text-streak mb-1.5 text-xs font-semibold tracking-wide uppercase">
                Mentalidade
              </p>
              <p className="text-sm leading-relaxed">{lesson.mindset_note}</p>
            </div>
          ) : null}

          {lesson.content.summary ? (
            <div className="bg-success/8 border-success/20 rounded-xl border p-5">
              <p className="text-success mb-1.5 text-xs font-semibold tracking-wide uppercase">
                Resumo
              </p>
              <RichText text={lesson.content.summary} />
            </div>
          ) : null}

          {lesson.content.homework ? (
            <div className="rounded-xl border border-dashed p-5">
              <p className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">
                Tarefa de 1 minuto
              </p>
              <RichText text={lesson.content.homework} />
            </div>
          ) : null}

          {!lesson.content.blocks?.length && !lesson.grammar_explanation ? (
            <Card>
              <CardContent className="text-muted-foreground py-10 text-center text-sm">
                O conteúdo desta lição ainda está em preparação.
              </CardContent>
            </Card>
          ) : null}
        </article>
      ) : null}

      {/* ---------------------------------------------------------- Blocos */}
      {step === "vocabulary" ? (
        <div className="space-y-5">
          {lesson.chunks?.length ? (
            <>
              <div className="border-border/70 rounded-xl border border-dashed p-4 text-center">
                <p className="text-sm font-medium">Repita cada bloco 3x em voz alta</p>
                <p className="text-muted-foreground mx-auto mt-1 max-w-md text-xs leading-relaxed">
                  Bloco inteiro, nunca palavra solta. Ouça o modelo, pause, repita. Fala é memória
                  motora: se a boca não faz, não fixa.
                </p>
              </div>

              <div className="space-y-3">
                {lesson.chunks.map((chunk, i) => (
                  <Card key={i} className="card-hover">
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-lg font-semibold">{chunk.en}</span>
                        {chunk.ipa ? (
                          <code className="text-primary bg-primary/8 rounded px-1.5 py-0.5 font-mono text-xs">
                            {chunk.ipa}
                          </code>
                        ) : null}
                      </div>
                      <PronunciationLine text={chunk.en} className="mt-1 text-[0.85rem]" />
                      <p className="text-muted-foreground mt-1 text-sm">{chunk.pt}</p>
                      {chunk.when ? (
                        <p className="text-muted-foreground/80 mt-1 text-xs italic">
                          Quando usar: {chunk.when}
                        </p>
                      ) : null}
                      <AudioPlayer
                        text={chunk.en}
                        mode="single"
                        label="Ouvir e repetir"
                        compact
                        className="mt-3"
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {lesson.vocabulary.map((item, i) => (
              <Card key={i} className="card-hover">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-lg font-semibold">{item.term}</span>
                    {item.ipa ? (
                      <code className="text-primary bg-primary/8 rounded px-1.5 py-0.5 font-mono text-xs">
                        {item.ipa}
                      </code>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">{item.translation}</p>
                  {item.example ? (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-sm font-medium">{item.example}</p>
                      {item.exampleTranslation ? (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {item.exampleTranslation}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>

          {lesson.phrases.length ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Frases prontas para usar hoje</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lesson.phrases.map((phrase, i) => (
                  <div key={i} className="bg-muted/50 rounded-lg px-4 py-3">
                    <p className="text-sm font-medium">{phrase.en}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">{phrase.pt}</p>
                    {phrase.context ? (
                      <p className="text-muted-foreground/80 mt-1 text-[11px] italic">
                        {phrase.context}
                      </p>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* -------------------------------------------------------------- Quiz */}
      {step === "quiz" ? (
        <div className="space-y-5">
          {lesson.quiz.map((question, qi) => {
            const chosen = answers[qi];
            return (
              <Card key={question.id || qi}>
                <CardContent className="p-5">
                  <p className="font-medium">
                    <span className="text-muted-foreground mr-2 text-sm">{qi + 1}.</span>
                    {question.question}
                  </p>

                  <div className="mt-4 space-y-2">
                    {question.options.map((option, oi) => {
                      const selected = chosen === oi;
                      const correct = oi === question.answerIndex;
                      const show = revealed;

                      return (
                        <button
                          key={oi}
                          type="button"
                          disabled={revealed}
                          onClick={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                            show && correct && "border-success bg-success/10",
                            show && selected && !correct && "border-destructive bg-destructive/10",
                            !show && selected && "border-primary bg-primary/8",
                            !show && !selected && "hover:bg-accent",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                              show && correct && "border-success text-success",
                              show && selected && !correct && "border-destructive text-destructive",
                              !show && selected && "border-primary text-primary",
                            )}
                          >
                            {String.fromCharCode(65 + oi)}
                          </span>
                          <span className="leading-relaxed">{option}</span>
                        </button>
                      );
                    })}
                  </div>

                  {revealed && question.explanation ? (
                    <p className="bg-muted/60 mt-3 rounded-lg px-4 py-3 text-sm leading-relaxed">
                      <RichText text={question.explanation} />
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}

          {!revealed ? (
            <Button
              size="lg"
              className="w-full"
              disabled={!allAnswered}
              onClick={() => setRevealed(true)}
            >
              {allAnswered
                ? "Conferir respostas"
                : `Responda todas (${Object.keys(answers).length}/${lesson.quiz.length})`}
            </Button>
          ) : (
            <div className="bg-muted/50 rounded-xl border p-5 text-center">
              <p className="text-3xl font-semibold tabular-nums">{quizScore}%</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {quizScore === 100
                  ? "Gabaritou. Pode seguir tranquilo."
                  : quizScore! >= 66
                    ? "Bom resultado. Reveja as que errou antes de seguir."
                    : "Vale reler a lição antes de avançar."}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* ----------------------------------------------------------- Prática */}
      {step === "practice" && lesson.speaking_prompt ? (
        <div id="pratica" className="scroll-mt-24">
          <PracticeStation
            prompt={lesson.speaking_prompt}
            lessonId={lesson.id}
            rubric={lesson.speaking_rubric}
            initialResult={speakingResult}
            onResultChange={(next) => {
              setSpeakingResult(next);
              if (next) setSpoke(true);
            }}
          />
        </div>
      ) : null}

      {/* -------------------------------------------------------- Navegação */}
      <div className="flex items-center justify-between gap-3 border-t pt-6">
        <Button variant="ghost" onClick={goPrev} disabled={currentIndex === 0}>
          <ArrowLeft className="size-4" /> Anterior
        </Button>

        <div className="flex items-center gap-3">
          {step === "practice" && !spoke ? (
            <span className="text-muted-foreground hidden text-xs sm:inline">
              Grave sua fala antes de concluir
            </span>
          ) : null}
          <Button
            onClick={goNext}
            loading={saving}
            variant={currentIndex === steps.length - 1 ? "success" : "default"}
          >
            {currentIndex === steps.length - 1 ? (
              <>
                {alreadyCompleted ? "Refazer e salvar" : "Concluir lição"}{" "}
                <CheckCircle2 className="size-4" />
              </>
            ) : (
              <>
                Continuar <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
