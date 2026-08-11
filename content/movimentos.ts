/**
 * Os quatro movimentos do dia.
 *
 * ===========================================================================
 * O QUE MUDOU, E POR QUÊ
 * ===========================================================================
 * A versão anterior fazia UMA coisa por dia, num rodízio de catorze: o dia 2
 * era vocabulário, o 4 era escuta, o 9 era shadowing, o 6 era revisão. Parecia
 * organizado e era o que impedia o volume — se shadowing é o dia 9, o aluno faz
 * shadowing uma vez a cada duas semanas, 52 vezes em dois anos. Nenhum método
 * construído sobre input funciona nessa dosagem.
 *
 * Aqui os quatro movimentos acontecem TODO DIA. O que muda de um dia para o
 * outro é a ÊNFASE e o material que entra em cada movimento, não a existência
 * do movimento.
 *
 *   OUVIDO   ~55% do tempo   input, sempre a maior fatia
 *   MEMÓRIA  ~15%            a fila do SRS, em voz alta, português -> inglês
 *   BOCA     ~20%            shadowing e uma resposta gravada
 *   SOM      ~10%            um degrau da espinha de fonologia
 *
 * As proporções são do orçamento da TRILHA (`content/metodo/orcamento.json`),
 * não de um número inventado por dia — foi assim que a primeira versão do
 * desenho acabou pedindo mais minutos de input do que a sessão inteira tinha,
 * em 40 dos 52 circuitos.
 *
 * ===========================================================================
 * OUVIR ANTES DE LER É MECANISMO, NÃO CONSELHO
 * ===========================================================================
 * Todo material novo entra travado: o texto só abre depois de N escutas, e N
 * vem do canto (4 no primeiro, 3 no segundo, 2 nos dois últimos). O diagnóstico
 * do próprio curso diz que ler antes de ouvir instala fonema português sobre
 * grafia inglesa e que desfazer isso custa caro — uma recomendação no briefing
 * não impede isso, um portão impede.
 *
 * Por isso o conteúdo travado sai em `gated`, separado de `blocks`: o player
 * renderiza `blocks` sempre.
 */

import type { LessonBlock } from "@/lib/types/database";

import {
  cargaDe,
  cognatosDe,
  escutasExigidas,
  gramaticaDe,
  progressaoDe,
  somDe,
} from "./metodo";

/**
 * Quebra de parágrafo dentro do texto de um bloco.
 *
 * Existe como constante porque estas strings passam por scripts que reescrevem
 * o arquivo, e uma quebra literal escrita errada vira quebra de linha de
 * verdade no meio de um literal — que é exatamente o que aconteceu aqui.
 */
const PARAGRAFO = String.fromCharCode(10, 10);

/** [quem fala, inglês, português] */
export type Fala = [string, string, string];

export interface Forma {
  tipo: string;
  en: string;
  pt: string;
}

export interface Bloco {
  en: string;
  pt: string;
  quando: string;
  formas: Forma[];
  recombinacoes: { en: string; pt: string }[];
}

export interface MaterialDoCircuito {
  n: number;
  blocos: Bloco[];
  imersao: Fala[];
  escuta: Fala[];
  deriva: string[];
}

/** O que cada dia enfatiza. Os quatro movimentos acontecem sempre. */
export type Enfase =
  | "primeiro-contato"
  | "boca"
  | "molde"
  | "segunda-escuta"
  | "producao"
  | "revisao"
  | "missao"
  | "input-real"
  | "shadowing"
  | "frase-longa"
  | "ao-vivo"
  | "velocidade"
  | "intercalada"
  | "sem-roteiro";

export const ENFASE_DO_DIA: Record<number, Enfase> = {
  1: "primeiro-contato",
  2: "boca",
  3: "molde",
  4: "segunda-escuta",
  5: "producao",
  6: "revisao",
  7: "missao",
  8: "input-real",
  9: "shadowing",
  10: "frase-longa",
  11: "ao-vivo",
  12: "velocidade",
  13: "intercalada",
  14: "sem-roteiro",
};

// ===========================================================================
// Utilidades determinísticas
//
// Nada aqui sorteia: o mesmo circuito no mesmo dia produz sempre a mesma lição,
// e é isso que permite revisar o curso inteiro antes de ele chegar ao aluno.
// ===========================================================================

/** Máximo divisor comum, para escolher um passo que percorra a lista inteira. */
function mdc(a: number, b: number): number {
  return b === 0 ? a : mdc(b, a % b);
}

/**
 * Passo coprimo sobre a lista: espalha sem repetir e sem depender de sorteio.
 *
 * O comentário aqui dizia "passo primo" e o código não garantia isso. O passo
 * saía de `semente % (n-1) + 1` e podia dividir o tamanho da lista — e aí a
 * caminhada só alcança n/mdc índices. Quando isso acontecia com `quantos`
 * maior que os índices alcançáveis, `saida` parava de crescer, `vistos` parava
 * de crescer, e as DUAS condições do `while` continuavam verdadeiras: laço
 * infinito.
 *
 * Não era teórico. O circuito 1 no dia 4 travava exatamente assim — 8 blocos,
 * passo 4, dois índices alcançáveis, três pedidos — e levava junto o semeador,
 * que compõe os 728 dias antes de tocar no banco. O sintoma era o processo
 * parado sem erro nenhum, que é o pior jeito de um defeito se apresentar.
 *
 * Passo coprimo com o tamanho percorre a lista inteira antes de repetir, então
 * `quantos` índices distintos sempre existem quando `quantos <= itens.length`.
 */
function pegar<T>(itens: T[], semente: number, quantos: number): T[] {
  if (itens.length <= quantos) return [...itens];

  let passo = 1 + (semente % Math.max(1, itens.length - 1));
  while (mdc(passo, itens.length) !== 1) passo = (passo % itens.length) + 1;

  const saida: T[] = [];
  let i = semente % itens.length;
  // O teto de voltas é a garantia dura: mesmo que o passo falhasse, isto para.
  for (let volta = 0; volta < itens.length && saida.length < quantos; volta++) {
    saida.push(itens[i]);
    i = (i + passo) % itens.length;
  }
  return saida;
}

const roteiro = (falas: Fala[]) => falas.map(([quem, en]) => `${quem}: ${en}`).join(" / ");

const comoDialogo = (titulo: string, falas: Fala[]): LessonBlock => ({
  type: "dialogue",
  title: titulo,
  lines: falas.map(([speaker, en, pt]) => ({ speaker, en, pt })),
});

// ===========================================================================
// Movimento 1 — OUVIDO
// ===========================================================================

export interface Ouvido {
  abertos: LessonBlock[];
  /** Só abre depois das escutas exigidas. */
  travados: LessonBlock[];
  /** O roteiro que vira áudio. Null quando o dia não tem peça gravada. */
  script: string | null;
}

export function movimentoOuvido(
  n: number,
  dia: number,
  material: MaterialDoCircuito,
): Ouvido {
  const enfase = ENFASE_DO_DIA[dia];
  const escutas = escutasExigidas(n);
  const prog = progressaoDe(n)!;

  const comoOuvir = (quantas: number): LessonBlock => ({
    type: "callout",
    variant: "tip",
    title: "Primeiro o ouvido",
    body:
      `Toque o áudio ${quantas} ${quantas === 1 ? "vez" : "vezes"} antes de qualquer texto. ` +
      `O texto abre sozinho depois disso.\n\n` +
      `Não é capricho: lendo antes, sua boca aprende o som das letras em português, ` +
      `e desfazer isso depois custa muito mais do que acertar agora.`,
  });

  switch (enfase) {
    case "primeiro-contato":
      return {
        abertos: [
          comoOuvir(escutas),
          { type: "text", title: "A cena de hoje", body: prog.situacao },
        ],
        travados: [comoDialogo("A conversa, com tradução", material.imersao)],
        script: roteiro(material.imersao),
      };

    case "segunda-escuta":
      return {
        abertos: [
          comoOuvir(Math.max(2, escutas - 1)),
          {
            type: "callout",
            variant: "tip",
            title: "Mesma situação, outra gente",
            body:
              "Se você reconhecer a situação sem reconhecer as palavras, funcionou: " +
              "é sinal de que você pegou a cena e não decorou o diálogo do dia 1.",
          },
        ],
        travados: [comoDialogo("A conversa inteira", material.escuta)],
        script: roteiro(material.escuta),
      };

    case "velocidade":
      return {
        abertos: [
          {
            type: "callout",
            variant: "tip",
            title: "A escada de velocidade",
            body:
              "Ouça em 1x, depois 1,25x, depois 1,5x, e volte para 1x.\n\n" +
              "Na volta o normal soa lento — e é essa sensação que você quer levar " +
              "para a conversa real. Nativo não fala rápido: ele comprime as sílabas fracas.",
          },
          comoDialogo("A conversa, para acompanhar", material.escuta),
        ],
        travados: [],
        script: roteiro(material.escuta),
      };

    case "shadowing":
      return {
        abertos: [
          {
            type: "callout",
            variant: "tip",
            title: "Fale junto, colado",
            body:
              "Toque e fale ao mesmo tempo, sem esperar a fala terminar. " +
              "Atropelou? Siga e pegue a próxima. Parar para corrigir quebra o exercício.",
          },
        ],
        travados: [],
        script: roteiro(material.imersao),
      };

    case "input-real":
      return {
        abertos: [
          {
            type: "callout",
            variant: "warning",
            title: "Hoje você não vai entender tudo",
            body:
              "E não é para entender. O alvo é reconhecer três ou quatro coisas na " +
              "primeira escuta e aguentar o resto passar. Acostumar o ouvido à " +
              "velocidade real é o resultado de hoje.",
          },
        ],
        travados: [],
        script: null,
      };

    default: {
      // Nos demais dias o Ouvido é reescuta do material do circuito. Alternar
      // entre as duas peças mantém as duas vivas em vez de gastar só uma.
      const peca = dia % 2 === 0 ? material.imersao : material.escuta;
      return {
        abertos: [
          {
            type: "callout",
            variant: "tip",
            title: "Comece pelo ouvido",
            body:
              "Antes de qualquer exercício, toque a conversa do circuito uma vez " +
              "inteira. É o movimento mais barato do dia e o que mais rende.",
          },
        ],
        travados: [],
        script: roteiro(peca),
      };
    }
  }
}

// ===========================================================================
// Movimento 2 — MEMÓRIA
// ===========================================================================

/**
 * A fila de repetição espaçada é POR ALUNO e vive em `chunk_mastery`. A lição é
 * a mesma para todo mundo, então ela não pode trazer a fila pronta — ela manda
 * para a fila e diz o tamanho esperado.
 *
 * É a diferença entre "a revisão é um anexo do curso" e "a revisão é o eixo": o
 * bloco existe todo dia, com alvo declarado, e não em dois dias de catorze.
 */
export function movimentoMemoria(
  n: number,
  dia: number,
  blocosDoCircuito: Bloco[],
): LessonBlock[] {
  const enfase = ENFASE_DO_DIA[dia];
  const carga = cargaDe(n)!;

  if (enfase === "revisao" || enfase === "intercalada") {
    const semente = n * 17 + dia;
    const alvos = pegar(blocosDoCircuito, semente, Math.min(10, blocosDoCircuito.length));
    return [
      {
        type: "practice",
        title: enfase === "revisao" ? "Puxe da memória" : "Embaralhado de propósito",
        instruction:
          enfase === "revisao"
            ? "Diga em inglês antes de conferir. Errar aqui é o que fixa: erre em voz alta e siga."
            : "Vem misturado, sem dizer de qual circuito é. É mais difícil que a revisão normal, e é por isso que rende mais.",
        prompts: alvos.map((b) => b.pt),
      },
      {
        type: "callout",
        variant: "tip",
        title: "Depois, a sua fila",
        body:
          "Abra a Revisão e feche a fila do dia. Ela é sua: traz só o que a sua " +
          "agenda diz que está vencendo, e não o que a lição escolheu.",
      },
    ];
  }

  const blocos: LessonBlock[] = [
    {
      type: "callout",
      variant: "tip",
      title: "A fila de hoje",
      body:
        "Abra a Revisão e responda em voz alta, do português para o inglês, antes de conferir." +
        PARAGRAFO +
        "São poucos minutos, e é o movimento que decide se o bloco de hoje ainda vai estar aí em março.",
    },
  ];

  // O aquecimento só existe quando há bloco novo: num circuito de fechamento
  // não há o que aquecer, e um exercício vazio ensina o aluno a pular a seção.
  if (carga.blocosNovos > 0 && blocosDoCircuito.length) {
    blocos.push({
      type: "practice",
      title: "Antes de abrir a fila",
      instruction: "Diga em inglês, sem olhar. Três é suficiente.",
      prompts: pegar(blocosDoCircuito, n * 31 + dia, Math.min(3, blocosDoCircuito.length)).map(
        (b) => b.pt,
      ),
    });
  }

  return blocos;
}

// ===========================================================================
// Movimento 3 — BOCA
// ===========================================================================

export function movimentoBoca(
  n: number,
  dia: number,
  material: MaterialDoCircuito,
): { blocos: LessonBlock[]; prompt: string } {
  const enfase = ENFASE_DO_DIA[dia];
  const prog = progressaoDe(n)!;
  const semente = n * 13 + dia;
  const blocos = material.blocos;

  const formas = blocos.flatMap((b) => b.formas.map((f) => ({ ...f, base: b.en })));
  const recombinacoes = blocos.flatMap((b) => b.recombinacoes);

  switch (enfase) {
    case "boca":
      return {
        blocos: [
          {
            type: "examples",
            title: "Os blocos de hoje",
            items: blocos.map((b) => ({ en: b.en, pt: b.pt, note: b.quando })),
          },
          {
            type: "practice",
            title: "Na boca, não na cabeça",
            instruction:
              "Ouça e repita cada um em voz alta, imitando o ritmo. Cinco vezes cada, até sair sem olhar.",
            prompts: ["Repita imitando o ritmo, não a letra.", "Travou? Ouça de novo e repita. Travar é parte."],
          },
        ],
        prompt: `Grave você dizendo em voz alta os blocos de hoje. Não busque a frase perfeita: busque a frase dita.`,
      };

    case "molde":
      return {
        blocos: [
          {
            type: "examples",
            title: "O mesmo bloco, outra cara",
            items: pegar(formas, semente, Math.min(8, formas.length)).map((f) => ({
              en: f.en,
              pt: f.pt,
              note: f.tipo,
            })),
          },
          {
            type: "callout",
            variant: "culture",
            title: "É a mesma peça",
            body:
              "Repare que nada aqui é palavra nova. É o bloco que você já tem, " +
              "negando, perguntando, mudando de dono ou de tempo. Quem tem o molde " +
              "não precisa decorar cada versão.",
          },
        ],
        prompt: `Grave você usando três formas diferentes do mesmo bloco, na situação do circuito.`,
      };

    case "frase-longa":
      return {
        blocos: [
          {
            type: "examples",
            title: "Curto vira longo",
            items: pegar(recombinacoes, semente, Math.min(6, recombinacoes.length)),
          },
          {
            type: "practice",
            title: "Quarenta segundos sem parar",
            instruction:
              "Cronometre. O alvo não é acertar tudo: é não deixar buraco de silêncio. Emende com and, but, because, so, when.",
            prompts: ["Comece pelo bloco e continue a frase.", "Se travar, repita a última palavra e siga."],
          },
        ],
        prompt: `Grave quarenta segundos falando sem parar sobre a situação do circuito, emendando os blocos.`,
      };

    case "shadowing":
      return {
        blocos: [
          {
            type: "drill",
            title: "Fale junto",
            instruction: "Sem tradução na tela de propósito: hoje é ritmo, não sentido.",
            items: material.imersao.map(([, en]) => en),
          },
          {
            type: "callout",
            variant: "warning",
            title: "Se está confortável, está fácil demais",
            body: "Suba a velocidade até ficar difícil de acompanhar. É ali que a boca aprende.",
          },
        ],
        prompt: `Grave você acompanhando o áudio do começo ao fim, colado.`,
      };

    case "missao":
      return {
        blocos: [
          { type: "callout", variant: "tip", title: "A missão de hoje", body: prog.missao },
          {
            type: "practice",
            title: "Antes de sair para fazer",
            instruction: "Ensaie em voz alta, uma vez. Depois faça de verdade.",
            prompts: [
              "Diga a primeira frase que você vai usar.",
              "Diga o que você faz se não entender a resposta.",
            ],
          },
        ],
        prompt: `${prog.missao}\n\nDepois de fazer, grave contando como foi, em inglês.`,
      };

    case "ao-vivo":
    case "sem-roteiro":
      return {
        blocos: [
          {
            type: "practice",
            title: "Frases de socorro",
            instruction: "Deixe estas à mão. São elas que impedem a conversa de morrer.",
            prompts: [
              "Sorry, could you say that again?",
              "How do you say ___ in English?",
              "Let me think for a second.",
              "I'm not sure how to say this, but...",
            ],
          },
          ...(enfase === "sem-roteiro" && material.deriva.length
            ? [
                {
                  type: "drill",
                  title: "Para onde a conversa pode ir",
                  instruction: "Sem roteiro. Deixe derivar para onde quiser.",
                  items: material.deriva,
                } as LessonBlock,
              ]
            : []),
        ],
        prompt: `Converse ao vivo sobre a situação do circuito, do seu jeito, sem consultar as frases prontas.`,
      };

    default:
      return {
        blocos: [
          {
            type: "practice",
            title: "Sua vez",
            instruction: "Leia a proposta e responda em voz alta, em inglês, antes de gravar.",
            prompts: [prog.situacao],
          },
        ],
        prompt: `${prog.situacao}\n\nGrave você resolvendo esta situação em inglês, por uns 45 segundos. Use pelo menos três blocos do circuito.`,
      };
  }
}

// ===========================================================================
// Movimento 4 — SOM
// ===========================================================================

/**
 * A parte mais especificamente brasileira do curso, e a que não existia.
 *
 * Antes eram duas dicas soltas por circuito, sem ordem e sem currículo. Agora é
 * uma escada de 52 degraus ordenada pelo ESTRAGO — epêntese e ritmo acentual
 * muito cedo, porque respondem sozinhos por boa parte do "não me entendem" e do
 * "não entendo nativo".
 *
 * A checagem é binária de propósito. Nota de pronúncia com histórico vira mais
 * um número para o aluno se sentir mal, e a fonologia é justamente a parte em
 * que ele já chega envergonhado.
 */
export function movimentoSom(n: number, dia: number): LessonBlock[] {
  const som = somDe(n)!;
  const cognatos = cognatosDe(n);
  const enfase = ENFASE_DO_DIA[dia];

  const blocos: LessonBlock[] = [
    {
      type: "callout",
      variant: "tip",
      title: `Som do circuito: ${som.traco}`,
      body: `${som.interferencia}\n\n**Como treinar:** ${som.comoTreinar}`,
    },
  ];

  // Os pares mínimos entram nos dias em que há boca disponível para eles. Nos
  // dias de escuta pura o degrau fica só na descrição, para não roubar o tempo
  // do movimento que manda no dia.
  if (enfase !== "primeiro-contato" && enfase !== "input-real") {
    blocos.push({
      type: "drill",
      title: "Pares que o brasileiro confunde",
      instruction:
        som.modo === "perceber"
          ? "Ouça os dois e diga qual é qual, sem olhar. Só depois confira."
          : "Diga os dois em sequência, gravando. A diferença tem que dar para ouvir.",
      items: som.paresMinimos.map(([a, b]) => `${a}  ·  ${b}`),
    });
  }

  // Um falso cognato por dia, rodando pelos do circuito: é aviso no momento da
  // colisão, não lista para decorar.
  if (cognatos.length) {
    const c = cognatos[dia % cognatos.length];
    blocos.push({
      type: "callout",
      variant: "warning",
      title: `"${c.en}" não é "${c.oQueOBrasileiroAcha}"`,
      body:
        `${c.oQueSignifica}\n\n` +
        `Para dizer o que você queria: ${c.comoDizerOQueQueria}\n\n` +
        `*${c.exemploEn}* — ${c.exemploPt}`,
    });
  }

  return blocos;
}

// ===========================================================================
// A peça de gramática
// ===========================================================================

/**
 * Emerge depois do uso, nunca antes, e só nos dias em que o aluno produz — é
 * quando a peça responde a uma pergunta que ele acabou de ter.
 */
export const DIAS_DE_PRODUCAO = new Set([3, 5, 7, 11, 14]);

export function pecaDeGramatica(n: number, dia: number): LessonBlock[] {
  if (!DIAS_DE_PRODUCAO.has(dia)) return [];

  const g = gramaticaDe(n);
  if (!g || /respiro/i.test(g.peca) || !g.corpo) return [];

  const blocos: LessonBlock[] = [
    { type: "text", title: g.titulo, body: g.corpo },
  ];

  if (g.exemplos?.length) {
    blocos.push({ type: "examples", title: "Na prática", items: g.exemplos });
  }

  if (g.evita) {
    blocos.push({
      type: "callout",
      variant: "warning",
      title: "Sem isso sai:",
      body: g.evita,
    });
  }

  return blocos;
}
