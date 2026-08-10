import { History, Mic } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PracticeStation } from "@/components/speaking/practice-station";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireActiveUser } from "@/lib/auth/guards";
import { getNextLesson, getOrCreateEnrollment, getPrimaryCourse } from "@/lib/learning";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Praticar fala" };

/** Status da sessão em português: o enum do banco é interno, não vira UI. */
const SESSION_STATUS: Record<string, string> = {
  uploaded: "Enviado",
  processing: "Analisando…",
  completed: "Concluído",
  failed: "Falhou",
};

/**
 * Cenários de prática livre, do mais simples ao mais exigente.
 *
 * O enunciado vai em PORTUGUÊS: quem está no A1 não consegue ler a tarefa em
 * inglês, e uma tarefa que o aluno não entendeu ele cumpre errado: a nota cai
 * por um motivo que não tem nada a ver com o inglês dele. O que ele grava,
 * esse sim, é em inglês.
 */
const FREE_PROMPTS = [
  {
    level: "A1",
    prompt:
      "Apresente-se em inglês: diga seu nome, de onde você é, o que você faz e uma coisa que você gosta de fazer.",
    help: "Use os blocos do circuito 1 e 2. Frases curtas bastam: ninguém espera parágrafo.",
  },
  {
    level: "A2",
    prompt:
      "Conte em inglês o que você fez no fim de semana passado: aonde você foi, com quem estava e como foi.",
    help: "Use o passado simples. Não se preocupe se errar um verbo irregular.",
  },
  {
    level: "B1",
    prompt:
      "Você prefere trabalhar de casa ou do escritório? Responda em inglês, dando sua opinião e duas razões.",
    help: "Estruture: opinião → razão 1 → razão 2 → conclusão.",
  },
  {
    level: "B2",
    prompt:
      "Descreva em inglês uma decisão difícil que você teve de tomar. O que você faria diferente hoje?",
    help: "Boa chance de usar condicionais e 'should have'.",
  },
];

export default async function ConversationPage({
  searchParams,
}: {
  searchParams: Promise<{ cenario?: string }>;
}) {
  const { cenario } = await searchParams;
  const { userId, profile } = await requireActiveUser("/app/conversacao");

  const course = await getPrimaryCourse();
  const enrollment = course ? await getOrCreateEnrollment(userId, course) : null;
  const todayLesson =
    course && enrollment ? await getNextLesson(course.id, enrollment.current_day) : null;

  const supabase = await createServerSupabase();
  const { data: history } = await supabase
    .from("speaking_sessions")
    .select("id, prompt, created_at, status, speaking_feedback(overall_score)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(6);

  const index = Number(cenario);
  const selected =
    Number.isInteger(index) && FREE_PROMPTS[index]
      ? FREE_PROMPTS[index]
      : (FREE_PROMPTS.find((p) => p.level === profile.target_level) ?? FREE_PROMPTS[0]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        eyebrow="Tutora de IA"
        title="Praticar fala"
        description="Grave sua resposta em inglês e receba, em segundos, a transcrição do que você realmente disse, as correções de pronúncia e o que treinar em seguida."
      />

      {/* --------------------------------------------- Atalho para a lição */}
      {todayLesson?.speaking_prompt ? (
        <Card className="border-primary/25 bg-primary/4">
          <CardHeader className="pb-2">
            <CardTitle className="text-primary flex items-center gap-2 text-sm">
              <Mic className="size-4" /> Desafio da lição de hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{todayLesson.title}</p>
              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">
                {todayLesson.speaking_prompt}
              </p>
            </div>
            <Link
              href={`/app/licao/${todayLesson.day_number}#pratica`}
              className="text-primary inline-flex min-h-10 shrink-0 items-center text-sm font-medium hover:underline"
            >
              Ir para a lição →
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {/* ---------------------------------------------- Escolha de cenário */}
      <div>
        <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
          Escolha um cenário de prática livre
        </p>
        <div className="flex flex-wrap gap-2">
          {FREE_PROMPTS.map((item, i) => (
            <Link
              key={item.level}
              href={`/app/conversacao?cenario=${i}`}
              scroll={false}
              className={
                // min-h-10: A1 e A2 ficam adjacentes; com 28px o dedo troca o
                // cenário inteiro por engano.
                item.prompt === selected.prompt
                  ? "bg-primary text-primary-foreground inline-flex min-h-10 max-sm:min-h-11 items-center rounded-full px-4 max-sm:px-5 text-xs max-sm:text-sm font-medium"
                  : "bg-muted text-muted-foreground hover:bg-accent inline-flex min-h-10 max-sm:min-h-11 items-center rounded-full px-4 max-sm:px-5 text-xs max-sm:text-sm font-medium transition-colors"
              }
            >
              {item.level}
            </Link>
          ))}
        </div>
      </div>

      <PracticeStation prompt={selected.prompt} promptHelp={selected.help} />

      {/* ---------------------------------------------------- Histórico */}
      {history?.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <History className="size-4" /> Suas últimas práticas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((item) => {
              const feedback = Array.isArray(item.speaking_feedback)
                ? item.speaking_feedback[0]
                : item.speaking_feedback;
              return (
                <div
                  key={item.id}
                  className="space-y-2 rounded-lg border px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.prompt}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {formatRelative(item.created_at)}
                      </p>
                    </div>
                    {feedback?.overall_score != null ? (
                      <Badge
                        variant={
                          feedback.overall_score >= 8
                            ? "success"
                            : feedback.overall_score >= 6
                              ? "warning"
                              : "destructive"
                        }
                      >
                        {Number(feedback.overall_score).toFixed(1)}
                      </Badge>
                    ) : (
                      <Badge variant={item.status === "failed" ? "destructive" : "neutral"}>
                        {SESSION_STATUS[item.status] ?? item.status}
                      </Badge>
                    )}
                  </div>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio
                    src={`/api/speaking/audio?sessionId=${item.id}`}
                    controls
                    className="w-full pt-1"
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
