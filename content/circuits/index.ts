/**
 * O curso inteiro, redigido à mão e versionado no repositório.
 *
 * 52 circuitos x 14 dias = 728 lições. Nenhuma delas é gerada por API:
 * `content/compose-lesson.ts` expande este material de forma determinística,
 * então o que está aqui é exatamente o que o aluno vai ler.
 */

import type { CircuitContent } from "../compose-lesson";

import { CANTO_1 } from "./canto-1";
import { CANTO_2 } from "./canto-2";
import { CANTO_3 } from "./canto-3";
import { CANTO_4 } from "./canto-4";

export const CIRCUIT_CONTENT: CircuitContent[] = [
  ...CANTO_1,
  ...CANTO_2,
  ...CANTO_3,
  ...CANTO_4,
];

export const CONTENT_BY_CIRCUIT = new Map(CIRCUIT_CONTENT.map((c) => [c.n, c]));

/**
 * Garante que não falta nem sobra circuito. Roda no import porque um curso
 * com buraco no meio é pior do que um erro na hora do seed.
 */
export function assertContentComplete(expected: number) {
  const missing: number[] = [];
  for (let n = 1; n <= expected; n++) {
    if (!CONTENT_BY_CIRCUIT.has(n)) missing.push(n);
  }
  if (missing.length) {
    throw new Error(
      `Falta material redigido para ${missing.length} circuito(s): ${missing.join(", ")}.\n` +
        `Escreva em content/circuits/ antes de rodar o seed.`,
    );
  }
  if (CIRCUIT_CONTENT.length !== expected) {
    throw new Error(
      `Há ${CIRCUIT_CONTENT.length} circuitos redigidos para ${expected} esperados — provavelmente um número duplicado.`,
    );
  }
}
