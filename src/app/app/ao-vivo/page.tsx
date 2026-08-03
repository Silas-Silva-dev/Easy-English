import { Clock, MessageSquare, Radio } from "lucide-react";
import type { Metadata } from "next";

import { LiveRoom } from "@/components/live/live-room";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireActiveUser } from "@/lib/auth/guards";
import { getNextLesson, getOrCreateEnrollment, getPrimaryCourse } from "@/lib/learning";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversa ao vivo" };

export default async function LivePage() {
  const { userId, profile } = await requireActiveUser("/app/ao-vivo");

  const course = await getPrimaryCourse();
  const enrollment = course ? await getOrCreateEnrollment(userId, course) : null;
  const lesson =
    course && enrollment ? await getNextLesson(course.id, enrollment.current_day) : null;

  const supabase = await createServerSupabase();

  const [{ data: history }, { data: circuit }] = await Promise.all([
    supabase
      .from("live_sessions")
      .select("id, scenario, started_at, duration_seconds, turns, summary_pt, scores")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(5),
    lesson?.week_number
      ? supabase
          .from("circuits")
          .select("number, title, situation, live_prompt")
          .eq("number", lesson.week_number)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const totalMinutes = (history ?? []).reduce(
    (sum, s) => sum + Math.round((s.duration_seconds ?? 0) / 60),
    0,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Tutora de IA"
        title="Conversa ao vivo"
        description="Voz em tempo real com a Emma. Sem roteiro, sem legenda, sem pausa para pensar — é o exercício que mais se parece com falar com um americano de verdade."
      />

      {circuit ? (
        <Card className="border-primary/25 bg-primary/4">
          <CardHeader className="pb-2">
            <CardTitle className="text-primary flex items-center gap-2 text-sm">
              <MessageSquare className="size-4" /> Cenário do circuito {circuit.number}
            </CardTitle>
            <CardDescription>{circuit.title}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{circuit.situation}</p>
          </CardContent>
        </Card>
      ) : null}

      <LiveRoom
        lessonId={lesson?.id}
        circuitNumber={lesson?.week_number}
        scenario={circuit?.live_prompt ?? circuit?.situation ?? undefined}
        title={circuit ? `Circuito ${circuit.number} — ${circuit.title}` : "Conversa livre"}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Como aproveitar</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm leading-relaxed">
          <p>
            <strong className="text-foreground">Fale mais que ela.</strong> A Emma foi instruída a
            dar turnos curtos e devolver a palavra. Se você responder em uma palavra, a conversa
            morre — e o tempo de prática é seu, não dela.
          </p>
          <p>
            <strong className="text-foreground">Não peça para desacelerar.</strong> Ela fala na
            velocidade do seu nível. Deixe passar o que não entender e siga: entender 70% e
            continuar vale mais que entender 100% travando.
          </p>
          <p>
            <strong className="text-foreground">Não avaliamos pronúncia aqui.</strong> Esta nota
            olha fluência, gramática, vocabulário e interação — a partir da transcrição. Para
            pronúncia, use a gravação em{" "}
            <span className="text-foreground">Praticar fala</span>, onde a tutora ouve o áudio.
          </p>
        </CardContent>
      </Card>

      {history?.length ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Radio className="size-4" /> Suas conversas
            </CardTitle>
            <Badge variant="neutral">
              <Clock className="size-3" /> {totalMinutes} min no total
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((item) => {
              const scores = item.scores as { overall?: number; interaction?: number } | null;
              return (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-xs">
                        {formatRelative(item.started_at)} ·{" "}
                        {Math.round((item.duration_seconds ?? 0) / 60)} min · {item.turns} falas
                        suas
                      </p>
                    </div>
                    {scores?.overall != null ? (
                      <div className="flex shrink-0 gap-1.5">
                        <Badge
                          variant={
                            scores.overall >= 8
                              ? "success"
                              : scores.overall >= 6
                                ? "warning"
                                : "destructive"
                          }
                        >
                          {Number(scores.overall).toFixed(1)}
                        </Badge>
                        {scores.interaction != null ? (
                          <Badge variant="neutral">
                            interação {Number(scores.interaction).toFixed(1)}
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {item.summary_pt ? (
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                      {item.summary_pt}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-muted-foreground text-center text-xs">
        Nível de fala calibrado para <strong>{profile.target_level}</strong>. Ajuste em{" "}
        <span className="text-foreground">Perfil</span> se a Emma estiver rápida ou lenta demais.
      </p>
    </div>
  );
}
