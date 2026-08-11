import type { Metadata } from "next";

import SchedulePage from "@/app/app/cronograma/page";
import { AtalhoDoPortao } from "@/components/portao/painel-do-portao";
import { requireActiveUser } from "@/lib/auth/guards";
import { getOrCreateEnrollment, getPrimaryCourse } from "@/lib/learning";
import { createServerSupabase } from "@/lib/supabase/server";
import { DAYS_PER_CIRCUIT } from "@content/curriculum";

const CANTO_TITLES: Record<string, string> = {
  c1: "Canto 1: Destravar",
  c2: "Canto 2: Contar",
  c3: "Canto 3: Resolver",
  c4: "Canto 4: Soar natural",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const lower = code.toLowerCase();
  const title = CANTO_TITLES[lower] ?? `Canto ${code.toUpperCase()}`;
  return { title };
}

export default async function CantoPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ circuito?: string }>;
}) {
  const { code } = await params;
  const { circuito } = await searchParams;

  const course = await getPrimaryCourse();
  if (!course) {
    return SchedulePage({ searchParams: Promise.resolve({ circuito }) });
  }

  // O guarda roda aqui também, e não só dentro do cronograma: esta página
  // consulta a matrícula e a avaliação do portão antes de delegar, e sem
  // sessão nenhuma das duas tem dono.
  const { userId } = await requireActiveUser(`/app/canto/${code}`);

  const supabase = await createServerSupabase();
  const upperCode = code.toUpperCase();

  const [{ data: module }, enrollment] = await Promise.all([
    supabase
      .from("modules")
      .select("id, week_start, week_end")
      .eq("course_id", course.id)
      .ilike("code", upperCode)
      .maybeSingle(),
    getOrCreateEnrollment(userId, course),
  ]);

  /**
   * O circuito em foco: o pedido na URL, senão o circuito atual do aluno,
   * senão o primeiro do canto. É a mesma ordem que o cronograma usa para
   * decidir qual acordeão abre — se as duas divergissem, o atalho do portão
   * apontaria para um circuito e a lista abriria outro.
   */
  const pedido = Number(circuito);
  const atual = Math.ceil((enrollment?.current_day ?? 1) / DAYS_PER_CIRCUIT);
  const dentro = (n: number) =>
    module != null && Number.isInteger(n) && n >= module.week_start && n <= module.week_end;

  const foco = dentro(pedido) ? pedido : dentro(atual) ? atual : (module?.week_start ?? null);

  // A última avaliação já gravada, se houver. Ler é barato; avaliar de novo
  // não é, e quem abre o canto está olhando o calendário, não pedindo o
  // diagnóstico — a avaliação acontece na tela do portão.
  const { data: portao } = foco
    ? await supabase
        .from("circuit_gate_status")
        .select("passed, evaluated_at, components")
        .eq("user_id", userId)
        .eq("circuit_number", foco)
        .maybeSingle()
    : { data: null };

  const cronograma = await SchedulePage({
    searchParams: Promise.resolve({ modulo: module?.id ?? undefined, circuito }),
  });

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      {foco ? <AtalhoDoPortao circuito={foco} status={portao} /> : null}
      {cronograma}
    </div>
  );
}
