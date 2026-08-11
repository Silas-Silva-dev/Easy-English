/**
 * Os 104 portões, lidos da prosa que já os define.
 *
 * ===========================================================================
 * POR QUE UM PARSER, E NÃO UM SEGUNDO JSON
 * ===========================================================================
 * Cada circuito de `rampa.json` já traz `portao` (Completo e Intensivo) e
 * `portaoEssencial` escritos por extenso, e essa prosa é o que o aluno lê na
 * tela. Escrever os mesmos números de novo num arquivo estruturado criaria
 * duas fontes para a mesma regra, e a segunda começaria a divergir da primeira
 * no primeiro ajuste de rampa — sem erro, sem aviso, e com a tela mostrando um
 * critério e o motor cobrando outro.
 *
 * Então a prosa continua sendo a fonte, e este arquivo extrai dela. O preço é
 * a fragilidade do casamento por expressão regular; o pagamento é
 * `assertPortoesCompletos()`, que roda no import e recusa a espinha inteira se
 * qualquer um dos 104 deixar de casar. Um portão que o parser não entende é um
 * portão que o produto não sabe avaliar: melhor derrubar o build do que
 * publicar um circuito cujo critério silenciosamente virou "nenhum".
 *
 * ===========================================================================
 * OS SEIS COMPONENTES
 * ===========================================================================
 * Toda a prosa dos 104 se reduz a seis formas, e nenhuma outra aparece:
 *
 *   input      "11 dos 14 dias com o input da sessão registrado"
 *   licao      "11 dos 14 dias com a lição concluída"           (só Essencial)
 *   fila       "10 dos 14 dias com a fila zerada"               (só Essencial)
 *   novos      "5 dos 8 blocos novos com repetitions >= 2 e spoken_count >= 2"
 *   acumulado  "130 dos 162 blocos acumulados até aqui com repetitions >= 4…"
 *   defasado   "6 dos 12 blocos do circuito 5 com repetitions >= 4…"
 *   nota       "nota de fala >= 6,0"                            (15 circuitos)
 *
 * A Essencial escreve os três de bloco com "do núcleo" no meio ("2 dos 3
 * blocos do núcleo deste circuito"). Não é um sétimo componente: é o mesmo
 * componente sobre um baralho menor, e é por isso que `escopo` existe. O
 * recorte do núcleo já é o que `enroll_circuit_chunks` matricula para essa
 * trilha, então avaliar é filtrar por `is_core` e nada mais.
 *
 * ===========================================================================
 * O QUE ESTE ARQUIVO NÃO DECIDE
 * ===========================================================================
 * Se passar importa. O portão é diagnóstico e não fechadura — está escrito no
 * cabeçalho de `index.ts` e vale aqui: nada nestes componentes tranca conteúdo.
 * Eles existem para o aluno ver POR QUE passou ou não, e para a quinzena
 * seguinte saber o que repetir dentro do material novo.
 *
 * A tarefa falada de cada portão ("atravessa um dia inteiro em inglês numa
 * conversa de 10 minutos com a Emma") também fica de fora: ela não tem número
 * e não é avaliável por consulta. Ela continua na prosa, que vai inteira para
 * a tela em `texto`.
 */

import { RAMPA, TOTAL_CIRCUITOS } from "./index";

export type TrilhaDoPortao = "completo" | "essencial";

/** O baralho sobre o qual um componente de bloco conta. */
export type EscopoDoBaralho = "todos" | "nucleo";

export type ComponenteDoPortao =
  /** Dias com input da sessão registrado (`study_days.input_minutes > 0`). */
  | { tipo: "input"; exigido: number; de: number }
  /** Dias com a lição do dia concluída. */
  | { tipo: "licao"; exigido: number; de: number }
  /** Dias em que a fila de revisão terminou zerada. */
  | { tipo: "fila"; exigido: number; de: number }
  /** Blocos nascidos NESTE circuito. */
  | {
      tipo: "novos";
      exigido: number;
      de: number;
      repeticoes: number;
      faladas: number;
      escopo: EscopoDoBaralho;
    }
  /** Todos os blocos do curso até aqui. Só nos quatro fechamentos. */
  | {
      tipo: "acumulado";
      exigido: number;
      de: number;
      repeticoes: number;
      faladas: number;
      escopo: EscopoDoBaralho;
    }
  /** Blocos de um circuito anterior, com 28 dias de folga. */
  | {
      tipo: "defasado";
      exigido: number;
      de: number;
      repeticoes: number;
      faladas: number;
      escopo: EscopoDoBaralho;
      circuito: number;
    }
  /** Nota de fala mínima. Só do circuito 27 em diante. */
  | { tipo: "nota"; minimo: number };

export interface PortaoDoCircuito {
  n: number;
  trilha: TrilhaDoPortao;
  /** Circuito sem bloco novo: 13, 26, 39 e 52. */
  fechamento: boolean;
  componentes: ComponenteDoPortao[];
  /** A prosa original, que é o que vai para a tela. */
  texto: string;
}

/**
 * Um número escrito em português vira número.
 *
 * As notas de fala aparecem como "6,0" e "7,5" — vírgula, porque a prosa é
 * escrita para o aluno brasileiro e não para o parser.
 */
const numero = (s: string) => Number(s.replace(",", "."));

/**
 * "do núcleo" no meio da frase é o que separa o baralho da Essencial do
 * baralho completo. Escrito uma vez para as três formas de bloco usarem.
 */
const NUCLEO = "(?:do n[uú]cleo )?";

const PADROES = {
  input: /(\d+) dos (\d+) dias com o input da sess[aã]o registrado/,
  licao: /(\d+) dos (\d+) dias com a li[cç][aã]o conclu[ií]da/,
  fila: /(\d+) dos (\d+) dias com a fila zerada/,
  novos: new RegExp(
    `(\\d+) dos (\\d+) blocos ${NUCLEO}(?:novos|deste circuito) com repetitions >= (\\d+)(?: e spoken_count >= (\\d+))?`,
  ),
  acumulado: new RegExp(
    `(\\d+) dos (\\d+) blocos ${NUCLEO}acumulados? (?:at[eé] aqui )?com repetitions >= (\\d+)(?: e spoken_count >= (\\d+))?`,
  ),
  defasado: new RegExp(
    `(\\d+) dos (\\d+) blocos ${NUCLEO}do circuito (\\d+) com repetitions >= (\\d+)(?: e spoken_count >= (\\d+))?`,
  ),
  nota: /nota(?: de fala)? >= (\d+[,.]\d+)/,
} as const;

/**
 * Fica só com as frases que falam DESTA trilha.
 *
 * Todo portão da Essencial termina explicando o que o Completo cobra no mesmo
 * circuito — é assim que o aluno do caminho curto sabe o que está trocando. Só
 * que treze dessas frases carregam número ("O Completo cobra 12 phrasal verbs
 * em conversa com a força na partícula, nota >= 6,5"), e o parser ingênuo lia
 * aquele 6,5 como exigência da Essencial: a trilha ganhava uma nota de fala na
 * mesma frase em que o texto diz que ela não grava e portanto não tem nota.
 * Treze portões impossíveis, sem erro nenhum.
 *
 * Cortar por frase, e não no primeiro "O Completo cobra", é o que funciona:
 * cinco circuitos escrevem a comparação em minúscula e no meio de uma oração.
 * Nenhuma frase que nomeia a outra trilha carrega exigência PRÓPRIA — está
 * conferido para os 104, e `assertPortoesCompletos` continua conferindo.
 */
function frasesDaPropriaTrilha(texto: string, trilha: TrilhaDoPortao): string {
  const outra = trilha === "essencial" ? /completo/i : /essencial/i;
  return texto
    .split(/(?<=[.!?])\s+|\s+—\s+/)
    .filter((frase) => !outra.test(frase))
    .join(" ");
}

function componentesDe(
  textoBruto: string,
  escopo: EscopoDoBaralho,
  trilha: TrilhaDoPortao,
): ComponenteDoPortao[] {
  const texto = frasesDaPropriaTrilha(textoBruto, trilha);
  const saida: ComponenteDoPortao[] = [];

  const input = PADROES.input.exec(texto);
  if (input) saida.push({ tipo: "input", exigido: +input[1], de: +input[2] });

  const licao = PADROES.licao.exec(texto);
  if (licao) saida.push({ tipo: "licao", exigido: +licao[1], de: +licao[2] });

  const fila = PADROES.fila.exec(texto);
  if (fila) saida.push({ tipo: "fila", exigido: +fila[1], de: +fila[2] });

  // A ordem importa: o padrão de "defasado" também casaria o miolo de outras
  // frases se rodasse antes, porque "blocos do circuito N" é sufixo comum.
  const novos = PADROES.novos.exec(texto);
  if (novos) {
    saida.push({
      tipo: "novos",
      exigido: +novos[1],
      de: +novos[2],
      repeticoes: +novos[3],
      faladas: novos[4] ? +novos[4] : 0,
      escopo,
    });
  }

  const acumulado = PADROES.acumulado.exec(texto);
  if (acumulado) {
    saida.push({
      tipo: "acumulado",
      exigido: +acumulado[1],
      de: +acumulado[2],
      repeticoes: +acumulado[3],
      faladas: acumulado[4] ? +acumulado[4] : 0,
      escopo,
    });
  }

  const defasado = PADROES.defasado.exec(texto);
  if (defasado) {
    saida.push({
      tipo: "defasado",
      exigido: +defasado[1],
      de: +defasado[2],
      circuito: +defasado[3],
      repeticoes: +defasado[4],
      faladas: defasado[5] ? +defasado[5] : 0,
      escopo,
    });
  }

  const nota = PADROES.nota.exec(texto);
  if (nota) saida.push({ tipo: "nota", minimo: numero(nota[1]) });

  return saida;
}

export const PORTOES: PortaoDoCircuito[] = RAMPA.flatMap((carga) => {
  const fechamento = carga.blocosNovos === 0;
  return [
    {
      n: carga.n,
      trilha: "completo" as const,
      fechamento,
      componentes: componentesDe(carga.portao, "todos", "completo"),
      texto: carga.portao,
    },
    {
      n: carga.n,
      trilha: "essencial" as const,
      fechamento,
      // O tipo admite null ("null enquanto não escrito"), e os 52 já estão
      // escritos. Cair para texto vazio aqui em vez de derrubar o parse deixa
      // `assertPortoesCompletos` reportar QUAL circuito falta, com nome, em vez
      // de estourar um TypeError sem circuito nenhum no rastro.
      componentes: componentesDe(carga.portaoEssencial ?? "", "nucleo", "essencial"),
      texto: carga.portaoEssencial ?? "",
    },
  ];
});

const POR_CHAVE = new Map(PORTOES.map((p) => [`${p.trilha}:${p.n}`, p]));

/**
 * O portão de um circuito para uma trilha.
 *
 * O Intensivo usa o portão do Completo: as duas trilhas medem as mesmas
 * coisas, e o que o Intensivo compra é volume e velocidade, não um critério
 * diferente. Está dito no orçamento dele.
 */
export function portaoDe(n: number, trilha: "essential" | "complete" | "intensive") {
  const chave = trilha === "essential" ? "essencial" : "completo";
  return POR_CHAVE.get(`${chave}:${n}`) ?? null;
}

/**
 * A nota de fala que este circuito espera.
 *
 * É o ponto em que `gradeFromScore` devolve 4 — o degrau NEUTRO do SM-2, onde
 * quem entrega o esperado não sobe nem desce o `ease_factor`. Sem isto a escala
 * era absoluta e o aluno do circuito 3 era medido contra o que o circuito 27
 * espera dele.
 *
 * Do C1 ao C26 nenhum portão declara nota, e isso não é omissão: a espinha diz
 * que ninguém é avaliado em fala antes de o material sustentar a avaliação. Ali
 * o piso devolvido é o 6,0 do primeiro portão que declara — a nota ainda entra
 * na agenda pela gravação, e `gradeFromSpokenChunk` já garante que ela nunca
 * fabrique lapso.
 */
export function pisoDeFala(
  n: number,
  trilha: "essential" | "complete" | "intensive" = "complete",
): number {
  const nota = portaoDe(n, trilha)?.componentes.find((c) => c.tipo === "nota");
  return nota && nota.tipo === "nota" ? nota.minimo : 6.0;
}

/**
 * Recusa a espinha se qualquer portão deixou de ser legível.
 *
 * Roda no import pelo mesmo motivo de `assertEspinhaCompleta`: um portão que
 * o parser não entendeu vira um portão de zero componentes, e um portão de
 * zero componentes PASSA — o aluno receberia aprovação automática num circuito
 * que não fez. Falhar aqui é barulhento e barato; falhar em produção é mudo.
 */
export function assertPortoesCompletos(): void {
  const problemas: string[] = [];

  if (PORTOES.length !== TOTAL_CIRCUITOS * 2) {
    problemas.push(`esperados ${TOTAL_CIRCUITOS * 2} portões, encontrados ${PORTOES.length}`);
  }

  for (const portao of PORTOES) {
    const onde = `C${portao.n} (${portao.trilha})`;
    const tipos = new Set(portao.componentes.map((c) => c.tipo));

    // Dois componentes é o mínimo estrutural: presença mais alguma medida de
    // bloco. Um portão com menos que isso não distingue quem estudou.
    if (portao.componentes.length < 2) {
      problemas.push(`${onde}: só ${portao.componentes.length} componente(s) legível(is)`);
      continue;
    }

    const temPresenca = tipos.has("input") || tipos.has("licao");
    if (!temPresenca) problemas.push(`${onde}: nenhum componente de presença`);

    const temBloco = tipos.has("novos") || tipos.has("acumulado") || tipos.has("defasado");
    if (!temBloco) problemas.push(`${onde}: nenhum componente de bloco`);

    // O fechamento cobra o acervo inteiro; o circuito comum cobra os blocos
    // que nasceram nele. Trocar os dois inverteria o sentido do portão.
    if (portao.fechamento && !tipos.has("acumulado")) {
      problemas.push(`${onde}: fechamento sem componente acumulado`);
    }
    if (!portao.fechamento && !tipos.has("novos")) {
      problemas.push(`${onde}: circuito comum sem componente de blocos novos`);
    }

    // A Essencial não grava, então não tem de onde tirar nota de fala — está
    // escrito nos 52 portões dela. Um `nota` aqui é sinal de que o corte por
    // frase deixou passar a comparação com o Completo, e o efeito seria um
    // portão que nenhum aluno dessa trilha pode passar.
    if (portao.trilha === "essencial" && tipos.has("nota")) {
      problemas.push(`${onde}: Essencial não mede fala, mas o parser achou nota`);
    }

    for (const c of portao.componentes) {
      if ("de" in c && (c.exigido <= 0 || c.exigido > c.de)) {
        problemas.push(`${onde}: ${c.tipo} pede ${c.exigido} de ${c.de}`);
      }
      if (c.tipo === "nota" && (c.minimo < 6 || c.minimo > 10)) {
        // 6,0 é o menor piso que a espinha declara, e ela declara isso de
        // propósito: `index.ts` registra que nenhum portão desce abaixo dali
        // porque mandar o iniciante mirar 4,0 é mandá-lo destruir a própria
        // agenda. Um valor fora da faixa aqui é sinal de que o parser leu a
        // frase errada — foi assim que treze portões da Essencial ganharam a
        // nota que o Completo cobra —, não de uma decisão pedagógica nova.
        problemas.push(`${onde}: nota mínima ${c.minimo} fora de 6,0 a 10,0`);
      }
    }
  }

  if (problemas.length) {
    throw new Error(
      `Portões ilegíveis em content/metodo/rampa.json:\n  - ${problemas.join("\n  - ")}`,
    );
  }
}

assertPortoesCompletos();
