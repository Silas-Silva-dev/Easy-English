"use client";

import * as React from "react";

import { marcarFilaZeradaAction } from "./actions";

/**
 * Marca o dia como zerado quando não havia fila nenhuma para zerar.
 *
 * Este é o único caso que `reviewChunkAction` não alcança: quem abre a revisão
 * sem nada vencendo não responde cartão nenhum, então nada dispara o sinal. A
 * prosa dos 52 portões manda o contrário — dia sem fila vencida conta como
 * zerado —, e sem isto o aluno em dia era lido como aluno que não estudou,
 * justamente na trilha Essencial, cujos 48 portões só têm este sinal e a
 * presença para medir.
 *
 * É efeito, não render. Escrever no banco durante o render do server component
 * gravaria presença a cada prefetch do link e a cada revalidação da rota, sem
 * o aluno ter aberto a tela.
 *
 * O componente não desenha nada: a mensagem de "agenda em dia" é do baralho.
 */
export function FilaZerada() {
  const jaDisparou = React.useRef(false);

  React.useEffect(() => {
    // O StrictMode monta duas vezes em desenvolvimento; a action é idempotente,
    // mas a segunda chamada é ida ao servidor sem nada para escrever.
    if (jaDisparou.current) return;
    jaDisparou.current = true;

    void marcarFilaZeradaAction();
  }, []);

  return null;
}
