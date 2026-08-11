/**
 * A espinha pedagógica dos 4 Cantos.
 *
 * ===========================================================================
 * POR QUE ESTA PASTA EXISTE
 * ===========================================================================
 * O curso v1 tinha uma estrutura boa e um reservatório vazio. Medido antes de
 * mexer em qualquer coisa: 22.705 palavras de inglês nos 728 dias, 1h57 de
 * áudio gravado, 364 blocos — exatamente 7 por circuito, do circuito 1 ao 52,
 * sem nenhuma variação de carga. Meio bloco novo por dia, dez segundos de
 * inglês por dia. Um método de input que entrega isso não é um método de input.
 *
 * E os 7 blocos apareciam byte a byte idênticos em 13 dos 14 dias, porque
 * `compose-lesson.ts` devolvia `circuit.chunks` em todos os catorze ramos. Não
 * existia conjugação, negação, interrogação nem tempo verbal em lugar nenhum
 * do código. Repetição não era o defeito: repetição da MESMA FORMA era.
 *
 * ===========================================================================
 * AS CINCO CAMADAS
 * ===========================================================================
 * Cada arquivo aqui descreve os 52 circuitos por um eixo. Elas foram escritas
 * em paralelo e depois reconciliadas, porque separadas elas brigam: uma peça
 * de gramática só se sustenta se a situação do circuito a produzir, e um
 * degrau de som só se treina se houver material onde ele apareça.
 *
 *   rampa.json       carga por circuito: blocos novos, minutos de input dentro
 *                    e fora da sessão, e o portão da quinzena
 *   progressao.json  o assunto: a situação real, a função comunicativa, a
 *                    missão fora do app e a armadilha típica do brasileiro
 *   fonologia.json   os 52 degraus de interferência do português, ordenados
 *                    pelo estrago, com pares mínimos e checagem binária
 *   cognatos.json    87 falsos cognatos, distribuídos por onde o assunto puxa
 *   gramatica.json   a escada que emerge do uso, com respiros deliberados
 *   orcamento.json   os quatro movimentos por trilha, e a exposição travada
 *
 * ===========================================================================
 * O QUE FOI VERIFICADO, E CONTRA O QUÊ
 * ===========================================================================
 * A rampa não é estética: ela foi conferida contra o motor SM-2 que roda de
 * verdade em `review_chunk`. É de lá que vêm as duas regras que governam todo
 * portão desta pasta:
 *
 *   1. Nenhum portão exige domínio de bloco nascido no PRÓPRIO circuito.
 *      Os intervalos são 1, 6 e depois × ease, então `repetitions >= 4` leva
 *      no mínimo 22 dias — e o circuito tem 14. A primeira versão pedia isso e
 *      era porta trancada por construção: nem um aluno perfeito passava.
 *      Domínio só é cobrado de circuito anterior, com 28 dias de folga.
 *
 *   2. Nenhum portão declara meta de nota de fala abaixo de 6,0, porque
 *      `gradeFromScore` transforma 4,0 em nota 2, e nota 2 é LAPSO: zera
 *      `repetitions`, soma `lapses` e derruba o `ease_factor`. Mandar o
 *      iniciante mirar 4,0 fazia ele destruir a própria agenda a cada
 *      gravação.
 *
 * ===========================================================================
 * O PORTÃO NÃO TRANCA NADA
 * ===========================================================================
 * Isto é decisão de produto e vale para os 52: o portão é DIAGNÓSTICO, não
 * fechadura. Quem não passa não perde acesso ao circuito seguinte — o que
 * muda é a quinzena seguinte, que repete o que ficou para trás dentro do
 * material novo. Trancar conteúdo pago de um adulto que estuda cansado à noite
 * é hostil, e o produto já diz o que cada trilha não entrega.
 *
 * ===========================================================================
 * O QUE AINDA NÃO ESTÁ AQUI
 * ===========================================================================
 * Os blocos em si. Esta pasta é o esqueleto: quantos blocos, sobre o quê, com
 * que som e que peça. As 1.193 frases base e suas famílias são geradas por
 * script, revisadas e versionadas depois — o mesmo caminho de `authentic.json`.
 * Ver PENDENCIAS.md para o que o sistema precisa ganhar antes disso rodar.
 */

import cognatosJson from "./cognatos.json";
import fonologiaJson from "./fonologia.json";
import gramaticaJson from "./gramatica.json";
import orcamentoJson from "./orcamento.json";
import progressaoJson from "./progressao.json";
import rampaJson from "./rampa.json";

export const TOTAL_CIRCUITOS = 52;
export const DIAS_POR_CIRCUITO = 14;

// ===========================================================================
// Rampa: quanto o aluno aguenta, circuito a circuito
// ===========================================================================

export interface CargaDoCircuito {
  n: number;
  canto: number;
  /** A1.1, A1.2, A2.1 ... B2.2 — oito degraus, não quatro. */
  nivel: string;
  /** Blocos base novos. Vai de 8 no circuito 1 a dezenas no meio do curso. */
  blocosNovos: number;
  /** Input que cabe DENTRO da sessão da trilha, sem espremer os outros movimentos. */
  minutosInputDentro: number;
  /**
   * Input passivo prescrito para FORA da sessão — ônibus, louça, academia.
   *
   * É onde mora o volume: 403 das 710 horas do curso. O app prescreve e afere
   * por pergunta, mas não hospeda, e nenhum portão depende deste número.
   * Minuto autodeclarado que destranca conteúdo ensina o aluno a mentir.
   */
  minutosInputFora: number;
  /** O critério medido da quinzena, na trilha Completo. */
  portao: string;
  /**
   * O portão da trilha Essencial (20 min/dia), que não tem escuta medida nem
   * gravação: ela mede o que tem. Null enquanto não escrito.
   */
  portaoEssencial: string | null;
}

export const RAMPA = rampaJson as CargaDoCircuito[];

// ===========================================================================
// Progressão: sobre o que é cada circuito
// ===========================================================================

export interface Progressao {
  n: number;
  titulo: string;
  /** A cena concreta. É isto que substitui o "tema gramatical". */
  situacao: string;
  /** A função comunicativa: cumprimentar, pedir, discordar, contornar. */
  funcao: string;
  /** Por que este circuito vem exatamente nesta posição, e não em outra. */
  porqueAqui: string;
  /** Tarefa real fora do app. */
  missao: string;
  /** O erro típico do brasileiro NESTA situação. */
  armadilha: string;
}

export const PROGRESSAO = progressaoJson as Progressao[];

// ===========================================================================
// Fonologia: onde o português mais atrapalha
// ===========================================================================

/** Um traço só se produz depois de ser ouvido. Vários degraus são só de ouvido. */
export type ModoDoSom = "perceber" | "produzir" | "ambos";

export interface DegrauDeSom {
  circuito: number;
  traco: string;
  /** O que o português faz no lugar, com o mecanismo nomeado e exemplo falado. */
  interferencia: string;
  comoTreinar: string;
  /** Só palavras que o aluno JÁ TEM neste ponto do curso. */
  paresMinimos: [string, string][];
  modo: ModoDoSom;
  /**
   * O teste binário que o app roda na gravação: passou ou não passou.
   *
   * Binário de propósito. Nota de pronúncia com histórico vira mais um número
   * para o aluno se sentir mal, e a fonologia é a parte do curso em que ele já
   * chega envergonhado.
   */
  checagem: string;
}

export const FONOLOGIA = fonologiaJson as DegrauDeSom[];

// ===========================================================================
// Falsos cognatos: o conteúdo mais brasileiro que existe
// ===========================================================================

export interface FalsoCognato {
  en: string;
  oQueOBrasileiroAcha: string;
  oQueSignifica: string;
  /** Sem isto a entrada é inútil: ele precisa sair sabendo como dizer o que queria. */
  comoDizerOQueQueria: string;
  exemploEn: string;
  exemploPt: string;
  circuito: number;
}

export const COGNATOS = cognatosJson as FalsoCognato[];

// ===========================================================================
// Gramática: a peça que emerge depois do uso
// ===========================================================================

export interface DegrauDeGramatica {
  circuito: number;
  /** A peça em português comum, ou o texto "(respiro)" quando não há peça nova. */
  peca: string;
  titulo: string;
  /** Que frase o aluno passa a conseguir dizer. */
  oQueDestrava: string;
  /** A frase ERRADA que ele diz sem esta peça, por transferência do português. */
  erroDoBrasileiro: string;
  /** O texto da carta. Null quando ainda não redigido. */
  corpo: string | null;
  exemplos: { en: string; pt: string }[] | null;
  /** SÓ a frase errada em inglês, sem correção junto. Null quando não redigido. */
  evita: string | null;
}

export const GRAMATICA = gramaticaJson as DegrauDeGramatica[];

/** Respiro é desenho, não falta: circuito de carga alta não recebe peça nova. */
export function ehRespiro(degrau: DegrauDeGramatica): boolean {
  return /respiro/i.test(degrau.peca);
}

// ===========================================================================
// Orçamento: os quatro movimentos, e a exposição travada
// ===========================================================================

export interface OrcamentoDaTrilha {
  trilha: string;
  minutos: number;
  /** Input. A maior fatia, sempre. */
  ouvido: number;
  /** A fila do SRS, em voz alta. */
  memoria: number;
  /** Shadowing e resposta gravada. */
  boca: number;
  /** Um degrau de fonologia. */
  som: number;
  /** O que esta trilha NÃO entrega. Vai para a tela junto com a promessa. */
  observacao: string;
}

export interface ExposicaoTravada {
  mecanismo: string;
  /** Escutas exigidas antes do texto abrir, por canto. O iniciante precisa de mais. */
  escutasPorCanto: number[];
  ondeNoDia: string;
  comoOCodigoImpoe: string;
}

const orc = orcamentoJson as {
  movimentos: OrcamentoDaTrilha[];
  exposicao: ExposicaoTravada;
};

export const ORCAMENTO = orc.movimentos;
export const EXPOSICAO = orc.exposicao;

// ===========================================================================
// Acesso
// ===========================================================================

const porN = <T extends { n: number }>(lista: T[]) => new Map(lista.map((x) => [x.n, x]));
const porCircuito = <T extends { circuito: number }>(lista: T[]) =>
  new Map(lista.map((x) => [x.circuito, x]));

const RAMPA_POR_N = porN(RAMPA);
const PROGRESSAO_POR_N = porN(PROGRESSAO);
const FONOLOGIA_POR_N = porCircuito(FONOLOGIA);
const GRAMATICA_POR_N = porCircuito(GRAMATICA);

export const cargaDe = (n: number) => RAMPA_POR_N.get(n) ?? null;
export const progressaoDe = (n: number) => PROGRESSAO_POR_N.get(n) ?? null;
export const somDe = (n: number) => FONOLOGIA_POR_N.get(n) ?? null;
export const gramaticaDe = (n: number) => GRAMATICA_POR_N.get(n) ?? null;
export const cognatosDe = (n: number) => COGNATOS.filter((c) => c.circuito === n);
export const orcamentoDa = (trilha: string) =>
  ORCAMENTO.find((o) => o.trilha.toLowerCase() === trilha.toLowerCase()) ?? null;

/** 1 a 13 -> canto 1, 14 a 26 -> canto 2, e assim por diante. */
export const cantoDe = (n: number) => Math.min(4, Math.floor((n - 1) / 13) + 1);

/** Quantas escutas antes de o texto abrir, no circuito dado. */
export const escutasExigidas = (n: number) =>
  EXPOSICAO.escutasPorCanto[cantoDe(n) - 1] ?? EXPOSICAO.escutasPorCanto[0];

/**
 * Blocos base acumulados até o fim do circuito dado.
 *
 * Serve para dimensionar a fila: o SRS carrega tudo que já entrou, não só o
 * circuito corrente, e é essa soma que decide se o movimento Memória cabe no
 * orçamento da trilha.
 */
export function blocosAcumulados(ateCircuito: number): number {
  return RAMPA.filter((c) => c.n <= ateCircuito).reduce((a, c) => a + c.blocosNovos, 0);
}

/**
 * Confere que a espinha está inteira antes de qualquer script usá-la.
 *
 * Roda no import pela mesma razão de `assertContentComplete`: uma espinha com
 * buraco no meio produz um curso torto silenciosamente, e isso é pior do que
 * um erro na hora de gerar.
 */
export function assertEspinhaCompleta(): void {
  const problemas: string[] = [];

  const conferirCobertura = (nome: string, tem: (n: number) => unknown) => {
    const falta: number[] = [];
    for (let n = 1; n <= TOTAL_CIRCUITOS; n++) if (!tem(n)) falta.push(n);
    if (falta.length) problemas.push(`${nome}: falta o circuito ${falta.join(", ")}`);
  };

  conferirCobertura("rampa", (n) => RAMPA_POR_N.get(n));
  conferirCobertura("progressao", (n) => PROGRESSAO_POR_N.get(n));
  conferirCobertura("fonologia", (n) => FONOLOGIA_POR_N.get(n));
  conferirCobertura("gramatica", (n) => GRAMATICA_POR_N.get(n));

  // Cada circuito precisa de pelo menos um falso cognato: é a camada que mais
  // rende por palavra num curso para brasileiro, e ela não pode ter buraco.
  const semCognato: number[] = [];
  for (let n = 1; n <= TOTAL_CIRCUITOS; n++) {
    if (!COGNATOS.some((c) => c.circuito === n)) semCognato.push(n);
  }
  if (semCognato.length) {
    problemas.push(`cognatos: nenhum no circuito ${semCognato.join(", ")}`);
  }

  // Os quatro movimentos têm que caber na sessão da trilha, senão o desenho é
  // aritmeticamente impossível — que foi o defeito da primeira versão.
  for (const o of ORCAMENTO) {
    const soma = o.ouvido + o.memoria + o.boca + o.som;
    if (soma > o.minutos) {
      problemas.push(
        `orcamento ${o.trilha}: os movimentos somam ${soma} min numa sessão de ${o.minutos}`,
      );
    }
  }

  if (EXPOSICAO.escutasPorCanto.length !== 4) {
    problemas.push("exposicao: escutasPorCanto precisa de 4 números, um por canto");
  }

  if (problemas.length) {
    throw new Error(`Espinha do método incompleta:\n  ${problemas.join("\n  ")}`);
  }
}

assertEspinhaCompleta();
