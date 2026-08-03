/**
 * Biblioteca de escuta estendida — o material do dia 8, DENTRO do app.
 *
 * ===========================================================================
 * O QUE MUDOU E POR QUÊ
 * ===========================================================================
 * Antes o dia 8 devolvia uma string de busca: "procure no YouTube um vlog de
 * rotina". A intenção era certa — o aluno precisa de fala que não foi feita
 * para estudante — mas a execução empurrava para fora do app a parte mais
 * pesada do método, e não dava para verificar se foi feita.
 *
 * Na prática isso significava que o item de maior impacto do curso dependia
 * de o aluno ter, por conta própria, disciplina de garimpar material sem
 * orientação nenhuma. Quem não tinha, pulava — e o dia 8 é justamente o dia
 * que separa "entende o professor" de "entende um americano".
 *
 * Agora o material vive aqui: peças longas, em velocidade real, com mais
 * interlocutores e vocabulário mais largo que os diálogos de circuito. O áudio
 * é pré-gerado com voz neural por `scripts/generate-audio.ts`, igual ao resto.
 *
 * ===========================================================================
 * DE ONDE VEM O CONTEÚDO
 * ===========================================================================
 * `scripts/generate-listening.ts` redige as peças com o Gemini e grava em
 * `authentic.json`. A geração acontece UMA VEZ, o resultado é revisado por
 * gente e vai versionado para o repositório — exatamente o princípio que
 * `content/compose-lesson.ts` defende: o curso inteiro pode ser lido e
 * revisado antes de chegar ao aluno, e não muda entre execuções.
 *
 * Enquanto um circuito não tiver peça redigida, o dia 8 continua funcionando
 * com o material do próprio circuito. Nada quebra durante a geração gradual.
 */

import type { Line } from "../compose-lesson";

import rawPieces from "./authentic.json";

/**
 * Pergunta de compreensão. Objeto e não tupla (como o `Q` dos circuitos)
 * porque isto atravessa JSON: campo com nome sobrevive à leitura de quem
 * revisa o arquivo, posição em tupla não.
 */
export interface AuthenticQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface AuthenticPiece {
  /** 1..52 — casa com CircuitSpec.number. */
  n: number;
  kind: "conversa" | "relato" | "entrevista";
  title: string;
  /** Por que ESTA peça, nesta altura do curso. Aparece para o aluno. */
  why: string;
  /** Quanto tempo de escuta, aproximadamente. */
  minutes: number;
  /** As falas, no mesmo formato dos diálogos de circuito. */
  lines: Line[];
  /** Compreensão — é o que torna o dia 8 verificável em vez de confiado. */
  questions: AuthenticQuestion[];
}

// O TypeScript infere `string[][]` do JSON e não sabe que cada fala tem
// exatamente três posições. `scripts/generate-listening.ts` garante o formato
// antes de gravar, e `npm run verify:content` confere depois.
export const AUTHENTIC_PIECES = rawPieces as unknown as AuthenticPiece[];

export const AUTHENTIC_BY_CIRCUIT = new Map(AUTHENTIC_PIECES.map((p) => [p.n, p]));

export function authenticPieceFor(circuitNumber: number): AuthenticPiece | null {
  return AUTHENTIC_BY_CIRCUIT.get(circuitNumber) ?? null;
}

/** Quantos circuitos já têm peça — usado pelos scripts para reportar progresso. */
export function authenticCoverage(total: number): { done: number; missing: number[] } {
  const missing: number[] = [];
  for (let n = 1; n <= total; n++) if (!AUTHENTIC_BY_CIRCUIT.has(n)) missing.push(n);
  return { done: total - missing.length, missing };
}
