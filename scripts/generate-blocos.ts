/**
 * Redige os blocos do curso: as frases prontas que o aluno põe na boca.
 *
 * ----------------------------------------------------------------------=====
 * O QUE ISTO CONSERTA
 * ----------------------------------------------------------------------=====
 * O curso v1 tinha 364 blocos, exatamente 7 por circuito do 1 ao 52, e os
 * mesmos 7 apareciam byte a byte idênticos em 13 dos 14 dias. Não existia
 * conjugação, negação, interrogação nem tempo verbal em lugar nenhum do
 * código: a variação total de um circuito eram 12 enunciados contra 7 blocos
 * repetidos treze vezes.
 *
 * Repetição não era o defeito. Repetição da MESMA FORMA era: reconhecer fica
 * fácil e produzir não transfere.
 *
 * Aqui cada bloco nasce com FAMÍLIA — o mesmo sentido em outras caras
 * (negativa, pergunta, terceira pessoa, passado, futuro, resposta curta) — e
 * com RECOMBINAÇÕES, que são o bloco DENTRO de frases maiores, não ao lado
 * delas. É a diferença entre saber a frase e ter a frase.
 *
 * ----------------------------------------------------------------------=====
 * DUAS FASES, E POR QUÊ
 * ----------------------------------------------------------------------=====
 * Um circuito do Canto 3 tem 47 blocos com 12 itens de família cada: 564
 * frases numa resposta só. Modelo nenhum devolve isso inteiro sem cortar no
 * meio, e cortar no meio de um JSON perde o circuito todo.
 *
 * Então: fase 1 redige os blocos base do circuito (uma chamada), fase 2 redige
 * as famílias em lotes pequenos (várias chamadas). O circuito só é gravado
 * quando as duas fases fecham — meio circuito no arquivo é pior que circuito
 * faltando, porque o verificador acha que está pronto.
 *
 * ----------------------------------------------------------------------=====
 * DE ONDE VEM A ENCOMENDA
 * ----------------------------------------------------------------------=====
 * `content/metodo/` decide tudo: quantos blocos (rampa), sobre o quê
 * (progressão), com que som (fonologia), com que peça de gramática, e quais
 * falsos cognatos colidem ali. Este script não inventa currículo — ele escreve
 * o que a espinha decidiu, e reprova o que não obedecer.
 *
 * Uso:
 *   npm run gen:blocos                      escreve o que falta
 *   npm run gen:blocos -- --circuito 3      só o circuito 3
 *   npm run gen:blocos -- --limite 5        para depois de 5 circuitos
 *   npm run gen:blocos -- --force           refaz mesmo o que já existe
 *   npm run gen:blocos -- --watch           espera a cota renovar e continua
 *   npm run gen:blocos -- --dry             mostra a encomenda sem chamar a API
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  cantoDe,
  cargaDe,
  cognatosDe,
  gramaticaDe,
  progressaoDe,
  RAMPA,
  somDe,
} from "@content/metodo";
import { chunkKey, chunksSpokenIn } from "@/lib/srs";

import { env, genaiBatch, sleep } from "./_shared";

// ----------------------------------------------------------------------=====
// A encomenda por canto
//
// Os números não são escolha deste arquivo: vêm da rampa aprovada, onde
// 162x6 + 331x9 + 487x12 + 213x11 = 12.138 frases sobre 1.193 blocos base.
// Mexer aqui sem mexer lá quebra a aritmética do curso.
// ----------------------------------------------------------------------=====

interface Calibragem {
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

const CALIBRAGEM: Record<number, Calibragem> = {
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

const calibragemDe = (n: number) => CALIBRAGEM[cantoDe(n)];

/** Quantos blocos por chamada na fase 2. Acima disso a resposta corta no meio. */
const LOTE_FAMILIA = 6;

const JSON_PATH = join(process.cwd(), "content", "metodo", "blocos.json");

// ----------------------------------------------------------------------=====
// Forma dos dados
// ----------------------------------------------------------------------=====

export interface Forma {
  tipo: string;
  en: string;
  pt: string;
}

export interface Bloco {
  en: string;
  pt: string;
  /** O gatilho de memória: em que momento esta frase se usa. */
  quando: string;
  formas: Forma[];
  recombinacoes: { en: string; pt: string }[];
}

export interface BlocosDoCircuito {
  n: number;
  blocos: Bloco[];
}

// ----------------------------------------------------------------------=====
// Regras que o texto tem que obedecer
// ----------------------------------------------------------------------=====

/**
 * Inglês de livro, que o curso proíbe. A regra está escrita em `canto-1.ts`
 * desde o primeiro dia: "inglês americano falado, contrações sempre". Um
 * "I am fine" ensina o aluno a soar como legenda de filme antigo.
 */
const SEM_CONTRACAO =
  /\b(I am|it is|that is|there is|he is|she is|we are|they are|you are|do not|does not|did not|is not|are not|was not|were not|cannot|will not|would not|should not|have not|has not)\b/;

const palavras = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

class Reprovado extends Error {}

function exigir(condicao: boolean, motivo: string): asserts condicao {
  if (!condicao) throw new Reprovado(motivo);
}

function validarBase(
  n: number,
  blocos: { en: string; pt: string; quando: string }[],
  jaExistem: Set<string>,
) {
  const carga = cargaDe(n)!;

  exigir(
    blocos.length === carga.blocosNovos,
    `vieram ${blocos.length} blocos e o circuito ${n} pede exatamente ${carga.blocosNovos}`,
  );

  const vistos = new Set<string>();

  for (const b of blocos) {
    exigir(!!b.en?.trim(), "bloco sem inglês");
    exigir(!!b.pt?.trim(), `o bloco "${b.en}" veio sem tradução`);
    exigir(!!b.quando?.trim(), `o bloco "${b.en}" veio sem o gatilho "quando"`);

    const semContracao = b.en.match(SEM_CONTRACAO);
    exigir(!semContracao, `"${b.en}" usa "${semContracao?.[0]}" — o curso exige contração na fala`);

    exigir(!b.en.includes("/"), `"${b.en}" tem barra, que é o separador de roteiro do player`);

    const chave = chunkKey(b.en);
    exigir(!vistos.has(chave), `"${b.en}" aparece duas vezes no mesmo circuito`);
    exigir(!jaExistem.has(chave), `"${b.en}" já foi ensinado num circuito anterior`);
    vistos.add(chave);
  }
}

function validarFamilias(n: number, blocos: Bloco[]) {
  const cal = calibragemDe(n);

  for (const b of blocos) {
    exigir(
      b.formas.length >= cal.formasMin && b.formas.length <= cal.formasMax,
      `"${b.en}": vieram ${b.formas.length} formas e o nivel aceita de ${cal.formasMin} a ${cal.formasMax}`,
    );
    exigir(
      b.recombinacoes.length === cal.recombinacoes,
      `"${b.en}": vieram ${b.recombinacoes.length} recombinacoes e o nivel pede ${cal.recombinacoes}`,
    );

    const base = chunkKey(b.en);
    const vistas = new Set<string>([base]);

    for (const f of b.formas) {
      exigir(!!f.en?.trim() && !!f.pt?.trim(), `"${b.en}": forma sem ingles ou sem traducao`);

      const semContracao = f.en.match(SEM_CONTRACAO);
      exigir(!semContracao, `"${f.en}" usa "${semContracao?.[0]}" — o curso exige contracao`);

      const chave = chunkKey(f.en);
      exigir(chave !== base, `"${f.en}" e igual ao bloco base: nao e outra cara, e a mesma`);
      exigir(!vistas.has(chave), `"${f.en}" repete outra forma do mesmo bloco`);
      vistas.add(chave);
    }

    for (const r of b.recombinacoes) {
      exigir(
        !!r.en?.trim() && !!r.pt?.trim(),
        `"${b.en}": recombinacao sem ingles ou sem traducao`,
      );

      // A contracao vale aqui tambem. Faltava, e um "That's great, I am so
      // happy for you" passou batido na primeira rodada.
      const semContracao = r.en.match(SEM_CONTRACAO);
      exigir(!semContracao, `"${r.en}" usa "${semContracao?.[0]}" — o curso exige contracao`);

      // A regra que faz esta camada valer alguma coisa: a recombinacao tem que
      // conter o bloco DENTRO dela. Sem isto o modelo entrega uma frase
      // qualquer sobre o mesmo assunto, e o aluno nao reencontra o que treinou.
      exigir(
        chunksSpokenIn(r.en, [{ en: b.en }]).length > 0,
        `"${r.en}" nao contem o bloco "${b.en}" — recombinacao e o bloco DENTRO da frase, nao ao lado`,
      );

      exigir(
        palavras(r.en) <= cal.maxPalavras,
        `"${r.en}" tem ${palavras(r.en)} palavras e o nivel permite ${cal.maxPalavras}`,
      );
    }
  }
}

/**
 * A media de formas do circuito inteiro.
 *
 * Cada bloco entrega o que couber nele, mas o circuito precisa fechar perto da
 * media, senao a aritmetica da rampa (1.193 blocos x ~10 itens = 12.138 frases)
 * deixa de valer. Roda so quando o circuito esta completo.
 */
function validarMediaDoCircuito(n: number, blocos: Bloco[]) {
  const cal = calibragemDe(n);
  const media = blocos.reduce((a, b) => a + b.formas.length, 0) / blocos.length;
  exigir(
    media >= cal.formasMedia - 0.8,
    `o circuito ${n} fechou com media de ${media.toFixed(1)} formas por bloco e o nivel pede ~${cal.formasMedia}`,
  );
}

// ----------------------------------------------------------------------=====
// Os prompts
// ----------------------------------------------------------------------=====

const REGRAS = `
REGRAS DE ESCRITA, e elas reprovam a entrega quando quebradas:
  - Inglês americano FALADO, não inglês de livro. CONTRAÇÃO SEMPRE: "I'm",
    "it's", "don't", "he's", "that's". Escrever "I am fine" reprova a entrega.
  - Frase que uma pessoa real diria em voz alta, naquela situação, hoje.
    Nada de frase de exercício ("The book is on the table").
  - Tradução em português do Brasil, natural, do jeito que um brasileiro diria
    a mesma coisa. Não é tradução literal palavra por palavra.
  - Sem barra "/" em lugar nenhum: é o separador de roteiro do player.
  - Nada de gíria datada nem de regionalismo americano obscuro.
`;

function promptBase(n: number, anteriores: string[]): string {
  const carga = cargaDe(n)!;
  const prog = progressaoDe(n)!;
  const gram = gramaticaDe(n)!;
  const som = somDe(n)!;
  const cogs = cognatosDe(n);
  const respiro = /respiro/i.test(gram.peca);

  const sobreGramatica = respiro
    ? "Este circuito não introduz peça nova: use naturalmente o que os circuitos anteriores já deram."
    : `Ela destrava: ${gram.oQueDestrava}\n  O erro que o brasileiro comete sem ela: "${gram.erroDoBrasileiro}"`;

  const sobreCognatos = cogs.length
    ? `FALSOS COGNATOS que colidem neste assunto:\n` +
      cogs
        .map(
          (c) =>
            `  - "${c.en}" não é "${c.oQueOBrasileiroAcha}": é "${c.oQueSignifica}". ` +
            `Para dizer o que ele queria: ${c.comoDizerOQueQueria}`,
        )
        .join("\n") +
      `\n  Se algum couber naturalmente num bloco, use-o CERTO.\n`
    : "";

  const sobreAnteriores = anteriores.length
    ? `JÁ ENSINADO nos circuitos anteriores — não repita nenhuma destas:\n` +
      anteriores
        .slice(-80)
        .map((s) => `  ${s}`)
        .join("\n") +
      "\n"
    : "";

  return `Você escreve o conteúdo do curso de inglês "4 Cantos", para brasileiros.
Escreva os BLOCOS do circuito ${n}.

Bloco é uma frase pronta que o aluno põe na boca inteira, sem montar palavra por
palavra. É a unidade do curso.

O CIRCUITO ${n} — "${prog.titulo}"  (Canto ${cantoDe(n)}, nível ${carga.nivel})

  A situação: ${prog.situacao}

  A função comunicativa: ${prog.funcao}

  Por que este circuito vem exatamente aqui: ${prog.porqueAqui}

  A armadilha do brasileiro nesta situação: ${prog.armadilha}

  A missão do aluno, fora do app: ${prog.missao}

QUANTOS: exatamente ${carga.blocosNovos} blocos. Nem um a mais, nem um a menos.

A PEÇA DE GRAMÁTICA que este circuito faz emergir: ${gram.peca}
  ${sobreGramatica}
  IMPORTANTE: os blocos têm que USAR essa peça naturalmente, sem explicá-la.
  A explicação vem depois, em outro lugar do curso. Aqui é só uso.

O TRAÇO DE PRONÚNCIA deste circuito: ${som.traco}
  ${som.interferencia}
  Procure incluir, sem forçar, palavras onde esse traço apareça — é nelas que o
  aluno vai treinar a boca.

${sobreCognatos}${sobreAnteriores}${REGRAS}
Para cada bloco devolva:
  en      a frase em inglês falado
  pt      a tradução natural
  quando  o gatilho de memória: em que momento essa frase se usa. Curto, uma
          linha, em português. Exemplo: "Logo depois de dizer o nome".`;
}

function promptFamilia(n: number, blocos: { en: string; pt: string }[]): string {
  const cal = calibragemDe(n);
  const prog = progressaoDe(n)!;
  const carga = cargaDe(n)!;

  return `Voce escreve o conteudo do curso de ingles "4 Cantos", para brasileiros.
Escreva a FAMILIA de cada bloco abaixo, do circuito ${n} ("${prog.titulo}", ${carga.nivel}).

Familia e o mesmo bloco em outras caras. E o que impede o aluno de decorar uma
frase congelada: ele passa a ter o MOLDE, e nao a foto.

OS BLOCOS:
${blocos.map((b, i) => `  ${i + 1}. "${b.en}"  (${b.pt})`).join(String.fromCharCode(10))}

----------------------------------------------------------------------
A REGRA QUE MANDA EM TODAS AS OUTRAS
----------------------------------------------------------------------
So escreva frase que uma pessoa de verdade DIRIA EM VOZ ALTA. Se voce nunca
ouviu um americano falar aquilo, nao escreva. Frase gramaticalmente correta que
ninguem usa e PIOR do que frase nenhuma: ela ensina o aluno a falar errado com
confianca, e ele so vai descobrir na cara de espanto do interlocutor.

Estes erros sao reais, saiam de uma tentativa anterior, e reprovam a entrega:
  "Hi, I'm not Alex."           <- ninguem se apresenta negando o proprio nome
  "It's not nice to meet you."  <- cumprimento nao tem negativa
  "Is it nice to meet you?"     <- nem pergunta
  "Are you good, thanks?"       <- o "thanks" nao sobrevive a inversao
  "Don't have a good night."    <- despedida nao vira ordem negativa
  "Hey there, Hi, I'm Alex."    <- dois cumprimentos colados nao e ingles
  "I'm asking, how are you?"    <- ninguem anuncia que esta perguntando

----------------------------------------------------------------------
O QUE DEVOLVER, PARA CADA BLOCO
----------------------------------------------------------------------

FORMAS: de ${cal.formasMin} a ${cal.formasMax}, e o numero e SEU. Entregue so as
que fizerem sentido de verdade para aquele bloco. Um cumprimento normalmente tem
uma ou nenhuma; um verbo de acao costuma ter quatro ou cinco. Nao complete
numero: e melhor devolver uma forma boa do que quatro com tres inventadas.
Mire numa media de ${cal.formasMedia} ao longo dos ${blocos.length} blocos deste lote.
Tipos disponiveis neste nivel: ${cal.tipos.join(", ")}.
Nenhuma forma pode ser igual ao bloco base nem a outra forma do mesmo bloco.

RECOMBINACOES: exatamente ${cal.recombinacoes}. E o bloco DENTRO de uma frase
maior, nao ao lado dela. Regra dura, verificada por script: o texto do bloco tem
que aparecer LITERALMENTE dentro da recombinacao, com as mesmas palavras na
mesma ordem. Maximo de ${cal.maxPalavras} palavras.

  CERTO, para "I'm good, thanks":
     "I'm good, thanks, but I could use a coffee before we start."
  ERRADO, porque o bloco nao aparece inteiro:
     "I'm doing fine, and I'd love some coffee."
  ERRADO, porque a emenda nao e ingles:
     "Hey there, I'm good, thanks, hello."

  A recombinacao tem que soar como conversa, nao como exercicio de encaixe. Se
  para caber o bloco voce precisou escrever algo torto, escolha outro contexto.

No campo "en" de cada bloco, copie o bloco base EXATAMENTE como ele veio, para as
familias poderem ser casadas com os blocos certos.
${REGRAS}`;
}

// ----------------------------------------------------------------------=====
// Esquemas
// ----------------------------------------------------------------------=====

const ESQUEMA_BASE = {
  type: "object",
  required: ["blocos"],
  properties: {
    blocos: {
      type: "array",
      items: {
        type: "object",
        required: ["en", "pt", "quando"],
        properties: {
          en: { type: "string" },
          pt: { type: "string" },
          quando: { type: "string" },
        },
      },
    },
  },
};

const ESQUEMA_FAMILIA = {
  type: "object",
  required: ["blocos"],
  properties: {
    blocos: {
      type: "array",
      items: {
        type: "object",
        required: ["en", "formas", "recombinacoes"],
        properties: {
          en: { type: "string", description: "o bloco base, copiado exatamente" },
          formas: {
            type: "array",
            items: {
              type: "object",
              required: ["tipo", "en", "pt"],
              properties: {
                tipo: { type: "string" },
                en: { type: "string" },
                pt: { type: "string" },
              },
            },
          },
          recombinacoes: {
            type: "array",
            items: {
              type: "object",
              required: ["en", "pt"],
              properties: { en: { type: "string" }, pt: { type: "string" } },
            },
          },
        },
      },
    },
  },
};

// ----------------------------------------------------------------------=====
// Chamada
// ----------------------------------------------------------------------=====

async function pedir(prompt: string, esquema: unknown, model: string, correcao?: string) {
  const texto = correcao
    ? `${prompt}\n\nA TENTATIVA ANTERIOR FOI REPROVADA POR ISTO:\n  ${correcao}\n` +
      `Corrija exatamente esse ponto e devolva tudo de novo.`
    : prompt;

  const response = await genaiBatch().client.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: texto }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: esquema as never,
      temperature: 0.85,
    },
  });

  const bruto = response.text;
  if (!bruto) throw new Error("resposta vazia do modelo");
  return JSON.parse(bruto) as { blocos: Record<string, unknown>[] };
}

/**
 * Teto de GASTO do projeto, que chega como 429 igual a um limite por minuto e
 * não é a mesma coisa: esperar não resolve, porque a janela é mensal. Sem esta
 * distinção o `--watch` dormiria para sempre achando que a cota vai renovar.
 */
function isSpendCap(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /spending cap|spend cap|billing/i.test(message);
}

function abortarPorTeto(): never {
  console.log(
    `
  [31m▲ O projeto estourou o teto de gasto MENSAL.[0m
` +
      `  Isso chega como 429, mas nao e limite por minuto: esperar nao resolve.

` +
      `  Duas saidas:
` +
      `    1. Rotear por Vertex: aponte VERTEX_CREDENTIALS para a credencial da
` +
      `       conta de servico. O Vertex e cobrado pelo GCP e nao passa por esse teto.
` +
      `    2. Levantar o teto em https://ai.studio/spend
`,
  );
  process.exit(1);
}

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b429\b|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(message);
}

// ----------------------------------------------------------------------=====
// Persistência
// ----------------------------------------------------------------------=====

function load(): BlocosDoCircuito[] {
  try {
    return JSON.parse(readFileSync(JSON_PATH, "utf8")) as BlocosDoCircuito[];
  } catch {
    return [];
  }
}

function save(todos: BlocosDoCircuito[]) {
  todos.sort((a, b) => a.n - b.n);
  writeFileSync(JSON_PATH, JSON.stringify(todos, null, 2) + "\n", "utf8");
}

// ----------------------------------------------------------------------=====
// Principal
// ----------------------------------------------------------------------=====

interface Opcoes {
  circuito: number | null;
  limite: number | null;
  force: boolean;
  watch: boolean;
  dry: boolean;
  model: string;
  esperaMin: number;
}

function parseArgs(argv: string[]): Opcoes {
  const get = (nome: string) => {
    const i = argv.indexOf(`--${nome}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    circuito: get("circuito") ? Number(get("circuito")) : null,
    limite: get("limite") ? Number(get("limite")) : null,
    force: argv.includes("--force"),
    watch: argv.includes("--watch"),
    dry: argv.includes("--dry"),
    model: get("model") ?? env("GEMINI_MODEL_TUTOR", "gemini-3.6-flash"),
    esperaMin: get("espera") ? Number(get("espera")) : 20,
  };
}

async function main() {
  const op = parseArgs(process.argv.slice(2));
  const todos = load();
  const prontos = new Set(todos.map((c) => c.n));

  let alvos = RAMPA.map((c) => c.n);
  if (op.circuito) alvos = alvos.filter((n) => n === op.circuito);
  if (!op.force) alvos = alvos.filter((n) => !prontos.has(n));
  if (op.limite) alvos = alvos.slice(0, op.limite);

  const meta = RAMPA.reduce((a, c) => a + c.blocosNovos, 0);
  console.log(`\n\x1b[1m▸ Blocos do curso\x1b[0m`);
  console.log(`  prontos ..... ${prontos.size} circuitos`);
  console.log(`  a escrever .. ${alvos.length} circuitos`);
  console.log(`  meta ........ ${meta} blocos base\n`);

  if (!alvos.length) {
    console.log("  Nada a fazer.\n");
    return;
  }

  if (op.dry) {
    for (const n of alvos.slice(0, 2)) {
      const cal = calibragemDe(n);
      const carga = cargaDe(n)!;
      console.log(
        `  c${n}: ${carga.blocosNovos} blocos x (${cal.formasMin} a ${cal.formasMax} formas + ${cal.recombinacoes} recombinações)\n`,
      );
      console.log(promptBase(n, []));
      console.log("\n" + "─".repeat(70) + "\n");
    }
    return;
  }

  /** Tudo já ensinado, para o modelo não repetir bloco entre circuitos. */
  const jaEnsinados = () => {
    const chaves = new Set<string>();
    const textos: string[] = [];
    for (const c of todos) {
      for (const b of c.blocos) {
        chaves.add(chunkKey(b.en));
        textos.push(b.en);
      }
    }
    return { chaves, textos };
  };

  const TENTATIVAS = 3;
  let escritos = 0;

  for (const n of alvos) {
    const { chaves, textos } = jaEnsinados();

    // ------------------------------------------------- fase 1: os blocos base
    let base: { en: string; pt: string; quando: string }[] | null = null;
    let correcao: string | undefined;

    for (let t = 1; t <= TENTATIVAS && !base; t++) {
      try {
        const r = await pedir(promptBase(n, textos), ESQUEMA_BASE, op.model, correcao);
        const candidatos = r.blocos as unknown as { en: string; pt: string; quando: string }[];
        validarBase(n, candidatos, chaves);
        base = candidatos;
      } catch (error) {
        if (isSpendCap(error)) abortarPorTeto();
        if (isQuotaError(error)) {
          if (!op.watch) {
            console.log(`\n  \x1b[33m▲ Cota bloqueada.\x1b[0m ${escritos} circuitos nesta rodada.`);
            console.log(`  Rode de novo quando renovar, ou use --watch para esperar sozinho.\n`);
            return;
          }
          console.log(`  \x1b[33m·\x1b[0m cota: esperando ${op.esperaMin} min...`);
          await sleep(op.esperaMin * 60_000);
          t--;
          continue;
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (t === TENTATIVAS) {
          console.log(`  \x1b[31m✗\x1b[0m c${n} base: ${msg.slice(0, 130)} — desisti`);
          break;
        }
        correcao = msg;
        console.log(`  \x1b[33m↻\x1b[0m c${n} base: ${msg.slice(0, 110)} (${t}/${TENTATIVAS})`);
        await sleep(2000);
      }
    }

    if (!base) continue;

    // -------------------------------------------------- fase 2: as famílias
    const comFamilia: Bloco[] = [];

    for (let i = 0; i < base.length; i += LOTE_FAMILIA) {
      const lote = base.slice(i, i + LOTE_FAMILIA);
      let feito = false;
      let corr: string | undefined;

      for (let t = 1; t <= TENTATIVAS && !feito; t++) {
        try {
          const r = await pedir(promptFamilia(n, lote), ESQUEMA_FAMILIA, op.model, corr);
          const vindos = r.blocos as unknown as {
            en: string;
            formas: Forma[];
            recombinacoes: { en: string; pt: string }[];
          }[];

          const montados: Bloco[] = lote.map((b) => {
            const achado = vindos.find((v) => chunkKey(v.en ?? "") === chunkKey(b.en));
            if (!achado) throw new Reprovado(`a família do bloco "${b.en}" não voltou`);
            return {
              en: b.en,
              pt: b.pt,
              quando: b.quando,
              formas: achado.formas ?? [],
              recombinacoes: achado.recombinacoes ?? [],
            };
          });

          validarFamilias(n, montados);
          comFamilia.push(...montados);
          feito = true;
        } catch (error) {
          if (isSpendCap(error)) abortarPorTeto();
        if (isQuotaError(error)) {
            if (!op.watch) {
              console.log(`\n  \x1b[33m▲ Cota bloqueada no meio do c${n}.\x1b[0m`);
              console.log(`  O circuito não foi gravado: rode de novo e ele recomeça inteiro.\n`);
              return;
            }
            console.log(`  \x1b[33m·\x1b[0m cota: esperando ${op.esperaMin} min...`);
            await sleep(op.esperaMin * 60_000);
            t--;
            continue;
          }
          const msg = error instanceof Error ? error.message : String(error);
          if (t === TENTATIVAS) {
            console.log(
              `  \x1b[31m✗\x1b[0m c${n} família ${Math.floor(i / LOTE_FAMILIA) + 1}: ${msg.slice(0, 120)}`,
            );
            break;
          }
          corr = msg;
          await sleep(2000);
        }
      }

      if (!feito) break;
      await sleep(700);
    }

    if (comFamilia.length === base.length) {
      try {
        validarMediaDoCircuito(n, comFamilia);
      } catch (error) {
        console.log(
          `  [33m![0m c${n}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (comFamilia.length !== base.length) {
      console.log(
        `  \x1b[31m✗\x1b[0m c${n}: só ${comFamilia.length}/${base.length} blocos ganharam família — não gravei`,
      );
      continue;
    }

    const idx = todos.findIndex((c) => c.n === n);
    const registro = { n, blocos: comFamilia };
    if (idx === -1) todos.push(registro);
    else todos[idx] = registro;
    save(todos);
    escritos++;

    const frases = comFamilia.reduce(
      (a, b) => a + 1 + b.formas.length + b.recombinacoes.length,
      0,
    );
    console.log(
      `  \x1b[32m✓\x1b[0m ${String(escritos).padStart(2)}/${alvos.length}  c${String(n).padStart(2)}  ` +
        `${comFamilia.length} blocos, ${frases} frases  ${progressaoDe(n)!.titulo}`,
    );

    await sleep(1200);
  }

  const totalBlocos = todos.reduce((a, c) => a + c.blocos.length, 0);
  const totalFrases = todos.reduce(
    (a, c) => a + c.blocos.reduce((x, b) => x + 1 + b.formas.length + b.recombinacoes.length, 0),
    0,
  );
  console.log(
    `\n  ${todos.length}/52 circuitos, ${totalBlocos}/${meta} blocos, ${totalFrases} frases.\n`,
  );
}

main().catch((error) => {
  console.error("\n✗ Erro:", error instanceof Error ? error.message : error);
  process.exit(1);
});
