import { Mic } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { StatCard } from "@/components/ui/stat-card";
import { requireStaff } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Práticas de fala" };

const PAGE_SIZE = 25;

export default async function AdminSpeakingPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;
  await requireStaff("/admin/conversacao");

  const page = Math.max(1, Number(p) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createServerSupabase();

  const [{ data: sessions, count }, { data: aggregate }] = await Promise.all([
    supabase
      .from("speaking_sessions")
      .select(
        "id, prompt, created_at, status, transcript, level, error_message, profiles(full_name, email), speaking_feedback(overall_score, pronunciation_score, fluency_score, grammar_score, vocabulary_score, summary_pt)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
    supabase
      .from("speaking_feedback")
      .select("overall_score, pronunciation_score, fluency_score, grammar_score, vocabulary_score"),
  ]);

  const rows = aggregate ?? [];
  const avg = (key: keyof (typeof rows)[number]) =>
    rows.length ? rows.reduce((sum, r) => sum + Number(r[key]), 0) / rows.length : 0;

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <PageHeader
        eyebrow="Tutora de IA"
        title="Práticas de fala"
        description={`${total} gravação(ões) enviada(s) para correção. Use os agregados para calibrar o currículo.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Nota geral média" value={avg("overall_score").toFixed(1)} tone="primary" />
        <StatCard
          label="Pronúncia"
          value={avg("pronunciation_score").toFixed(1)}
          tone={avg("pronunciation_score") >= 7 ? "success" : "warning"}
        />
        <StatCard
          label="Fluência"
          value={avg("fluency_score").toFixed(1)}
          tone={avg("fluency_score") >= 7 ? "success" : "warning"}
        />
        <StatCard
          label="Gramática"
          value={avg("grammar_score").toFixed(1)}
          tone={avg("grammar_score") >= 7 ? "success" : "warning"}
        />
        <StatCard
          label="Vocabulário"
          value={avg("vocabulary_score").toFixed(1)}
          tone={avg("vocabulary_score") >= 7 ? "success" : "warning"}
        />
      </div>

      {sessions?.length ? (
        <div className="space-y-3">
          {sessions.map((session) => {
            const profile = Array.isArray(session.profiles) ? session.profiles[0] : session.profiles;
            const feedback = Array.isArray(session.speaking_feedback)
              ? session.speaking_feedback[0]
              : session.speaking_feedback;

            return (
              <Card key={session.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {profile?.full_name ?? profile?.email ?? "—"}
                        </span>
                        <Badge variant="neutral" className="text-[10px]">
                          {session.level}
                        </Badge>
                        <Badge
                          variant={
                            session.status === "completed"
                              ? "success"
                              : session.status === "failed"
                                ? "destructive"
                                : "neutral"
                          }
                          className="text-[10px]"
                        >
                          {session.status}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {formatDateTime(session.created_at)}
                        </span>
                      </div>

                      <p className="text-muted-foreground mt-2 text-sm">{session.prompt}</p>

                      {session.transcript ? (
                        <p className="bg-muted/50 mt-2.5 rounded-lg px-3 py-2 text-sm italic">
                          “{session.transcript}”
                        </p>
                      ) : null}

                      {session.error_message ? (
                        <p className="bg-destructive/10 text-destructive mt-2.5 rounded-lg px-3 py-2 text-xs">
                          {session.error_message}
                        </p>
                      ) : null}

                      {feedback?.summary_pt ? (
                        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                          {feedback.summary_pt}
                        </p>
                      ) : null}
                    </div>

                    {feedback ? (
                      // No celular as notas ocupam a linha inteira, abaixo do
                      // texto — antes elas travavam em 189px e espremiam a
                      // transcrição numa tira de ~40px.
                      <div className="grid w-full shrink-0 grid-cols-2 gap-x-5 gap-y-1 text-xs sm:w-auto sm:grid-cols-1">
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Geral</span>
                          <span className="font-semibold tabular-nums">
                            {Number(feedback.overall_score).toFixed(1)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Pronúncia</span>
                          <span className="tabular-nums">
                            {Number(feedback.pronunciation_score).toFixed(1)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Fluência</span>
                          <span className="tabular-nums">
                            {Number(feedback.fluency_score).toFixed(1)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Gramática</span>
                          <span className="tabular-nums">
                            {Number(feedback.grammar_score).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Mic />}
          title="Nenhuma prática registrada"
          description="Assim que os alunos gravarem áudios, as correções aparecem aqui."
        />
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <a
                href={`/admin/conversacao?p=${page - 1}`}
                className="hover:bg-accent inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm transition-colors"
              >
                Anterior
              </a>
            ) : null}
            {page < totalPages ? (
              <a
                href={`/admin/conversacao?p=${page + 1}`}
                className="hover:bg-accent inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm transition-colors"
              >
                Próxima
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
