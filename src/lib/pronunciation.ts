/**
 * Pronúncia figurada — o inglês escrito com as letras do português.
 *
 *     Nice to meet you.   ->   náis ta mît iu.
 *
 * ===========================================================================
 * POR QUE ISSO EXISTE
 * ===========================================================================
 * O iniciante brasileiro lê "Nice to meet you" e a boca dele produz
 * "nice-e tô mít iou", porque o cérebro aplica a fonética do português às
 * letras. Isso não é preguiça: é o único sistema de leitura que ele tem.
 *
 * A figuração dá um sistema que ele JÁ sabe ler e que aponta para o som certo.
 * Ela não substitui ouvir — o áudio continua sendo a fonte —, mas fecha o
 * buraco entre "ouvi e entendi" e "consigo repetir sem olhar".
 *
 * ===========================================================================
 * COMO LER
 * ===========================================================================
 *   acento (á, î, ô)  a sílaba forte da palavra
 *   th                língua entre os dentes, soprando (think)
 *   dh                o mesmo, com voz (this)
 *   r                 no fim de sílaba é o "r" americano, enrolado
 *   ta, a             vogal fraca, quase engolida — é assim mesmo
 *
 * O mapa é gerado por `npm run gen:pronuncia` a partir dos fonemas reais do
 * espeak-ng, nunca da grafia inglesa. Ver `scripts/respell.py`.
 */

import map from "@content/pronunciation.json";

const TABLE = map as Record<string, string>;

/**
 * A figuração de um texto, ou null se não houver.
 *
 * A chave é o texto normalizado no espaço em branco, igual ao que o gerador
 * usou. Devolver null é normal e esperado: frase nova ainda sem rodada de
 * geração simplesmente não mostra a linha, em vez de mostrar algo errado.
 */
export function pronunciationOf(text: string): string | null {
  const key = text.replace(/\s+/g, " ").trim();
  return TABLE[key] ?? null;
}
