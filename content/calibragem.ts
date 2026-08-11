/**
 * A encomenda por canto: quanta variacao cada nivel carrega.
 *
 * Vive no conteudo, e nao no gerador, porque e especificacao pedagogica: fica
 * ao lado da rampa e do orcamento, que sao as outras duas coisas que dizem
 * QUANTO o curso entrega. Dois scripts leem daqui — o que escreve os blocos e
 * o que completa as formas que faltaram.
 */

import { cantoDe } from "./metodo";

// ----------------------------------------------------------------------=====
// A encomenda por canto
//
// Os números não são escolha deste arquivo: vêm da rampa aprovada, onde
// 162x6 + 331x9 + 487x12 + 213x11 = 12.138 frases sobre 1.193 blocos base.
// Mexer aqui sem mexer lá quebra a aritmética do curso.
// ----------------------------------------------------------------------=====

export interface Calibragem {
  /**
   * Faixa de formas por bloco, e nao numero fixo.
   *
   * A primeira versao exigia um numero exato e o resultado foi previsivel: o
   * modelo, obrigado a entregar tres formas de "Nice to meet you", inventou
   * "It's not nice to meet you" e "Is it nice to meet you?". Frases validas
   * que ser humano nenhum diz. Bloco de cumprimento nao tem negativa, bloco de
   * despedida nao tem pergunta, e forcar uma ensina o aluno a falar errado com
   * confianca — que e pior do que nao ensinar.
   *
   * A media do circuito e que sustenta a aritmetica da rampa; o bloco
   * individual entrega o que couber nele.
   */
  formasMin: number;
  formasMax: number;
  formasMedia: number;
  recombinacoes: number;
  /** Teto de palavras numa recombinacao. Iniciante nao sustenta frase longa. */
  maxPalavras: number;
  /** Que caras fazem sentido neste nivel. */
  tipos: string[];
}

export const CALIBRAGEM: Record<number, Calibragem> = {
  1: {
    formasMin: 1,
    formasMax: 4,
    formasMedia: 3,
    recombinacoes: 3,
    maxPalavras: 12,
    tipos: ["negativa", "pergunta", "resposta-curta"],
  },
  2: {
    formasMin: 2,
    formasMax: 6,
    formasMedia: 5,
    recombinacoes: 4,
    maxPalavras: 16,
    tipos: ["negativa", "pergunta", "terceira-pessoa", "passado", "resposta-curta"],
  },
  3: {
    formasMin: 3,
    formasMax: 8,
    formasMedia: 7,
    recombinacoes: 5,
    maxPalavras: 20,
    tipos: [
      "negativa",
      "pergunta",
      "terceira-pessoa",
      "passado",
      "futuro",
      "resposta-curta",
      "educada",
    ],
  },
  4: {
    formasMin: 3,
    formasMax: 8,
    formasMedia: 6,
    recombinacoes: 5,
    maxPalavras: 24,
    tipos: ["negativa", "pergunta", "terceira-pessoa", "passado", "futuro", "informal"],
  },
};

export const calibragemDe = (n: number) => CALIBRAGEM[cantoDe(n)];
