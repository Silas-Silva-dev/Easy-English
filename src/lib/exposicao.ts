/**
 * A identidade de uma peça travada.
 *
 * O portão de escuta deixou de ser um caso especial de tela e virou um estado
 * de par (aluno, peça), guardado em `listening_exposures`. Para isso a peça
 * precisa de um nome estável que o servidor e o cliente escrevam igual, e que
 * sobreviva a recompor a lição: a chave não pode depender de índice de array
 * nem de nada que a ordem do render decida.
 *
 * São duas formas, e nenhuma outra:
 *
 *   `c14d4:escuta`   uma peça de áudio, pelo circuito e pelo dia
 *   `nice-to-meet-you`  um bloco, pela mesma chave que `chunk_mastery` usa
 *
 * A segunda forma é de propósito idêntica ao `chunk_key` do SRS: o bloco que o
 * aluno destravou pelo ouvido é o mesmo bloco que ele revisa, e duas
 * identidades para a mesma coisa é como se perde a ligação entre elas.
 *
 * Este arquivo é importado por componente de cliente, então não pode arrastar
 * `content/metodo` junto — aquilo traz seis JSONs de espinha para o bundle do
 * navegador. Quantas escutas o circuito exige é decisão do SERVIDOR
 * (`public.required_plays`, na migration 1400) e chega até aqui pronta, dentro
 * da própria linha da exposição.
 */

import type { Chunk, LessonContent, QuizQuestion } from "./types/database";

/** O papel da peça dentro do dia. */
export type PapelDaExposicao = "imersao" | "escuta" | "autentico";

/** Peça de áudio: circuito, dia e papel. */
export function chaveDaPeca(
  circuito: number,
  dia: number,
  papel: PapelDaExposicao,
): string {
  return `c${circuito}d${dia}:${papel}`;
}

/**
 * O estado de uma peça travada, do jeito que a tela precisa dele.
 *
 * `desbloqueada` é derivada e não guardada: `unlocked_at` no banco é o fato, e
 * um booleano paralelo seria a segunda fonte da verdade que a auditoria deste
 * mês passou inteira consertando.
 */
export interface EstadoDaExposicao {
  chave: string;
  escutas: number;
  exigidas: number;
  desbloqueada: boolean;
  /** Aberta pela dispensa de áudio, não por escuta. */
  dispensada: boolean;
}

export interface LinhaDeExposicao {
  exposure_key: string;
  required_plays: number;
  plays: number;
  unlocked_at: string | null;
  forced: boolean;
}

export function estadoDe(
  chave: string,
  linha: LinhaDeExposicao | null | undefined,
  exigidasPadrao: number,
): EstadoDaExposicao {
  return {
    chave,
    escutas: linha?.plays ?? 0,
    // A linha manda quando existe: ela guarda o número que o SERVIDOR aplicou.
    // O padrão só vale para a primeira montagem, antes da primeira escuta.
    exigidas: linha?.required_plays ?? exigidasPadrao,
    desbloqueada: Boolean(linha?.unlocked_at),
    dispensada: Boolean(linha?.forced),
  };
}

/**
 * Os campos de uma lição que podem devolver o inglês que o portão esconde.
 *
 * Nomeados em snake_case porque é a forma que sai do banco, que é a que a
 * página serializa para o navegador.
 */
export interface LicaoTravavel {
  content: LessonContent;
  chunks: Chunk[];
  quiz: QuizQuestion[];
  immersion_script: string | null;
  listening_script: string | null;
}

/**
 * A lição sem NENHUM caminho para o inglês que o portão esconde.
 *
 * ===========================================================================
 * TIRAR `gated` NÃO BASTAVA — E A MEDIDA DIZ QUANTO
 * ===========================================================================
 * A primeira versão da poda removia `content.gated` e dava o assunto por
 * encerrado. Medido depois contra as 728 lições compostas, o mesmo inglês
 * continuava saindo por três outras portas:
 *
 *   chunks ..................... 102 dias, 530 blocos
 *   briefing.expressions ....... 51 dias, 268 itens
 *   quiz ....................... 49 dias, 191 itens
 *
 * Na tela, seis dos oito blocos do diálogo travado do dia 1 apareciam na aba
 * "Blocos" — com tradução, pronúncia figurada e player próprio, a UM clique do
 * portão fechado. Não era furo de inspetor: era a aba do lado.
 *
 * A coincidência é estrutural, não acidente: `ancorasExigidas`
 * (`content/material.ts`) EXIGE que o diálogo recite os blocos do circuito
 * palavra por palavra. Enquanto o diálogo estiver travado, tudo que o cita
 * está travado junto.
 *
 * Mora aqui, e não dentro da página, para `npm run verify:content` poder
 * aplicar a MESMA função às 728 lições e provar que não sobra vazamento. Uma
 * poda escrita direto no componente só poderia ser conferida por leitura.
 *
 * Os campos saem AUSENTES ou vazios conforme o que o consumidor sabe tratar:
 * `gated` e `expressions` são removidos (um array vazio anunciaria que existe
 * um portão e quantos itens ele guarda), e `chunks`/`quiz` viram listas vazias
 * porque o player conta com elas para decidir quais passos existem.
 */
export function semTextoTravado<T extends LicaoTravavel>(
  licao: T,
  papel: PapelDaExposicao,
): T {
  const content: LessonContent = { ...licao.content };
  delete content.gated;

  if (content.briefing) {
    const briefing = { ...content.briefing };
    delete briefing.expressions;
    content.briefing = briefing;
  }

  return {
    ...licao,
    content,
    chunks: [],
    quiz: [],
    immersion_script: papel === "imersao" ? null : licao.immersion_script,
    listening_script: papel === "escuta" ? null : licao.listening_script,
  };
}
