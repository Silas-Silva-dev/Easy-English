import { Clock, MessageSquare, Radio } from "lucide-react";
import type { Metadata } from "next";

import { LiveRoom } from "@/components/live/live-room";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireActiveUser } from "@/lib/auth/guards";
import {
  getNextLesson,
  getOrCreateEnrollment,
  getPrimaryCourse,
} from "@/lib/learning";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversa ao vivo" };

export default async function LivePage() {
  const { userId, profile } = await requireActiveUser("/app/ao-vivo");

  const course = await getPrimaryCourse();
  const enrollment = course
    ? await getOrCreateEnrollment(userId, course)
    : null;
  const lesson =
    course && enrollment
      ? await getNextLesson(course.id, enrollment.current_day)
      : null;

  const supabase = await createServerSupabase();

  const [{ data: history }, { data: circuit }] = await Promise.all([
    supabase
      .from("live_sessions")
      .select(
        "id, scenario, started_at, duration_seconds, turns, summary_pt, scores",
      )
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
        description="Voz em tempo real com a Emma. No modo Professora ela dá aula: abre em português dizendo o que vocês vão praticar hoje, ensina cada expressão com significado e pronúncia, e corrige o que sair errado. Se quiser só conversar, é um botão."
      />

      {circuit ? (
        <Card className="border-primary/25 bg-primary/4">
          <CardHeader className="pb-2">
            <CardTitle className="text-primary flex items-center gap-2 text-sm">
              <MessageSquare className="size-4" /> Cenário do circuito{" "}
              {circuit.number}
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
        title={
          circuit
            ? `Circuito ${circuit.number}: ${circuit.title}`
            : "Conversa livre"
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Como aproveitar</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm leading-relaxed">
          <p>
            <strong className="text-foreground">Fale mais que ela.</strong> A
            Emma foi instruída a dar turnos curtos e devolver a palavra. Se você
            responder em uma palavra, a conversa morre: e o tempo de prática é
            seu, não dela.
          </p>
          <p>
            <strong className="text-foreground">Pergunte à vontade.</strong> “O
            que significa isso?”, “como se fala essa palavra?”, “por que não
            pode dizer assim?” — pergunte em português, no meio da conversa. Ela
            responde em português e volta para o inglês. No modo Professora, a
            pergunta é a melhor parte da aula, não uma interrupção.
          </p>
          <p>
            <strong className="text-foreground">
              Ela sabe onde você está.
            </strong>{" "}
            A Emma recebe o circuito, o dia e o seu nível antes de abrir a boca
            — não precisa te testar. No começo do curso ela conduz em português
            e o inglês é o que se pratica; conforme os cantos avançam, o
            português vai saindo até sobrar só o inglês.
          </p>
          <p>
            <strong className="text-foreground">Você manda no modo.</strong> Em{" "}
            <span className="text-foreground">Professora</span> ela abre dizendo
            o que vocês vão treinar, ensina expressão por expressão e corrige.
            Diga <em>“vamos só conversar agora”</em> no meio da fala e ela para
            de corrigir; diga <em>“volta a corrigir”</em> e ela retoma. O botão
            abaixo do cronômetro faz o mesmo.
          </p>
          <p>
            <strong className="text-foreground">
              A correção de pronúncia é ao vivo; a nota, não.
            </strong>{" "}
            Aqui a Emma ouve sua voz de verdade e corrige o som na hora. Já a
            nota do fim sai da transcrição, então mede fluência, gramática,
            vocabulário e interação. Para pronúncia com nota, use a gravação em{" "}
            <span className="text-foreground">Praticar fala</span>.
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
              const scores = item.scores as {
                overall?: number;
                interaction?: number;
              } | null;
              return (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-xs">
                        {formatRelative(item.started_at)} ·{" "}
                        {Math.round((item.duration_seconds ?? 0) / 60)} min ·{" "}
                        {item.turns} falas suas
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

      {/* O nível que a Emma usa é o da LIÇÃO, não a meta do perfil: `target_level`
          é onde o aluno quer chegar e vem com B1 por padrão, o que colocava um
          iniciante do circuito 1 recebendo aula em ritmo B1 no primeiro dia. */}
      <p className="text-muted-foreground text-center text-xs">
        A Emma está calibrada para{" "}
        <strong>{lesson?.level ?? profile.target_level}</strong>, que é o nível
        do dia {lesson?.day_number ?? 1} do curso — não uma meta de perfil. Ele
        sobe sozinho conforme você avança.
      </p>
    </div>
  );
}
