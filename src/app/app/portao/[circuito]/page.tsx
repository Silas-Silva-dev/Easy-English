import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PainelDoPortao } from "@/components/portao/painel-do-portao";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireActiveUser } from "@/lib/auth/guards";
import { getOrCreateEnrollment, getPrimaryCourse, getTrack } from "@/lib/learning";
import { createServerSupabase } from "@/lib/supabase/server";
import { CIRCUITS, DAYS_PER_CIRCUIT } from "@content/curriculum";

interface Params {
  params: Promise<{ circuito: string }>;
}

/**
 * A tela do portão de um circuito.
 *
 * Rota própria, e não um pedaço do cronograma, por duas razões concretas:
 *
 *   1. `evaluate_circuit_gate` ESCREVE (`circuit_gate_status`) e roda meia
 *      dúzia de contagens sobre `lesson_progress`, `study_days` e
 *      `chunk_mastery`. Pendurar isso no cronograma faria toda visita ao
 *      calendário pagar o diagnóstico dos 13 circuitos do canto.
 *   2. O portão é de UM circuito. A página do Canto cobre treze, e o
 *      cronograma abre um por vez — nenhum dos dois tem onde colocar seis
 *      linhas de critério sem empurrar as lições para fora da primeira tela do
 *      celular.
 *
 * A página do Canto ganhou o atalho que leva até aqui (`AtalhoDoPortao`), com
 * a última avaliação já gravada: é ele que resolve a descoberta sem cobrar a
 * conta de quem só queria ver o calendário.
 */

/** Os quatro cantos, pela faixa de circuitos. Mesma divisão da lição. */
function cantoDoCircuito(n: number): { code: string; label: string } {
  if (n <= 13) return { code: "c1", label: "Canto 1: Destravar" };
  if (n <= 26) return { code: "c2", label: "Canto 2: Contar" };
  if (n <= 39) return { code: "c3", label: "Canto 3: Resolver" };
  return { code: "c4", label: "Canto 4: Soar natural" };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { circuito } = await params;
  return { title: `Portão do circuito ${circuito}` };
}

export default async function PortaoPage({ params }: Params) {
  const { circuito: bruto } = await params;
  const circuito = Number(bruto);

  if (!Number.isInteger(circuito) || circuito < 1 || circuito > CIRCUITS.length) notFound();

  const { userId } = await requireActiveUser(`/app/portao/${bruto}`);

  const course = await getPrimaryCourse();
  if (!course) {
    return <EmptyState title="Nenhum curso publicado" description="Volte em breve." />;
  }

  const enrollment = await getOrCreateEnrollment(userId, course);
  if (!enrollment) {
    return <EmptyState title="Matrícula não encontrada" description="Volte em breve." />;
  }

  const supabase = await createServerSupabase();

  const [{ data: gate }, { data: status, error }, { data: circuitRow }] = await Promise.all([
    // O critério semeado. Vem junto porque a avaliação não repete o número do
    // circuito atrasado nem quantas repetições cada bloco precisa: sem esta
    // linha a tela mostraria "Blocos do circuito" sem o circuito.
    supabase
      .from("circuit_gates")
      .select("components, prose")
      .eq("track", enrollment.track)
      .eq("circuit_number", circuito)
      .maybeSingle(),
    supabase.rpc("evaluate_circuit_gate", {
      p_course_id: course.id,
      p_circuit_number: circuito,
    }),
    supabase
      .from("circuits")
      .select("title, situation")
      .eq("course_id", course.id)
      .eq("number", circuito)
      .maybeSingle(),
  ]);

  const canto = cantoDoCircuito(circuito);
  const primeiroDia = (circuito - 1) * DAYS_PER_CIRCUIT + 1;
  const ultimoDia = circuito * DAYS_PER_CIRCUIT;

  const voltar = (
    <Button asChild variant="outline" size="sm">
      <Link href={`/app/canto/${canto.code}?circuito=${circuito}`}>
        <ArrowLeft className="size-4" /> {canto.label}
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Portão da quinzena"
        title={circuitRow?.title ? `Circuito ${circuito}: ${circuitRow.title}` : `Circuito ${circuito}`}
        description={`Dias ${primeiroDia} a ${ultimoDia}. O que a quinzena mede, o que você já cumpriu e o que falta.`}
        action={voltar}
      />

      {status && !error ? (
        <PainelDoPortao
          circuito={circuito}
          trilha={getTrack(enrollment.track).label}
          passou={status.passed}
          avaliadoEm={status.evaluated_at}
          especificacao={gate?.components ?? []}
          avaliacao={status.components ?? []}
          prosa={gate?.prose ?? ""}
        />
      ) : (
        /**
         * A RPC levanta exceção quando o portão desta trilha não foi semeado —
         * é a única falha esperada aqui, e ela é de instalação, não do aluno.
         * Mostrar a tela vazia sem dizer o motivo faria parecer que o circuito
         * não tem critério nenhum, que é o oposto do que acontece.
         */
        <EmptyState
          title="Este portão ainda não foi publicado"
          description="O critério deste circuito não está no banco para a sua trilha. Quem administra o curso resolve isso rodando npm run seed:curriculum."
        />
      )}
    </div>
  );
}
