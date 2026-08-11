import { Brain, Layers, TrendingUp } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/misc";
import { StatCard } from "@/components/ui/stat-card";
import { requireActiveUser } from "@/lib/auth/guards";
import { getOrCreateEnrollment, getPrimaryCourse, getTrack } from "@/lib/learning";
import { sortReviewQueue, type ChunkMastery } from "@/lib/srs";
import { createServerSupabase } from "@/lib/supabase/server";
import { getTodayDateString } from "@/lib/timezones";
import { dayToCircuit } from "@/lib/utils";
import { TOTAL_CIRCUITS, tetoDiarioDaFila } from "@content/curriculum";

import { FilaZerada } from "./fila-zerada";
import { ReviewDeck } from "./review-deck";

export const metadata: Metadata = { title: "Revisão espaçada" };

/**
 * Quanto do teto do dia é reservado aos blocos do circuito corrente.
 *
 * Com teto e fila ordenada por vencimento, os blocos velhos comem o teto
 * inteiro e os blocos NOVOS do circuito corrente não recebem revisão nenhuma:
 * medido em cinco circuitos do Canto 3 recebendo menos de 50% do que deviam,
 * alguns zero. O efeito é que o portão do circuito corrente fica impossível
 * exatamente para quem está atrasado — o oposto do que o teto existe para
 * fazer.
 *
 * 45% e não 100%: a reserva protege o circuito de agora sem transformar a fila
 * numa fila só dele, que é como o acervo antigo seria esquecido.
 */
const RESERVA_DO_CIRCUITO = 0.45;

export default async function ReviewPage() {
  const { userId, profile } = await requireActiveUser("/app/revisao");

  const course = await getPrimaryCourse();
  const enrollment = course ? await getOrCreateEnrollment(userId, course) : null;
  const track = getTrack(enrollment?.track ?? "complete");

  const supabase = await createServerSupabase();
  // O dia no fuso do perfil — e é o mesmo dia que o BANCO agora escreve:
  // `review_chunk` agenda com `today_for(auth.uid())` e `enroll_circuit_chunks`
  // estreia o bloco com a mesma função (migration 1400). Enquanto o banco
  // usava `current_date` cru, esta linha e a agenda discordavam das 21h à
  // meia-noite: a tela não achava cartão nenhum, a fila parecia zerada, e o
  // portão da Essencial ganhava um "dia com a fila zerada" sem uma resposta.
  const today = getTodayDateString(profile.timezone);

  // O circuito corrente sai do dia da matrícula pela mesma conta do resto do
  // app (`dayToCircuit`). Preso na faixa porque o dia 0 de uma matrícula recém
  // criada devolveria circuito 0, e não existe teto para o canto 0.
  const circuitoCorrente = Math.min(
    TOTAL_CIRCUITS,
    Math.max(1, dayToCircuit(enrollment?.current_day ?? 1).circuit),
  );

  const [{ data: due }, { data: stats }] = await Promise.all([
    supabase
      .from("chunk_mastery")
      .select("*")
      .eq("user_id", userId)
      // Sanguessuga não é cartão: 8 lapsos tiraram o bloco da agenda, e ele
      // volta pela lição. Enquanto ele vinha na consulta, ocupava lugar no teto
      // e ainda aparecia primeiro na ordenação.
      .is("suspended_at", null)
      .lte("due_date", today)
      .order("due_date")
      // Era 200, e 200 virava o teto REAL assim que o atraso passava disso: a
      // reserva abaixo seria calculada sobre os 200 mais antigos, que é
      // precisamente onde os blocos do circuito corrente NÃO estão. O acervo
      // inteiro do curso são 1.193 blocos, então este limite não corta ninguém.
      .limit(1200),
    supabase.from("chunk_review_queue").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const teto = tetoDiarioDaFila(track.id, circuitoCorrente);

  const vencidos = sortReviewQueue((due ?? []) as ChunkMastery[]);
  const reservada = vencidos.filter((c) => c.circuit_number === circuitoCorrente);
  const geral = vencidos.filter((c) => c.circuit_number !== circuitoCorrente);

  // Teto nenhum é desperdiçado nas duas direções: a reserva não usada volta
  // para a geral, e a geral que não tem itens devolve o lugar para a reserva.
  const cota = Math.min(reservada.length, Math.floor(teto * RESERVA_DO_CIRCUITO));
  const daGeral = geral.slice(0, teto - cota);
  const queue = [...reservada.slice(0, teto - daGeral.length), ...daGeral];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Memória"
        title="Revisão espaçada"
        description="Só os blocos que venceram hoje na SUA agenda. A sessão tem um teto: o que não coube volta amanhã, e o circuito que você está fazendo agora tem lugar garantido dentro dele."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Vencendo hoje"
          value={stats?.due_today ?? 0}
          hint={`${queue.length} nesta sessão · teto de ${teto}`}
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
          // O rótulo não promete mais fila preferencial: travado deixou de vir
          // primeiro, e o lapso agora desce a cada 3 acertos seguidos.
          hint={`3+ esquecimentos · ${stats?.suspended ?? 0} fora da fila`}
          icon={<TrendingUp />}
          tone={(stats?.struggling ?? 0) > 0 ? "destructive" : "neutral"}
        />
      </div>

      {/* Dia sem fila vencida conta como zerado: é o sinal que os 48 portões da
          Essencial leem, e ele não passa pelo baralho porque não há cartão
          nenhum para responder. */}
      {queue.length === 0 ? <FilaZerada /> : null}

      <ReviewDeck chunks={queue} track={track.id} />
    </div>
  );
}
