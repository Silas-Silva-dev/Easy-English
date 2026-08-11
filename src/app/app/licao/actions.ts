"use server";

import { z } from "zod";

import { getSessionContext } from "@/lib/auth/guards";
import { chaveDaPeca } from "@/lib/exposicao";
import { getLessonByDay, getPrimaryCourse } from "@/lib/learning";
import { createServerSupabase } from "@/lib/supabase/server";
import type { LessonBlock } from "@/lib/types/database";

/**
 * O portão de escuta, do lado do servidor.
 *
 * ===========================================================================
 * POR QUE O TEXTO TRAVADO NÃO VIAJA JUNTO COM A PÁGINA
 * ===========================================================================
 * Até aqui `content.gated` ia inteiro no payload da lição e o React apenas
 * deixava de renderizar. Quem abrisse o inspetor — ou lesse o view-source, ou
 * olhasse o RSC payload — tinha a transcrição completa antes da primeira
 * escuta. O portão era decoração, e o diagnóstico do próprio curso diz que ler
 * antes de ouvir instala fonema português sobre grafia inglesa, e que desfazer
 * isso custa caro.
 *
 * Agora o servidor manda a lição SEM o texto travado, e é esta ação que
 * devolve os blocos — só depois que `count_listen` disse que a exposição
 * abriu. O texto chega ao navegador uma única vez, e no momento certo.
 *
 * ===========================================================================
 * POR QUE O CLIENTE NÃO DIZ QUANTAS ESCUTAS FALTAM
 * ===========================================================================
 * `count_listen` não aceita o número de escutas exigidas como parâmetro: ele
 * sai de `public.required_plays(circuito)`, e o circuito sai da própria chave.
 * Um cliente hostil que chamasse esta ação com o corpo adulterado não
 * conseguiria abrir nada mais cedo — só contaria uma escuta que talvez não
 * tenha acontecido, e a RPC ainda ignora chamadas dentro da janela do áudio.
 */

const contarSchema = z.object({
  day: z.number().int().min(1).max(728),
  key: z.string().min(1).max(200),
  /**
   * Aceito e IGNORADO — o player ainda o manda, mas ele não decide nada.
   *
   * A janela que impede a mesma passada valer duas vezes é calculada no
   * servidor, a partir do roteiro (`janelaDoRoteiro`). Enquanto ela vinha
   * daqui, o freio da RPC era `greatest(p_min_seconds, 5)` — um piso sobre um
   * número escolhido pelo cliente —, e quatro chamadas com `seconds: 0` a cada
   * seis segundos derrubavam o portão do dia 1 em dezoito segundos.
   */
  seconds: z.number().min(0).max(3600).optional(),
});

export interface RespostaDeEscuta {
  ok: boolean;
  escutas: number;
  exigidas: number;
  desbloqueada: boolean;
  /** Só vem quando a exposição abriu. Antes disso não existe do lado de lá. */
  blocos?: LessonBlock[];
  error?: string;
}

/**
 * A janela que impede a mesma passada de valer duas escutas, em segundos.
 *
 * ===========================================================================
 * O ERRO PRECISA CAIR PARA BAIXO, E ISSO FOI MEDIDO
 * ===========================================================================
 * A janela precisa ser MENOR que a duração real do áudio. Se for maior, a
 * segunda escuta honesta termina dentro dela e não conta — e o portão nunca
 * passa de uma escuta, para ninguém.
 *
 * A primeira versão usou 2,2 palavras por segundo, o ritmo de fala corrida
 * citado em qualquer lugar. Medido com `ffprobe` nas 104 peças travadas que já
 * têm mp3 gerado, o áudio do curso fala bem mais rápido que isso:
 *
 *   palavras por segundo ... mínimo 2,36 · mediana 3,43 · máximo 4,06
 *   duração ................ de 15 a 62 segundos
 *
 * Com 2,2, TODAS as 104 peças ganhariam janela maior que a própria duração.
 * 4,5 fica acima do máximo medido, então a estimativa é sempre mais curta que
 * o áudio, com folga — que é o lado certo para errar.
 *
 * O piso de 12 segundos existe para a rajada: quatro chamadas de seis em seis
 * segundos derrubavam o portão do dia 1 em dezoito segundos. Doze é menor que
 * a peça mais curta do curso (15 s), então ele nunca alcança escuta legítima.
 *
 * É estimativa de propósito: guardar a duração real de cada mp3 seria mais uma
 * tabela para manter em dia com o áudio. O número não precisa ser exato —
 * precisa ser do SERVIDOR e precisa errar para baixo.
 */
function janelaDoRoteiro(roteiro: string): number {
  const palavras = roteiro.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(600, Math.max(12, Math.round(palavras / 4.5)));
}

/**
 * A peça travada de um dia: a chave que ela DEVE ter, e os blocos que ela abre.
 *
 * ===========================================================================
 * POR QUE A CHAVE PRECISA SER CONFERIDA CONTRA O DIA
 * ===========================================================================
 * `day` e `key` chegam do cliente como dois campos independentes, e a primeira
 * versão desta ação usava um para buscar o texto e o outro para consultar o
 * portão. Quem já tivesse destravado UMA peça — o dia 1 do circuito 1, que todo
 * aluno destrava — podia pedir os blocos travados de qualquer um dos outros 727
 * dias mandando `{ day: 393, key: "c1d1:imersao" }`: `count_listen` devolvia a
 * linha já aberta, `desbloqueada` vinha true, e a resposta trazia o texto do dia
 * 393 sem uma única escuta. Em laço, o curso inteiro.
 *
 * A chave não é um dado do cliente: ela é uma FUNÇÃO do dia, e é derivada aqui
 * do mesmo jeito que a página deriva. O que o cliente manda só pode confirmar.
 */
async function pecaTravadaDoDia(
  day: number,
): Promise<{ chave: string; blocos: LessonBlock[]; janela: number } | null> {
  const course = await getPrimaryCourse();
  if (!course) return null;

  const lesson = await getLessonByDay(course.id, day);
  if (!lesson || !lesson.is_published) return null;

  const gated = lesson.content.gated ?? [];
  if (!gated.length) return null;

  const papel = lesson.immersion_script
    ? "imersao"
    : lesson.listening_script
      ? "escuta"
      : null;
  if (!papel) return null;

  const roteiro =
    (papel === "imersao" ? lesson.immersion_script : lesson.listening_script) ??
    "";

  // A peça nasce no dia 1 (imersão) ou no dia 4 (escuta) e é reapresentada
  // depois; a chave é do material, não do dia que o mostra. Mesma conta da
  // página, e é por ser a mesma que os dois lados nunca discordam.
  return {
    chave: chaveDaPeca(lesson.week_number, papel === "imersao" ? 1 : 4, papel),
    blocos: gated,
    janela: janelaDoRoteiro(roteiro),
  };
}

/** Uma escuta completa a mais. Devolve o texto se ela foi a última. */
export async function contarEscutaAction(input: {
  day: number;
  key: string;
  seconds: number;
}): Promise<RespostaDeEscuta> {
  const parsed = contarSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      escutas: 0,
      exigidas: 0,
      desbloqueada: false,
      error: "Dados inválidos",
    };
  }

  const session = await getSessionContext();
  if (!session) {
    return {
      ok: false,
      escutas: 0,
      exigidas: 0,
      desbloqueada: false,
      error: "Não autenticado",
    };
  }

  const peca = await pecaTravadaDoDia(parsed.data.day);
  if (!peca || peca.chave !== parsed.data.key) {
    return {
      ok: false,
      escutas: 0,
      exigidas: 0,
      desbloqueada: false,
      error: "Esta escuta não pertence a esta lição",
    };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("count_listen", {
    p_exposure_key: peca.chave,
    p_min_seconds: peca.janela,
  });

  if (error || !data) {
    return {
      ok: false,
      escutas: 0,
      exigidas: 0,
      desbloqueada: false,
      error: error?.message ?? "Não foi possível registrar a escuta",
    };
  }

  const desbloqueada = Boolean(data.unlocked_at);

  return {
    ok: true,
    escutas: data.plays,
    exigidas: data.required_plays,
    desbloqueada,
    blocos: desbloqueada ? peca.blocos : undefined,
  };
}

const dispensaSchema = z.object({
  day: z.number().int().min(1).max(728),
  key: z.string().min(1).max(200),
});

/**
 * Abre a peça sem escuta, para quem não pode ouvir.
 *
 * O botão "Mostrar o texto agora" saiu da tela: qualquer aluno clicava nele, e
 * um portão com botão de pular é conselho com animação. A exceção continua
 * existindo, mas é uma marca de perfil (`profiles.audio_exempt`), aplicada uma
 * vez, e a RPC recusa quem não a tem. O `forced` fica registrado na linha.
 */
export async function dispensarAudioAction(input: {
  day: number;
  key: string;
}): Promise<RespostaDeEscuta> {
  const parsed = dispensaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      escutas: 0,
      exigidas: 0,
      desbloqueada: false,
      error: "Dados inválidos",
    };
  }

  const session = await getSessionContext();
  if (!session) {
    return {
      ok: false,
      escutas: 0,
      exigidas: 0,
      desbloqueada: false,
      error: "Não autenticado",
    };
  }

  const peca = await pecaTravadaDoDia(parsed.data.day);
  if (!peca || peca.chave !== parsed.data.key) {
    return {
      ok: false,
      escutas: 0,
      exigidas: 0,
      desbloqueada: false,
      error: "Esta peça não pertence a esta lição",
    };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("unlock_exposure", {
    p_exposure_key: peca.chave,
  });

  if (error || !data) {
    return {
      ok: false,
      escutas: 0,
      exigidas: 0,
      desbloqueada: false,
      error: error?.message ?? "Esta conta não tem a dispensa de áudio",
    };
  }

  return {
    ok: true,
    escutas: data.plays,
    exigidas: data.required_plays,
    desbloqueada: true,
    blocos: peca.blocos,
  };
}
