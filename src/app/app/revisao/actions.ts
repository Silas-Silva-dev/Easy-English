"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";
import { gradeFromRecall } from "@/lib/srs";
import { getTodayDateString } from "@/lib/timezones";

type ClienteDoAluno = Awaited<ReturnType<typeof createServerSupabase>>;

const reviewSchema = z.object({
  chunkKey: z.string().min(1).max(200),
  result: z.enum(["instant", "hesitant", "failed"]),
});

/**
 * Sobrou algum bloco vencido hoje na agenda do aluno?
 *
 * A conta é do SERVIDOR de propósito. O cliente sabe quantos cartões RECEBEU,
 * não quantos venceram, e com o teto diário os dois números são diferentes por
 * construção: quem tem 300 itens atrasados zeraria o dia respondendo 27.
 *
 * O dia vem do fuso do perfil, que é o mesmo que `mark_queue_cleared` usa via
 * `safe_timezone` e o mesmo que o banco passou a escrever em `due_date` (ver
 * `today_for`, migration 1400). As três pontas precisam concordar: enquanto a
 * agenda era gravada em UTC e lida em fuso local, das 21h à meia-noite a fila
 * parecia zerada com cartões vencidos dentro dela.
 *
 * Suspensos ficam de fora porque saíram da fila: um bloco sanguessuga impediria
 * o dia de fechar para sempre.
 */
async function filaVencidaZerada(
  supabase: ClienteDoAluno,
  userId: string,
  timezone: string | null,
): Promise<boolean> {
  const [{ count: vencidos, error: erroVencidos }, { count: agenda, error: erroAgenda }] =
    await Promise.all([
      supabase
        .from("chunk_mastery")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("suspended_at", null)
        .lte("due_date", getTodayDateString(timezone ?? undefined)),
      // Quem não tem agenda não tem fila zerada: tem fila nenhuma. Sem esta
      // segunda contagem, um aluno que nunca concluiu lição alguma abria
      // /app/revisao e gravava "dia com a fila zerada" — um sinal de disciplina
      // emitido por quem ainda não recebeu um bloco.
      supabase
        .from("chunk_mastery")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

  // Erro de leitura não é dia zerado: marcar aqui inventaria presença.
  if (erroVencidos || erroAgenda) return false;
  return (agenda ?? 0) > 0 && (vencidos ?? 0) === 0;
}

/**
 * Marca o dia como "fila zerada": o sinal que os portões da Essencial leem.
 *
 * Os 48 portões não-fechamento da Essencial pedem "10 dos 14 dias com a fila
 * zerada", e a prosa dos 52 é explícita — um dia SEM fila vencida conta como
 * zerado. Sem isso o aluno que estava em dia era lido como quem não estudou, e
 * a única trilha que não grava nem mede escuta ficava sem sinal nenhum para
 * medir.
 *
 * A action confere antes de gravar, então é segura de chamar de qualquer lugar:
 * quem chama não precisa saber o estado da agenda, e chamar duas vezes no mesmo
 * dia grava a mesma linha (`on conflict do update` na RPC).
 */
export async function marcarFilaZeradaAction(): Promise<{
  ok: boolean;
  zerada: boolean;
  error?: string;
}> {
  const session = await getSessionContext();
  if (!session) return { ok: false, zerada: false, error: "Não autenticado" };

  const supabase = await createServerSupabase();
  if (!(await filaVencidaZerada(supabase, session.userId, session.profile.timezone))) {
    return { ok: true, zerada: false };
  }

  const { error } = await supabase.rpc("mark_queue_cleared");
  if (error) return { ok: false, zerada: false, error: error.message };

  return { ok: true, zerada: true };
}

/**
 * Registra uma revisão e devolve o novo intervalo, para a UI mostrar na hora.
 *
 * O dia é marcado como zerado AQUI, e não no fim do baralho, porque é aqui que
 * a fila muda: o cartão respondido sai do vencido (mesmo o errado, que volta só
 * amanhã), e quando ele era o último o dia fechou. A tela não tem como saber
 * disso — o baralho dela é o teto do dia, não a fila inteira —, e o efeito
 * precisa acontecer mesmo se o aluno fechar a aba antes da tela de fechamento.
 */
export async function reviewChunkAction(input: {
  chunkKey: string;
  result: "instant" | "hesitant" | "failed";
}): Promise<{
  ok: boolean;
  error?: string;
  intervalDays?: number;
  dueDate?: string;
  filaZerada?: boolean;
}> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const session = await getSessionContext();
  if (!session) return { ok: false, error: "Não autenticado" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("review_chunk", {
    p_chunk_key: parsed.data.chunkKey,
    p_grade: gradeFromRecall(parsed.data.result),
  });

  if (error) return { ok: false, error: error.message };

  let filaZerada = false;
  if (await filaVencidaZerada(supabase, session.userId, session.profile.timezone)) {
    const { error: sinal } = await supabase.rpc("mark_queue_cleared");
    // O sinal do portão não pode derrubar a revisão que já foi gravada.
    if (sinal) console.error("[revisao] mark_queue_cleared:", sinal.message);
    else filaZerada = true;
  }

  return {
    ok: true,
    intervalDays: data?.interval_days ?? 1,
    dueDate: data?.due_date ?? undefined,
    filaZerada,
  };
}

/**
 * Matricula os blocos de um circuito na agenda do aluno.
 *
 * `p_track` NÃO pode faltar: a RPC assume 'complete' quando ele não vem, e a
 * Essencial receberia os 1.193 blocos do curso em vez dos 359 do núcleo — a
 * fila dela estoura em três meses com 9 cartões por dia de orçamento, que é
 * exatamente o defeito que o recorte por trilha existe para consertar. E como
 * a matrícula do bloco é `on conflict do nothing`, uma única chamada sem a
 * trilha deixa a linha errada gravada para sempre.
 */
export async function enrollCircuitAction(
  courseId: string,
  circuitNumber: number,
): Promise<{ ok: boolean; added?: number; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { ok: false, error: "Não autenticado" };

  const supabase = await createServerSupabase();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("track")
    .eq("user_id", session.userId)
    .eq("course_id", courseId)
    .maybeSingle();

  const { data, error } = await supabase.rpc("enroll_circuit_chunks", {
    p_course_id: courseId,
    p_circuit_number: circuitNumber,
    p_track: enrollment?.track ?? "complete",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/revisao");
  return { ok: true, added: data ?? 0 };
}

/** Marca blocos como produzidos em voz alta. */
export async function markSpokenAction(chunkKeys: string[]): Promise<{ ok: boolean }> {
  const session = await getSessionContext();
  if (!session || !chunkKeys.length) return { ok: false };

  const supabase = await createServerSupabase();
  await supabase.rpc("mark_chunks_spoken", { p_chunk_keys: chunkKeys.slice(0, 100) });

  revalidatePath("/app/revisao");
  return { ok: true };
}
