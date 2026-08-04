import { Brain, Layers, TrendingUp } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/misc";
import { StatCard } from "@/components/ui/stat-card";
import { requireActiveUser } from "@/lib/auth/guards";
import { getOrCreateEnrollment, getPrimaryCourse, getTrack } from "@/lib/learning";
import { reviewBatchSize, sortReviewQueue, type ChunkMastery } from "@/lib/srs";
import { createServerSupabase } from "@/lib/supabase/server";

import { ReviewDeck } from "./review-deck";

export const metadata: Metadata = { title: "Revisão espaçada" };

export default async function ReviewPage() {
  const { userId } = await requireActiveUser("/app/revisao");

  const course = await getPrimaryCourse();
  const enrollment = course ? await getOrCreateEnrollment(userId, course) : null;
  const track = getTrack(enrollment?.track ?? "complete");

  const supabase = await createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: due }, { data: stats }] = await Promise.all([
    supabase
      .from("chunk_mastery")
      .select("*")
      .eq("user_id", userId)
      .lte("due_date", today)
      .order("due_date")
      .limit(200),
    supabase.from("chunk_review_queue").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const queue = sortReviewQueue((due ?? []) as ChunkMastery[]).slice(
    0,
    reviewBatchSize(track.dailyMinutes >= 60 ? 15 : 10),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Memória"
        title="Revisão espaçada"
        description="Só os blocos que venceram hoje na SUA agenda. Cada um volta no intervalo em que você está prestes a esquecer: que é onde a revisão vale mais."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Vencendo hoje"
          value={stats?.due_today ?? 0}
          hint={`${queue.length} nesta sessão`}
          icon={<Brain />}
          tone={(stats?.due_today ?? 0) > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Blocos na agenda"
          value={stats?.total_chunks ?? 0}
          hint={`${stats?.mastered ?? 0} dominados`}
          icon={<Layers />}
        />
        <StatCard
          label="Travados"
          value={stats?.struggling ?? 0}
          hint="3+ esquecimentos: vêm primeiro"
          icon={<TrendingUp />}
          tone={(stats?.struggling ?? 0) > 0 ? "destructive" : "neutral"}
        />
      </div>

      <ReviewDeck chunks={queue} />
    </div>
  );
}
