/**
 * Redige os dois diálogos de cada circuito: a cena e a segunda escuta.
 *
 * ===========================================================================
 * POR QUE ELES PRECISARAM SER REFEITOS
 * ===========================================================================
 * A progressão dos 52 circuitos mudou: 51 dos 52 títulos são outros. Os
 * diálogos que estavam em `content/circuits/canto-*.ts` continuam bons, mas
 * pertencem a circuitos que não existem mais — o circuito 2 virou "Não
 * entendi, e daí?" e o diálogo de lá ainda apresentava alguém num evento.
 *
 * Diálogo que não casa com a situação do dia é pior do que diálogo faltando:
 * o aluno ouve uma coisa, lê outra no briefing, e conclui que ele é que não
 * entendeu.
 *
 * ===========================================================================
 * DOIS DIÁLOGOS, DOIS PAPÉIS
 * ===========================================================================
 * IMERSÃO é o primeiro contato com a situação, e é o que abre o circuito. O
 * texto fica travado até o aluno ouvir — daí ele precisar funcionar de ouvido,
 * sem apoio visual: frases curtas, uma ideia por fala, e o assunto óbvio pelo
 * contexto.
 *
 * ESCUTA é a mesma situação com outras pessoas e outras palavras. Serve para
 * provar que o aluno pegou a SITUAÇÃO e não decorou aquele diálogo. Por isso
 * ela pode ser um pouco mais rápida e trazer o que a primeira não trouxe.
 *
 * Os dois usam os blocos do circuito, mas nenhum é uma parada de blocos: gente
 * conversando é gente conversando, com hesitação, interrupção e assunto que
 * deriva.
 *
 * Uso:
 *   npm run gen:dialogos                   escreve o que falta
 *   npm run gen:dialogos -- --circuito 3   só o circuito 3
 *   npm run gen:dialogos -- --force        refaz
 *   npm run gen:dialogos -- --watch        espera a cota e continua
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { contrair, faltaContracao } from "@content/contracao";
import { amostraDoCanto, ehConsolidacao } from "@content/material";
import type { Bloco } from "@content/movimentos";
import { cantoDe, cargaDe, progressaoDe, RAMPA, somDe } from "@content/metodo";
import { chunkKey } from "@/lib/srs";

import { env, genaiBatch, isRede, sleep } from "./_shared";

/** [quem fala, o que diz em inglês, tradução] */
export type Fala = [string, string, string];

export interface DialogosDoCircuito {
  n: number;
  /** O elenco deste circuito. Nome estável, porque é ele que escolhe a voz. */
  elenco: string[];
  imersao: Fala[];
  escuta: Fala[];
  /** Para onde a conversa do dia 14 pode derivar. Em português. */
  deriva: string[];
}

const JSON_PATH = join(process.cwd(), "content", "metodo", "dialogos.json");

/**
 * Falas por diálogo, por canto. Cresce com a rampa: um iniciante não sustenta
 * dezoito falas de ouvido, e um B2 não aprende nada com oito.
 */
const FALAS: Record<number, { min: number; max: number }> = {
  1: { min: 8, max: 12 },
  2: { min: 10, max: 14 },
  3: { min: 12, max: 18 },
  4: { min: 14, max: 20 },
};

/**
 * O elenco fixo do curso. Os mesmos nomes atravessam os 52 circuitos porque a
 * voz é escolhida pelo nome em `content/audio-manifest.ts` — trocar o elenco a
 * cada circuito trocaria a voz do personagem no meio do curso.
 */
const ELENCO = [
  "Ana", "Bruno", "Kate", "Mike", "Sarah", "Tom",
  "Lucas", "Emma", "Chris", "Julia", "Dave", "Nina",
];

class Reprovado extends Error {}

function exigir(condicao: boolean, motivo: string): asserts condicao {
  if (!condicao) throw new Reprovado(motivo);
}

function validar(n: number, d: DialogosDoCircuito, blocos: string[]) {
  const faixa = FALAS[cantoDe(n)];

  for (const [nome, falas] of [
    ["imersão", d.imersao],
    ["escuta", d.escuta],
  ] as const) {
    exigir(
      falas.length >= faixa.min && falas.length <= faixa.max,
      `${nome}: ${falas.length} falas, e o nível pede de ${faixa.min} a ${faixa.max}`,
    );

    for (const [quem, en, pt] of falas) {
      exigir(!!quem?.trim(), `${nome}: fala sem locutor`);
      exigir(!!en?.trim(), `${nome}: fala sem inglês`);
      exigir(!!pt?.trim(), `${nome}: "${en}" sem tradução`);

      exigir(
        ELENCO.includes(quem),
        `${nome}: "${quem}" não está no elenco do curso (${ELENCO.join(", ")})`,
      );

      // A barra é o separador do roteiro: se escapar uma, o player parte a
      // fala ao meio e a voz troca no meio da frase.
      exigir(!en.includes("/") && !quem.includes("/"), `${nome}: "${en}" tem barra`);

      // A esta altura `contrair` ja passou por aqui, entao sobrar forma cheia
      // significa forma que a tabela nao cobre - ai sim e caso de reprovar.
      const cheia = faltaContracao(en);
      exigir(!cheia, `${nome}: "${en}" usa "${cheia}" - o curso exige contracao`);
    }

    const vozes = new Set(falas.map(([quem]) => quem));
    exigir(vozes.size >= 2, `${nome}: só uma pessoa fala — isso é monólogo, não diálogo`);
    exigir(vozes.size <= 3, `${nome}: ${vozes.size} pessoas falando é multidão para um diálogo`);
  }

  // A razão de o diálogo existir: o aluno tem que reencontrar nele o que
  // treinou. Sem esta checagem o modelo escreve uma conversa boa sobre o
  // assunto certo, e o aluno não reconhece nada — que foi exatamente o defeito
  // do dia 8 na versão anterior do curso.
  const texto = [...d.imersao, ...d.escuta].map(([, en]) => en).join(" ").toLowerCase();
  const achados = blocos.filter((b) => {
    const nucleo = b.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
    return nucleo.length >= 6 && texto.replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").includes(nucleo);
  });
  // Um quarto dos blocos é a régua do circuito comum, onde os blocos são a
  // matéria nova. No circuito de consolidação eles são uma AMOSTRA de um canto
  // inteiro, e exigir um quarto de uma amostra de vinte e quatro seria exigir
  // que a conversa fosse uma lista. Ali o que importa é o piso: seis blocos
  // reencontrados provam que o canto ficou.
  const minimo = ehConsolidacao(n) ? Math.min(6, blocos.length) : Math.max(2, Math.round(blocos.length * 0.25));
  exigir(
    achados.length >= minimo,
    `só ${achados.length} dos ${blocos.length} blocos do circuito aparecem nos diálogos, e o mínimo é ${minimo} — ` +
      `o aluno precisa reencontrar o que treinou`,
  );

  exigir(d.deriva.length >= 3 && d.deriva.length <= 5, `deriva: ${d.deriva.length} temas, e o certo são 3 a 5`);
}

const ESQUEMA = {
  type: "object",
  required: ["elenco", "imersao", "escuta", "deriva"],
  properties: {
    elenco: { type: "array", items: { type: "string" } },
    imersao: {
      type: "array",
      items: {
        type: "object",
        required: ["quem", "en", "pt"],
        properties: { quem: { type: "string" }, en: { type: "string" }, pt: { type: "string" } },
      },
    },
    escuta: {
      type: "array",
      items: {
        type: "object",
        required: ["quem", "en", "pt"],
        properties: { quem: { type: "string" }, en: { type: "string" }, pt: { type: "string" } },
      },
    },
    deriva: { type: "array", items: { type: "string" } },
  },
};

function prompt(n: number, blocos: { en: string; pt: string }[]): string {
  const prog = progressaoDe(n)!;
  const carga = cargaDe(n)!;
  const som = somDe(n)!;
  const faixa = FALAS[cantoDe(n)];

  // O circuito de portão não ensina nada: ele cobra. O modelo precisa saber
  // disso, senão escreve mais uma aula onde o lugar pede uma prova.
  const portao = ehConsolidacao(n)
    ? `
ATENÇÃO — ESTE É UM CIRCUITO DE PORTÃO.
Ele fecha o canto ${cantoDe(n)} e não ensina NADA de novo. Não invente estrutura
nova, não traga vocabulário que o aluno não viu. A conversa aqui é a prova de
que o canto ficou: ela é feita do que já foi ensinado, e o mérito dela é
parecer conversa de verdade mesmo usando só isso.
Os blocos abaixo são uma amostra do canto inteiro — circuitos ${(cantoDe(n) - 1) * 13 + 1} a ${n - 1}.
`
    : "";

  return `Você escreve o conteúdo do curso de inglês "4 Cantos", para brasileiros.
Escreva os DOIS DIÁLOGOS do circuito ${n} — "${prog.titulo}" (${carga.nivel}).
${portao}
A SITUAÇÃO: ${prog.situacao}

A FUNÇÃO: ${prog.funcao}

A ARMADILHA do brasileiro aqui: ${prog.armadilha}

OS BLOCOS que o aluno está treinando neste circuito:
${blocos.map((b) => `  "${b.en}"  (${b.pt})`).join("\n")}

O SOM deste circuito: ${som.traco}
  Se der, ponha nas falas palavras onde esse traço apareça.

----------------------------------------------------------------------
OS DOIS DIÁLOGOS
----------------------------------------------------------------------

IMERSÃO — o primeiro contato com a situação. O texto fica TRAVADO até o aluno
ouvir três ou quatro vezes, então ele tem que funcionar de ouvido: frase curta,
uma ideia por fala, e o assunto ficando óbvio pelo contexto e não pela
explicação. De ${faixa.min} a ${faixa.max} falas.

ESCUTA — a MESMA situação, outras pessoas, outras palavras. Serve para provar
que o aluno pegou a situação e não decorou o primeiro diálogo. Pode ser um
pouco mais rápida e trazer o que a imersão não trouxe. De ${faixa.min} a ${faixa.max} falas.

REGRA QUE REPROVA: pelo menos um quarto dos blocos do circuito tem que aparecer
LITERALMENTE nas falas, com as mesmas palavras. Sem isso o aluno ouve uma
conversa boa e não reconhece nada do que treinou — que é o defeito exato que
esta versão do curso veio consertar.

E o contrário também reprova: os diálogos NÃO podem ser um desfile de blocos
emendados. É gente conversando: tem hesitação, tem interrupção, tem assunto que
deriva e volta, tem alguém que não termina a frase.

----------------------------------------------------------------------
ELENCO
----------------------------------------------------------------------
Use SOMENTE estes nomes: ${ELENCO.join(", ")}.
Duas pessoas por diálogo, três no máximo. Nomes diferentes nos dois diálogos,
porque é a mesma situação com outra gente.

O nome é o que escolhe a VOZ na hora de gravar, então uma pessoa que se
apresenta como "Kate" tem que estar rotulada como Kate — nome trocado vira voz
trocada no áudio.

----------------------------------------------------------------------
DERIVA
----------------------------------------------------------------------
De 3 a 5 temas, EM PORTUGUÊS, para onde a conversa livre do fim do circuito
pode ir. São assuntos, não frases.

----------------------------------------------------------------------
COMO SE ESCREVE NESTE CURSO
----------------------------------------------------------------------
  - Inglês americano FALADO. Contração sempre: "I'm", "don't", "it's", "gonna".
    A exceção é o fim da oração, onde não se contrai: "Yes, I am." está certo.
  - Sem barra "/" em lugar nenhum: é o separador de roteiro do player.
  - Tradução em português do Brasil, natural, do jeito que a pessoa diria.
  - Sem gíria datada. Sem frase de livro didático.`;
}

function isSpendCap(error: unknown): boolean {
  return /spending cap|spend cap|billing/i.test(
    error instanceof Error ? error.message : String(error),
  );
}

function isQuota(error: unknown): boolean {
  return /\b429\b|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(
    error instanceof Error ? error.message : String(error),
  );
}

function load(): DialogosDoCircuito[] {
  try {
    return JSON.parse(readFileSync(JSON_PATH, "utf8")) as DialogosDoCircuito[];
  } catch {
    return [];
  }
}

function save(todos: DialogosDoCircuito[]) {
  todos.sort((a, b) => a.n - b.n);
  writeFileSync(JSON_PATH, JSON.stringify(todos, null, 2) + "\n", "utf8");
}

async function main() {
  const argv = process.argv.slice(2);
  const get = (nome: string) => {
    const i = argv.indexOf(`--${nome}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const soCircuito = get("circuito") ? Number(get("circuito")) : null;
  const force = argv.includes("--force");
  const watch = argv.includes("--watch");
  const esperaMin = get("espera") ? Number(get("espera")) : 20;
  const model = get("model") ?? env("GEMINI_MODEL_TUTOR", "gemini-3.1-flash-lite");

  /**
   * Os blocos, relidos do disco a cada consulta.
   *
   * Ler uma vez no início parecia bastar, e não bastava: este gerador roda ao
   * lado do gen:blocos, e os circuitos que o outro escreveu DEPOIS deste
   * processo abrir chegavam aqui como lista vazia. Foi assim que dois
   * circuitos foram reprovados por "0 de 0 blocos aparecem no diálogo" — um
   * erro que descreve o leitor, não o conteúdo.
   */
  const lerBlocos = () => {
    const bruto = JSON.parse(
      readFileSync(join(process.cwd(), "content", "metodo", "blocos.json"), "utf8"),
    ) as { n: number; blocos: Bloco[] }[];
    return new Map(bruto.map((c) => [c.n, c.blocos ?? []]));
  };

  /**
   * O que este circuito devolve em conversa.
   *
   * No circuito comum, os blocos que ele ensina. No circuito de consolidação,
   * que não ensina nada novo, uma amostra do canto que ele fecha — porque a
   * conversa do portão é justamente a prova de que o canto ficou.
   */
  const blocosDe = (n: number) => {
    const mapa = lerBlocos();
    return ehConsolidacao(n) ? amostraDoCanto(n, mapa) : (mapa.get(n) ?? []);
  };

  const blocosPorN = lerBlocos();

  const todos = load();
  const prontos = new Set(todos.map((c) => c.n));

  let alvos = RAMPA.map((c) => c.n).filter(
    (n) => ehConsolidacao(n) || (blocosPorN.get(n)?.length ?? 0) > 0,
  );
  if (soCircuito) alvos = alvos.filter((n) => n === soCircuito);
  if (!force) alvos = alvos.filter((n) => !prontos.has(n));

  const { via } = genaiBatch();
  console.log(`\n\x1b[1m▸ Diálogos dos circuitos\x1b[0m`);
  console.log(`  prontos ..... ${prontos.size}`);
  console.log(`  com blocos .. ${blocosPorN.size} de 52`);
  console.log(`  a escrever .. ${alvos.length}`);
  console.log(`  rota ........ ${via}\n`);

  if (!alvos.length) {
    console.log("  Nada a fazer. Se faltam circuitos, rode gen:blocos antes.\n");
    return;
  }

  const TENTATIVAS = 3;
  let escritos = 0;

  for (const n of alvos) {
    const blocos = blocosDe(n);
    if (!blocos.length) {
      console.log(`  [31m✗[0m c${n}: sem blocos para ancorar o dialogo`);
      continue;
    }
    let correcao: string | undefined;
    let feito = false;

    for (let t = 1; t <= TENTATIVAS && !feito; t++) {
      try {
        const texto = correcao
          ? `${prompt(n, blocos)}\n\nA TENTATIVA ANTERIOR FOI REPROVADA POR ISTO:\n  ${correcao}\nCorrija exatamente esse ponto.`
          : prompt(n, blocos);

        const r = await genaiBatch().client.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: texto }] }],
          config: { responseMimeType: "application/json", responseSchema: ESQUEMA as never, temperature: 0.9 },
        });

        const bruto = r.text;
        if (!bruto) throw new Error("resposta vazia do modelo");
        const vindo = JSON.parse(bruto) as {
          elenco: string[];
          imersao: { quem: string; en: string; pt: string }[];
          escuta: { quem: string; en: string; pt: string }[];
          deriva: string[];
        };

        // Contrair antes de validar, não depois de reprovar. Uma única "He is"
        // no meio de vinte e oito falas jogava fora o diálogo inteiro e gastava
        // outra chamada do modelo — e o conserto é ortográfico, não editorial.
        const fala = (f: { quem: string; en: string; pt: string }): Fala => [
          f.quem,
          contrair(f.en ?? ""),
          f.pt,
        ];

        const montado: DialogosDoCircuito = {
          n,
          elenco: vindo.elenco ?? [],
          imersao: (vindo.imersao ?? []).map(fala),
          escuta: (vindo.escuta ?? []).map(fala),
          deriva: vindo.deriva ?? [],
        };

        validar(n, montado, blocos.map((b) => b.en));

        const idx = todos.findIndex((c) => c.n === n);
        if (idx === -1) todos.push(montado);
        else todos[idx] = montado;
        save(todos);
        escritos++;
        feito = true;

        console.log(
          `  \x1b[32m✓\x1b[0m ${String(escritos).padStart(2)}/${alvos.length}  c${String(n).padStart(2)}  ` +
            `${montado.imersao.length}+${montado.escuta.length} falas  ${progressaoDe(n)!.titulo}`,
        );
      } catch (error) {
        if (isSpendCap(error)) {
          console.log(`\n  \x1b[31m▲ Teto de gasto mensal do projeto.\x1b[0m Esperar não resolve.`);
          console.log(`  Use o Vertex (VERTEX_CREDENTIALS) ou levante o teto em ai.studio/spend\n`);
          process.exit(1);
        }
        if (isRede(error)) {
          console.log(`  [33m·[0m rede instavel: repetindo em 10s`);
          await sleep(10_000);
          t--;
          continue;
        }
        if (isQuota(error)) {
          if (!watch) {
            console.log(`\n  \x1b[33m▲ Cota bloqueada.\x1b[0m ${escritos} circuitos nesta rodada.\n`);
            return;
          }
          console.log(`  \x1b[33m·\x1b[0m cota: esperando ${esperaMin} min...`);
          await sleep(esperaMin * 60_000);
          t--;
          continue;
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (t === TENTATIVAS) {
          console.log(`  \x1b[31m✗\x1b[0m c${n}: ${msg.slice(0, 130)} — desisti`);
          break;
        }
        correcao = msg;
        console.log(`  \x1b[33m↻\x1b[0m c${n}: ${msg.slice(0, 100)} (${t}/${TENTATIVAS})`);
        await sleep(1500);
      }
    }

    await sleep(900);
  }

  const falas = todos.reduce((a, c) => a + c.imersao.length + c.escuta.length, 0);
  console.log(`\n  ${todos.length} circuitos com diálogo, ${falas} falas no total.\n`);
}

main().catch((error) => {
  console.error("\n✗ Erro:", error instanceof Error ? error.message : error);
  process.exit(1);
});
