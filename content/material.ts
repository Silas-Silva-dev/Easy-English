/**
 * O material de um circuito: os blocos que ele treina e o diálogo que os
 * devolve em conversa.
 *
 * ===========================================================================
 * POR QUE ISTO EXISTE COMO MÓDULO
 * ===========================================================================
 * Esta função estava copiada em três lugares — o semeador, o verificador e o
 * gerador de pronúncia — com o mesmo corpo e o mesmo defeito. Um defeito
 * copiado três vezes é consertado uma vez e volta duas. Agora é um módulo só,
 * e os três importam daqui.
 *
 * ===========================================================================
 * O CIRCUITO QUE NÃO ENSINA NADA NOVO
 * ===========================================================================
 * Os circuitos 13, 26, 39 e 52 fecham cada canto e têm `blocosNovos: 0` na
 * rampa. Isso é de propósito: são as duas semanas em que o aluno não recebe
 * matéria nenhuma e só prova o que já tem. É o portão do canto.
 *
 * A versão copiada devolvia `null` para eles, porque testava
 * `if (!blocos.length) return null`. O efeito passava despercebido e era
 * grave: o verificador pulava esses circuitos, o gerador de pronúncia pulava,
 * e o semeador ESTOURAVA no dia 169 — quatro circuitos, 56 dias de curso,
 * sem lição nenhuma.
 *
 * O conserto não é devolver lista vazia: é entender que o material de um
 * circuito de consolidação É O CANTO QUE ELE FECHA. Os blocos vêm dos doze
 * circuitos anteriores, escolhidos com espaçamento fixo para que todos os
 * circuitos do canto apareçam e a escolha não mude entre execuções — o seed
 * precisa ser reprodutível.
 *
 * Reensinar um bloco já ensinado não bagunça a agenda: `chunk_mastery` tem
 * `unique (user_id, chunk_key)` com `on conflict do nothing`, então o bloco
 * repetido é reconhecido, não reagendado. O aluno reencontra; o SRS não perde
 * o intervalo que já tinha conquistado.
 */

import blocosJson from "./metodo/blocos.json";
import dialogosJson from "./metodo/dialogos.json";
import { cargaDe, cantoDe } from "./metodo";
import type { Bloco, Fala, MaterialDoCircuito } from "./movimentos";

interface BlocosNoDisco {
  n: number;
  blocos: Bloco[];
}

interface DialogosNoDisco {
  n: number;
  imersao: Fala[];
  escuta: Fala[];
  deriva: string[];
}

const BLOCOS = blocosJson as unknown as BlocosNoDisco[];
const DIALOGOS = dialogosJson as unknown as DialogosNoDisco[];

const BLOCOS_POR_N = new Map(BLOCOS.map((c) => [c.n, c.blocos ?? []]));
const DIALOGOS_POR_N = new Map(DIALOGOS.map((c) => [c.n, c]));

/**
 * Quantos blocos um circuito de consolidação revisita.
 *
 * Não é o canto inteiro: o canto 2 tem 331 blocos e catorze dias não revisam
 * 331 blocos com honestidade — revisam 331 blocos de raspão, que é pior que
 * revisar 24 de verdade. Vinte e quatro é a ordem de grandeza de um circuito
 * normal do canto 1, e cabe nos movimentos sem transbordar.
 */
const BLOCOS_NA_CONSOLIDACAO = 24;

/**
 * A amostra do canto, com todos os circuitos representados.
 *
 * Percorre os circuitos do canto em rodadas, tirando um bloco de cada vez, até
 * completar a cota. Assim o circuito 1 aparece mesmo que o canto tenha doze
 * circuitos e a cota seja vinte e quatro — e aparece PRIMEIRO, que é o que
 * interessa: é o material mais antigo, o de maior chance de ter sumido.
 *
 * O passo dentro de cada circuito é fixo (não é aleatório) para que duas
 * execuções do semeador produzam exatamente a mesma lição.
 */
export function amostraDoCanto(n: number, de: Map<number, Bloco[]> = BLOCOS_POR_N): Bloco[] {
  const canto = cantoDe(n);
  const primeiro = (canto - 1) * 13 + 1;

  const fontes: Bloco[][] = [];
  for (let c = primeiro; c < n; c++) {
    const blocos = de.get(c);
    if (blocos?.length) fontes.push(blocos);
  }
  if (!fontes.length) return [];

  const escolhidos: Bloco[] = [];
  const vistos = new Set<string>();

  for (let rodada = 0; escolhidos.length < BLOCOS_NA_CONSOLIDACAO; rodada++) {
    let pegouAlgo = false;

    for (const blocos of fontes) {
      if (escolhidos.length >= BLOCOS_NA_CONSOLIDACAO) break;
      // Espaçamento fixo dentro do circuito: a rodada 0 pega o primeiro bloco,
      // a rodada 1 pega o do meio, e assim por diante, sem repetir.
      const passo = Math.max(1, Math.floor(blocos.length / 3));
      const alvo = blocos[(rodada * passo) % blocos.length];
      if (!alvo || vistos.has(alvo.en)) continue;
      vistos.add(alvo.en);
      escolhidos.push(alvo);
      pegouAlgo = true;
    }

    // Nenhum circuito tinha bloco novo a oferecer: o canto acabou.
    if (!pegouAlgo) break;
  }

  return escolhidos;
}

/**
 * Monta o material de um circuito, ou `null` quando ele ainda não foi escrito.
 *
 * `null` significa uma coisa só: o gerador ainda não chegou nesse circuito. O
 * semeador estoura, o verificador reclama, o gerador de pronúncia pula — cada
 * um decide o que fazer, e nenhum decide em silêncio.
 */
export function materialDoCircuito(n: number): MaterialDoCircuito | null {
  const carga = cargaDe(n);
  const proprios = BLOCOS_POR_N.get(n) ?? [];

  const blocos = carga?.blocosNovos === 0 ? amostraDoCanto(n) : proprios;
  if (!blocos.length) return null;

  const d = DIALOGOS_POR_N.get(n);

  return {
    n,
    blocos,
    imersao: d?.imersao ?? [],
    escuta: d?.escuta ?? [],
    deriva: d?.deriva ?? [],
  };
}

/**
 * Quantos blocos o diálogo tem que devolver, palavra por palavra.
 *
 * Mora aqui porque DOIS lados precisam do mesmo número: o gerador, que pede ao
 * modelo, e o verificador, que reprova o resultado. Enquanto eram duas contas
 * separadas elas discordaram — o circuito 33 passou no gerador com 10 âncoras
 * e foi reprovado pelo verificador, que ainda usava um quarto dos blocos.
 *
 * Um quarto era a régua, calibrada quando um circuito tinha sete blocos. Com
 * 43, um quarto são onze âncoras em 24 falas: quase metade das falas
 * carregando frase decorada, que é o "desfile de blocos" que o próprio prompt
 * proíbe. O teto de uma âncora a cada três falas faz as duas regras caberem
 * juntas.
 *
 * No circuito de portão a conta é outra: ali os blocos são uma amostra de um
 * canto inteiro, e o que importa é o piso — seis reencontrados provam que o
 * canto ficou.
 */
export function ancorasExigidas(n: number, quantosBlocos: number, quantasFalas: number): number {
  if (ehConsolidacao(n)) return Math.min(6, quantosBlocos);
  return Math.max(2, Math.min(Math.round(quantosBlocos * 0.25), Math.round(quantasFalas / 3)));
}

/** Verdadeiro nos circuitos que fecham um canto e não ensinam matéria nova. */
export function ehConsolidacao(n: number): boolean {
  return cargaDe(n)?.blocosNovos === 0;
}
