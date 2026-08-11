/**
 * Monta a lição de um dia a partir da espinha do método.
 *
 * ===========================================================================
 * O QUE ESTE ARQUIVO DEIXOU DE SER
 * ===========================================================================
 * Eram 1.441 linhas com um `switch` de catorze ramos, e cada ramo fazia UMA
 * coisa: o dia 2 era vocabulário, o 4 escuta, o 9 shadowing, o 6 revisão.
 * Parecia organizado e era exatamente o que impedia o volume — com shadowing
 * no dia 9, o aluno faz shadowing 52 vezes em dois anos.
 *
 * Também era ele quem devolvia `circuit.chunks` nos catorze ramos, o que fazia
 * os mesmos sete blocos aparecerem byte a byte idênticos em treze dos catorze
 * dias. Repetição não era o defeito; repetição da mesma forma era.
 *
 * Agora a lição é a soma dos QUATRO MOVIMENTOS (`content/movimentos.ts`), que
 * acontecem todo dia. O dia decide a ênfase e o material, nunca se o movimento
 * existe.
 *
 * ===========================================================================
 * DETERMINÍSTICO, E ISSO É REQUISITO
 * ===========================================================================
 * Nada aqui sorteia. O mesmo circuito no mesmo dia produz sempre a mesma lição,
 * e é isso que permite ler o curso inteiro antes de ele chegar ao aluno — que é
 * o princípio que o repositório defende desde o primeiro dia.
 */

import type {
  Chunk,
  LessonBlock,
  LessonBriefing,
  LessonContent,
  LessonExtensions,
  QuizQuestion,
} from "@/lib/types/database";

import {
  cargaDe,
  ehRespiro,
  escutasExigidas,
  gramaticaDe,
  progressaoDe,
} from "./metodo";
import {
  DIAS_DE_PRODUCAO,
  ENFASE_DO_DIA,
  movimentoBoca,
  movimentoMemoria,
  movimentoOuvido,
  movimentoSom,
  pecaDeGramatica,
  type Bloco,
  type Fala,
  type MaterialDoCircuito,
} from "./movimentos";

export type { Fala, Bloco, MaterialDoCircuito };

/**
 * Um roteiro de diálogo, no formato que o gerador de áudio consome.
 *
 * Exportada porque `content/audio-manifest.ts` PRECISA produzir exatamente a
 * mesma string que vai parar em `lessons.immersion_script`: o nome do arquivo
 * de áudio é derivado desse texto. Se as duas divergirem por um espaço, o
 * player pede um arquivo que nunca foi gerado.
 */
export function scriptOf(falas: Fala[]): string {
  return falas.map(([quem, en]) => `${quem}: ${en}`).join(" / ");
}

export interface ComposedLesson {
  content: LessonContent;
  chunks: Chunk[];
  quiz: QuizQuestion[];
  speakingPrompt: string;
  immersionScript: string | null;
  listeningScript: string | null;
  grammarFocus: string | null;
  grammarExplanation: string | null;
  extensions: LessonExtensions;
}

export interface ComposeContext {
  circuito: number;
  /** 1 a 14. */
  dia: number;
  material: MaterialDoCircuito;
  /** Prompt da tutora para os dias de conversa ao vivo. */
  livePrompt?: string;
  /** Blocos de circuitos anteriores, para os dias de revisão. */
  revisaoDe?: { circuit: number; title: string; chunks: Chunk[] }[];
}

// ===========================================================================
// O briefing
// ===========================================================================

const PASSOS: Record<number, string[]> = {
  1: [
    "Toque o áudio e ouça sem tentar entender palavra por palavra.",
    "Ouça de novo até o texto abrir sozinho.",
    "Com o texto aberto, ouça mais uma vez acompanhando com os olhos.",
  ],
  2: [
    "Ouça a conversa uma vez inteira antes de qualquer exercício.",
    "Repita cada bloco em voz alta, imitando o ritmo, até sair sem olhar.",
    "Feche a fila de revisão e grave o áudio do dia.",
  ],
  3: [
    "Comece pelo áudio, como todo dia.",
    "Veja o mesmo bloco nas outras caras e diga cada uma em voz alta.",
    "Leia a explicação por último: ela vem depois do uso, nunca antes.",
  ],
  4: [
    "Ouça a conversa nova sem o texto.",
    "Reconheça a situação, não as palavras — é isso que está sendo medido.",
    "Só depois o texto abre para conferir.",
  ],
  5: [
    "Ouça o áudio do circuito para entrar no ritmo.",
    "Responda a situação em voz alta e grave: é a gravação que gera sua correção.",
    "Não busque a frase perfeita. Busque a frase dita.",
  ],
  6: [
    "Responda de memória antes de olhar a resposta.",
    "Errou? Ótimo: o erro é o que fixa. Repita em voz alta e siga.",
    "Feche a fila da Revisão, que é a sua e não a da lição.",
  ],
  7: [
    "Ensaie a missão em voz alta, uma vez.",
    "Faça de verdade, fora do app.",
    "Volte e grave contando como foi.",
  ],
  8: [
    "Veja primeiro o que você já conhece: é o que vai reconhecer no meio da fala.",
    "Ouça uma vez inteira sem parar, mesmo perdendo pedaços.",
    "Conte quantos blocos você pegou. Três ou quatro já é o resultado esperado.",
  ],
  9: [
    "Toque e fale ao mesmo tempo, colado, sem esperar a fala terminar.",
    "Atropelou? Siga e pegue a próxima.",
    "Repita até acompanhar do começo ao fim.",
  ],
  10: [
    "Ouça as frases longas e repita inteiras, sem quebrar no meio.",
    "Repare que são blocos velhos emendados, não matéria nova.",
    "Fale quarenta segundos sem parar.",
  ],
  11: [
    "Abra a conversa ao vivo e fale como falaria com uma pessoa.",
    "Se travar, use uma frase de socorro em vez de trocar para o português.",
    "Deixe o silêncio existir: pensar antes de responder é normal.",
  ],
  12: [
    "Ouça em velocidade normal primeiro.",
    "Suba para 1,25x e 1,5x, e depois volte para 1x.",
    "Perdeu o fio? Siga em frente. Não volte.",
  ],
  13: [
    "Responda sem saber de qual circuito veio.",
    "É mais difícil que a revisão normal, e é por isso que rende mais.",
    "Diga em voz alta antes de conferir.",
  ],
  14: [
    "Fale sobre a situação sem consultar as frases prontas.",
    "Deixe a conversa derivar para onde ela quiser ir.",
    "Faltou palavra? Contorne com o que você tem. É o que se faz na vida real.",
  ],
};

const OBJETIVOS: Record<number, string> = {
  1: "Hoje você só ouve. O objetivo é seu ouvido pegar o formato da conversa antes de qualquer letra.",
  2: "Hoje os blocos vão para a boca. Não é decorar: é repetir até sair sem pensar.",
  3: "Hoje o bloco ganha outras caras. É o que transforma frase decorada em molde reutilizável.",
  4: "Hoje você testa se colou: mesma situação, conversa nova, gente diferente.",
  5: "Hoje você fala. Sozinho, em voz alta, sem plateia e sem medo de errar.",
  6: "Hoje você revisa o que já passou, na hora exata em que estava começando a esquecer.",
  7: "Hoje você usa o inglês para valer, fora do app, numa tarefa de verdade.",
  8: "Hoje você ouve inglês de verdade, do jeito que ele existe fora de curso nenhum.",
  9: "Hoje você fala JUNTO com o áudio. É o exercício que mais aproxima seu sotaque do nativo.",
  10: "Hoje as frases ficam longas: você emenda o que já tem em vez de aprender coisa nova.",
  11: "Hoje você conversa ao vivo, falando e ouvindo em tempo real.",
  12: "Hoje você ouve mais rápido do que está confortável. É assim que a velocidade real deixa de assustar.",
  13: "Hoje a revisão vem embaralhada, misturando circuitos diferentes de propósito.",
  14: "Hoje não tem roteiro. Você conversa sobre a situação do circuito do seu jeito.",
};

function montarBriefing(n: number, dia: number, blocos: Bloco[]): LessonBriefing {
  const briefing: LessonBriefing = {
    goal: OBJETIVOS[dia],
    steps: PASSOS[dia],
  };

  // No dia 1 a lista de expressões furaria o portão de escuta: o inglês estaria
  // ali em cima, escrito, antes da primeira nota do áudio.
  if (dia !== 1 && blocos.length) {
    briefing.expressions = blocos.map((b) => ({ en: b.en, pt: b.pt }));
  }

  if (dia === 1) {
    briefing.note =
      `O texto fica escondido até você ouvir ${escutasExigidas(n)} vezes. ` +
      `Lendo antes, sua boca aprende o som das letras em português — e desfazer isso ` +
      `depois custa muito mais do que acertar agora.`;
  }

  const g = gramaticaDe(n);
  if (DIAS_DE_PRODUCAO.has(dia) && g && !ehRespiro(g) && g.corpo) {
    briefing.connection = {
      piece: g.peca,
      title: g.titulo,
      body: g.corpo,
      examples: g.exemplos ?? [],
      avoids: g.evita ?? "",
    };
  }

  return briefing;
}

// ===========================================================================
// O quiz
// ===========================================================================

type ModoQuiz = "pt-en" | "en-pt" | "quando";

/**
 * Perguntas de recuperação, tiradas dos próprios blocos.
 *
 * A semente é o circuito e o dia, então a ordem é estável entre execuções: uma
 * lição regerada não embaralha as respostas de quem já a completou.
 */
function quizDeBlocos(
  blocos: Bloco[],
  semente: number,
  modo: ModoQuiz,
  quantas: number,
): QuizQuestion[] {
  if (blocos.length < 2) return [];

  const perguntas: QuizQuestion[] = [];
  const total = Math.min(quantas, blocos.length);

  for (let i = 0; i < total; i++) {
    const alvo = blocos[(i * 7 + semente) % blocos.length];
    const distratores = blocos
      .filter((b) => b.en !== alvo.en)
      .filter((_, k) => (k + semente + i) % Math.max(1, Math.floor(blocos.length / 3)) === 0)
      .slice(0, 3);

    if (distratores.length < 3) {
      const resto = blocos.filter((b) => b.en !== alvo.en && !distratores.includes(b));
      distratores.push(...resto.slice(0, 3 - distratores.length));
    }
    if (distratores.length < 3) continue;

    const opcoes =
      modo === "en-pt"
        ? [alvo.pt, ...distratores.map((d) => d.pt)]
        : [alvo.en, ...distratores.map((d) => d.en)];

    // Rotaciona a posição da certa: sempre em primeiro seria pista de graça.
    const certa = (i + semente) % 4;
    const ordenadas = [...opcoes];
    [ordenadas[0], ordenadas[certa]] = [ordenadas[certa], ordenadas[0]];

    perguntas.push({
      id: `c${semente}-${i}`,
      question:
        modo === "pt-en"
          ? `Como se diz "${alvo.pt}"?`
          : modo === "en-pt"
            ? `O que quer dizer "${alvo.en}"?`
            : `Em que momento você usa "${alvo.en}"?`,
      options: modo === "quando" ? [alvo.quando, ...distratores.map((d) => d.quando)] : ordenadas,
      answerIndex: modo === "quando" ? 0 : certa,
      explanation:
        modo === "quando"
          ? `"${alvo.en}" — ${alvo.pt}`
          : `"${alvo.en}" — ${alvo.pt}. ${alvo.quando}`,
    });
  }

  return perguntas;
}

const MODO_DO_DIA: Record<number, ModoQuiz | null> = {
  1: null,
  2: "pt-en",
  3: "quando",
  4: "en-pt",
  5: null,
  6: "pt-en",
  7: "en-pt",
  8: null,
  9: null,
  10: "pt-en",
  11: null,
  12: "en-pt",
  13: "pt-en",
  14: "quando",
};

// ===========================================================================
// A lição
// ===========================================================================

export function composeLesson(ctx: ComposeContext): ComposedLesson {
  const { circuito: n, dia, material } = ctx;
  const prog = progressaoDe(n)!;
  const carga = cargaDe(n)!;
  const enfase = ENFASE_DO_DIA[dia];

  const ouvido = movimentoOuvido(n, dia, material);
  const memoria = movimentoMemoria(n, dia, material.blocos);
  const boca = movimentoBoca(n, dia, material);
  const som = movimentoSom(n, dia);
  const gramatica = pecaDeGramatica(n, dia);

  // A ordem na tela É o método: entra pelo ouvido, passa pela memória, sai pela
  // boca, e o som fecha. A gramática entra depois da boca, nunca antes — é a
  // regra que o curso repete desde o primeiro arquivo.
  const blocks: LessonBlock[] = [
    ...ouvido.abertos,
    ...memoria,
    ...boca.blocos,
    ...gramatica,
    ...som,
  ];

  const modo = MODO_DO_DIA[dia];
  const quiz = modo ? quizDeBlocos(material.blocos, n * 17 + dia, modo, 4) : [];

  const extensions: LessonExtensions = {
    // O alvo declarado da fila. Quem sabe o número real é a agenda do aluno;
    // isto é o tamanho que a lição espera que ele feche hoje.
    srs_target: Math.max(5, Math.min(30, carga.blocosNovos)),
  };

  if (enfase === "shadowing") {
    extensions.shadowing = {
      script: scriptOf(material.imersao),
      instruction: "Fale junto, colado, sem esperar a fala terminar.",
    };
  }

  if ((enfase === "ao-vivo" || enfase === "sem-roteiro") && ctx.livePrompt) {
    extensions.live_prompt = ctx.livePrompt;
  }

  return {
    content: {
      briefing: montarBriefing(n, dia, material.blocos),
      warmup:
        dia === 1
          ? `${prog.situacao}\n\nHoje você só ouve.`
          : `${prog.titulo} — ${OBJETIVOS[dia]}`,
      blocks,
      gated: ouvido.travados.length ? ouvido.travados : undefined,
      summary:
        dia === 14
          ? `Circuito ${n} fechado: ${prog.titulo}.`
          : undefined,
      homework: dia === 7 ? prog.missao : undefined,
    },
    chunks: material.blocos.map((b) => ({ en: b.en, pt: b.pt, when: b.quando })),
    quiz,
    speakingPrompt: boca.prompt,
    immersionScript: enfase === "primeiro-contato" || enfase === "shadowing" ? ouvido.script : null,
    listeningScript:
      enfase === "segunda-escuta" || enfase === "velocidade" ? ouvido.script : null,
    grammarFocus: gramatica.length ? (gramaticaDe(n)?.titulo ?? null) : null,
    grammarExplanation: gramatica.length ? (gramaticaDe(n)?.corpo ?? null) : null,
    extensions,
  };
}
