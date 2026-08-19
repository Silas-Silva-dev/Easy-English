import { ArrowLeft, Clock, Radio } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireActiveUser } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Histórico de conversas" };

/**
 * O registro das conversas com a Emma.
 *
 * Morava dentro da sala de voz, entre o botão de chamar e o rodapé — cinco
 * cartões com nota, resumo e duração, empurrando para baixo a única coisa que
 * aquela tela precisa ter. Aqui ele cabe inteiro e sem pressa: são vinte, não
 * cinco, porque quem abre o histórico quer o histórico.
 */
export default async function LiveHistoryPage() {
  const { userId } = await requireActiveUser("/app/ao-vivo/historico");

  const supabase = await createServerSupabase();
  const { data: history } = await supabase
    .from("live_sessions")
    .select(
      "id, scenario, started_at, duration_seconds, turns, summary_pt, scores",
    )
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(20);

  const sessoes = history ?? [];
  const minutos = sessoes.reduce(
    (s, x) => s + Math.round((x.duration_seconds ?? 0) / 60),
    0,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/app/ao-vivo"
        className="text-muted-foreground hover:text-foreground -ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-sm transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Voltar para a sala
      </Link>

      <PageHeader
        eyebrow="Conversa ao vivo"
        title="Suas conversas"
        description={
          sessoes.length
            ? `${sessoes.length} conversa(s) · ${minutos} min falando inglês com a Emma.`
            : undefined
        }
      />

      {sessoes.length ? (
        <div className="space-y-3">
          {sessoes.map((item) => {
            const scores = item.scores as {
              overall?: number;
              interaction?: number;
            } | null;
            return (
              <Card key={item.id}>
                <CardContent className="pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-muted-foreground text-xs">
                      {formatRelative(item.started_at)} ·{" "}
                      {Math.round((item.duration_seconds ?? 0) / 60)} min ·{" "}
                      {item.turns} falas suas
                    </p>
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
                    <p className="text-muted-foreground mt-2.5 text-sm leading-relaxed">
                      {item.summary_pt}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Radio />}
          title="Nenhuma conversa ainda"
          description="Quando você falar com a Emma, cada conversa fica registrada aqui com a nota e o resumo do que ela observou."
          action={
            <Link
              href="/app/ao-vivo"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium transition-colors"
            >
              <Clock className="size-4" /> Falar agora
            </Link>
          }
        />
      )}
    </div>
  );
}
