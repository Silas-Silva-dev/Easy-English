/**
 * Completa as FORMAS que faltaram, sem refazer nada do que já está bom.
 *
 * ===========================================================================
 * O BURACO, E COMO ELE SE ABRIU
 * ===========================================================================
 * Os 46 circuitos escritos fecharam com 10.042 frases onde a rampa desenhou
 * 13.142 — 24% a menos. O déficit não estava espalhado: as recombinações
 * bateram o alvo EXATAMENTE, e as formas ficaram na metade.
 *
 * A causa está nas duas checagens. A recombinação tem igualdade
 * (`length === cal.recombinacoes`) e saiu exata. A forma tem faixa
 * (`>= formasMin`) mais um aviso sobre a média — e o aviso era capturado e
 * impresso, nunca reprovava. Faixa sem piso efetivo é lida como permissão, e
 * o modelo entregou o mínimo em 46 de 46 circuitos.
 *
 * A faixa existe por um bom motivo, e não vai embora: a primeira versão exigia
 * número exato e produziu "It's not nice to meet you" e "Hi, I'm not Alex" —
 * bloco de cumprimento não tem negativa, e forçar uma ensina o aluno a falar
 * errado com confiança. O erro não foi permitir que um bloco entregue pouco.
 * Foi não exigir que o LOTE compense: bloco rico dá seis formas, bloco pobre
 * dá uma, e a média fecha.
 *
 * ===========================================================================
 * POR QUE UMA PASSADA SEPARADA
 * ===========================================================================
 * Regerar os 46 circuitos jogaria fora 10.042 frases boas para reescrever as
 * mesmas com outro sorteio. Esta passada é aditiva: lê o que existe, calcula
 * o que falta, e pede SÓ a diferença — com as formas atuais no prompt, para o
 * modelo não repetir o que já está lá.
 *
 * Uso:
 *   npm run gen:formas                    completa o curso inteiro
 *   npm run gen:formas -- --circuito 7    só o circuito 7
 *   npm run gen:formas -- --watch         espera a cota renovar e continua
 *   npm run gen:formas -- --dry           mostra o déficit sem chamar a API
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { calibragemDe } from "@content/calibragem";
import { contrair, faltaContracao } from "@content/contracao";
import { cargaDe, progressaoDe } from "@content/metodo";
import type { Bloco, Forma } from "@content/movimentos";
import { chunkKey } from "@/lib/srs";

import { env, genaiBatch, sleep } from "./_shared";

interface BlocosDoCircuito {
  n: number;
  blocos: Bloco[];
}

const JSON_PATH = join(process.cwd(), "content", "metodo", "blocos.json");

/** Quantos blocos por chamada. O mesmo teto da fase 2, pelo mesmo motivo. */
const LOTE = 6;

class Reprovado extends Error {}

function exigir(condicao: boolean, motivo: string): asserts condicao {
  if (!condicao) throw new Reprovado(motivo);
}

// ----------------------------------------------------------------------=====
// O déficit
// ----------------------------------------------------------------------=====

/** Quantas formas o circuito deveria ter, pela média do nível. */
function alvoDe(n: number, blocos: Bloco[]): number {
  return Math.round(blocos.length * calibragemDe(n).formasMedia);
}

function temDe(blocos: Bloco[]): number {
  return blocos.reduce((a, b) => a + (b.formas?.length ?? 0), 0);
}

// ----------------------------------------------------------------------=====
// A encomenda
// ----------------------------------------------------------------------=====

const ESQUEMA = {
  type: "object",
  required: ["blocos"],
  properties: {
    blocos: {
      type: "array",
      items: {
        type: "object",
        required: ["en", "novasFormas"],
        properties: {
          en: { type: "string" },
          novasFormas: {
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
        },
      },
    },
  },
};

function prompt(n: number, lote: Bloco[], faltam: number): string {
  const cal = calibragemDe(n);
  const prog = progressaoDe(n)!;
  const carga = cargaDe(n)!;

  const lista = lote
    .map((b, i) => {
      const atuais = (b.formas ?? [])
        .map((f) => `       ja tem: "${f.en}"  (${f.tipo})`)
        .join(String.fromCharCode(10));
      return `  ${i + 1}. "${b.en}"  (${b.pt})\n${atuais || "       ainda nao tem forma nenhuma"}`;
    })
    .join(String.fromCharCode(10));

  return `Voce escreve o conteudo do curso de ingles "4 Cantos", para brasileiros.
Circuito ${n} — "${prog.titulo}" (${carga.nivel}).

Estes blocos ja existem e ja tem parte da familia escrita. Sua tarefa e
ACRESCENTAR as formas que faltam. Nao reescreva o que ja esta la, nao repita
nenhuma das formas listadas, e nao mexa no bloco base.

Familia e o mesmo bloco em outras caras — negativa, pergunta, terceira pessoa,
passado, futuro, resposta curta. E o que impede o aluno de decorar uma frase
congelada: ele passa a ter o MOLDE, e nao a foto.

OS BLOCOS E O QUE CADA UM JA TEM:
${lista}

----------------------------------------------------------------------
QUANTAS
----------------------------------------------------------------------
Devolva ${faltam} formas NOVAS no total, somando os ${lote.length} blocos acima.

Como distribuir e SEU julgamento, e e a parte que importa. Nao divida por
igual: bloco de cumprimento ("Nice to meet you") aceita uma forma ou nenhuma,
e verbo de acao ("I'd like to...") aceita seis sem forcar. Carregue nos blocos
que aguentam e deixe em paz os que nao aguentam. Um bloco pode receber zero.

Nenhum bloco pode passar de ${cal.formasMax} formas no total (contando as que ja tem).
Tipos disponiveis neste nivel: ${cal.tipos.join(", ")}.

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

Se um bloco nao aguenta mais nenhuma forma honesta, NAO INVENTE: ponha as
formas em outro bloco do lote. O total e que precisa fechar, nao a divisao.

INGLES AMERICANO FALADO, com contracao: "I'm", "don't", "it's", "isn't".
A excecao e o fim da oracao, onde nao se contrai: "Yes, I am." fica assim.

O "pt" e a traducao natural, do jeito que um brasileiro diria — nao e
traducao palavra por palavra.

Devolva um item por bloco, na ordem, com o "en" do bloco base EXATAMENTE como
esta escrito acima, e a lista "novasFormas" (que pode vir vazia).`;
}

// ----------------------------------------------------------------------=====
// Validação
// ----------------------------------------------------------------------=====

/**
 * Aprova as formas novas de um lote.
 *
 * A checagem que faltava no gerador original está aqui: o TOTAL do lote. Cada
 * bloco continua livre para entregar o que couber nele, e é o lote que precisa
 * fechar a conta.
 */
function validar(
  n: number,
  lote: Bloco[],
  novas: Map<string, Forma[]>,
  faltam: number,
) {
  const cal = calibragemDe(n);
  let total = 0;

  for (const b of lote) {
    const adicionais = novas.get(b.en) ?? [];
    total += adicionais.length;

    exigir(
      (b.formas?.length ?? 0) + adicionais.length <= cal.formasMax,
      `"${b.en}": ficaria com ${(b.formas?.length ?? 0) + adicionais.length} formas e o teto do nivel e ${cal.formasMax}`,
    );

    // Nada pode colidir com o bloco base, com forma que ja existia, nem com
    // outra forma nova do mesmo bloco.
    const vistas = new Set<string>([chunkKey(b.en), ...(b.formas ?? []).map((f) => chunkKey(f.en))]);

    for (const f of adicionais) {
      exigir(!!f.en?.trim() && !!f.pt?.trim(), `"${b.en}": forma nova sem ingles ou sem traducao`);
      exigir(!!f.tipo?.trim(), `"${f.en}": forma nova sem tipo`);

      const cheia = faltaContracao(f.en);
      exigir(!cheia, `"${f.en}" usa "${cheia}" - o curso exige contracao`);

      exigir(!f.en.includes("/"), `"${f.en}" tem barra, que e o separador do roteiro`);

      const chave = chunkKey(f.en);
      exigir(
        !vistas.has(chave),
        `"${f.en}" repete o bloco base ou uma forma que ja existia em "${b.en}"`,
      );
      vistas.add(chave);
    }
  }

  // Aceita um a menos: se o lote inteiro for de blocos duros, exigir o numero
  // exato empurraria o modelo de volta para a invencao que este curso proibe.
  exigir(
    total >= faltam - 1,
    `vieram ${total} formas novas e o lote precisa de ${faltam} — distribua nos blocos que aguentam`,
  );
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

/**
 * Grava as formas novas de um circuito, relendo o arquivo antes de escrever.
 *
 * O mesmo cuidado do gerador de blocos, pelo mesmo motivo: duas execuções ao
 * mesmo tempo carregam cada uma a sua lista e, ao salvar, apagam o que a outra
 * escreveu. Já aconteceu aqui uma vez, e a contagem caiu de 36 para 32 sem
 * deixar rastro.
 */
function salvar(n: number, blocos: Bloco[]) {
  const noDisco = load();
  const idx = noDisco.findIndex((c) => c.n === n);
  if (idx === -1) noDisco.push({ n, blocos });
  else noDisco[idx] = { n, blocos };
  noDisco.sort((a, b) => a.n - b.n);
  writeFileSync(JSON_PATH, JSON.stringify(noDisco, null, 2) + String.fromCharCode(10), "utf8");
}

function isSpendCap(error: unknown): boolean {
  const m = error instanceof Error ? error.message : String(error);
  return /billing|spend|budget|exceeded your current quota.*plan/i.test(m);
}

function isQuota(error: unknown): boolean {
  const m = error instanceof Error ? error.message : String(error);
  return /\b429\b|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(m);
}

// ----------------------------------------------------------------------=====
// Principal
// ----------------------------------------------------------------------=====

async function main() {
  const argv = process.argv.slice(2);
  const get = (nome: string) => {
    const i = argv.indexOf(`--${nome}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const soCircuito = get("circuito") ? Number(get("circuito")) : null;
  const watch = argv.includes("--watch");
  const dry = argv.includes("--dry");
  const esperaMin = get("espera") ? Number(get("espera")) : 20;
  const model = get("model") ?? env("GEMINI_MODEL_TUTOR", "gemini-3.1-flash-lite");

  const todos = load().filter((c) => c.blocos?.length);
  const alvos = todos
    .filter((c) => !soCircuito || c.n === soCircuito)
    .map((c) => ({ ...c, faltam: alvoDe(c.n, c.blocos) - temDe(c.blocos) }))
    .filter((c) => c.faltam > 0);

  const deficit = alvos.reduce((a, c) => a + c.faltam, 0);

  console.log(`\n\x1b[1m▸ Completando as formas\x1b[0m`);
  console.log(`  circuitos escritos ....... ${todos.length}`);
  console.log(`  abaixo da media .......... ${alvos.length}`);
  console.log(`  formas faltando .......... ${deficit}\n`);

  if (dry) {
    for (const c of alvos) {
      const media = temDe(c.blocos) / c.blocos.length;
      console.log(
        `  c${String(c.n).padStart(2)}  ${String(c.blocos.length).padStart(2)} blocos  ` +
          `media ${media.toFixed(1)} de ${calibragemDe(c.n).formasMedia}  faltam ${c.faltam}`,
      );
    }
    console.log("");
    return;
  }

  if (!alvos.length) {
    console.log("  Nada a completar: todo circuito bate a media do nivel.\n");
    return;
  }

  const { via } = genaiBatch();
  console.log(`  rota ..................... ${via}\n`);

  const TENTATIVAS = 3;
  let ganhas = 0;

  for (const circuito of alvos) {
    const blocos = circuito.blocos.map((b) => ({ ...b, formas: [...(b.formas ?? [])] }));
    const cal = calibragemDe(circuito.n);
    let ganhasNoCircuito = 0;

    for (let i = 0; i < blocos.length; i += LOTE) {
      const lote = blocos.slice(i, i + LOTE);

      // Quanto este lote deve, pela media do nivel. Um lote que ja esta acima
      // da media nao precisa de nada, e pedir zero e so gastar chamada.
      const faltamNoLote = Math.round(lote.length * cal.formasMedia) - temDe(lote);
      if (faltamNoLote <= 0) continue;

      let corr: string | undefined;

      for (let t = 1; t <= TENTATIVAS; t++) {
        try {
          const texto = corr
            ? `${prompt(circuito.n, lote, faltamNoLote)}\n\nA TENTATIVA ANTERIOR FOI REPROVADA POR ISTO:\n  ${corr}\nCorrija exatamente esse ponto.`
            : prompt(circuito.n, lote, faltamNoLote);

          const r = await genaiBatch().client.models.generateContent({
            model,
            contents: [{ role: "user", parts: [{ text: texto }] }],
            config: {
              responseMimeType: "application/json",
              responseSchema: ESQUEMA as never,
              temperature: 0.9,
            },
          });

          const bruto = r.text;
          if (!bruto) throw new Error("resposta vazia do modelo");
          const vindo = JSON.parse(bruto) as {
            blocos: { en: string; novasFormas: Forma[] }[];
          };

          // Casar pela chave, e nao pelo texto cru: o modelo devolve o bloco
          // com pontuacao trocada com alguma frequencia, e recusar por causa
          // de um ponto final custaria a chamada inteira.
          const novas = new Map<string, Forma[]>();
          for (const b of lote) {
            const achado = (vindo.blocos ?? []).find(
              (v) => chunkKey(v.en ?? "") === chunkKey(b.en),
            );
            novas.set(
              b.en,
              (achado?.novasFormas ?? []).map((f) => ({ ...f, en: contrair(f.en ?? "") })),
            );
          }

          validar(circuito.n, lote, novas, faltamNoLote);

          for (const b of lote) b.formas.push(...(novas.get(b.en) ?? []));
          const somadas = [...novas.values()].reduce((a, v) => a + v.length, 0);
          ganhasNoCircuito += somadas;
          ganhas += somadas;
          break;
        } catch (error) {
          if (isSpendCap(error)) {
            console.log(`\n  \x1b[31m▲ Teto de gasto mensal do projeto.\x1b[0m Esperar nao resolve.`);
            console.log(`  Use o Vertex (VERTEX_CREDENTIALS) ou levante o teto em ai.studio/spend\n`);
            salvar(circuito.n, blocos);
            process.exit(1);
          }
          if (isQuota(error)) {
            if (!watch) {
              console.log(`\n  \x1b[33m▲ Cota bloqueada.\x1b[0m ${ganhas} formas nesta rodada.`);
              salvar(circuito.n, blocos);
              return;
            }
            console.log(`  \x1b[33m·\x1b[0m cota: esperando ${esperaMin} min...`);
            await sleep(esperaMin * 60_000);
            t--;
            continue;
          }
          const msg = error instanceof Error ? error.message : String(error);
          if (t === TENTATIVAS) {
            console.log(
              `  \x1b[33m!\x1b[0m c${circuito.n} lote ${Math.floor(i / LOTE) + 1}: ${msg.slice(0, 100)}`,
            );
            break;
          }
          corr = msg;
          await sleep(1500);
        }
      }

      await sleep(600);
    }

    // Salvar por circuito, e nao no fim: se a cota morrer no circuito 40, os
    // 39 anteriores ja estao no disco.
    if (ganhasNoCircuito) {
      salvar(circuito.n, blocos);
      const media = temDe(blocos) / blocos.length;
      console.log(
        `  \x1b[32m✓\x1b[0m c${String(circuito.n).padStart(2)}  +${String(ganhasNoCircuito).padStart(3)} formas  ` +
          `media ${media.toFixed(1)} de ${cal.formasMedia}  ${progressaoDe(circuito.n)!.titulo}`,
      );
    }
  }

  const depois = load().filter((c) => c.blocos?.length);
  const frases = depois.reduce(
    (a, c) => a + c.blocos.reduce((x, b) => x + 1 + b.formas.length + b.recombinacoes.length, 0),
    0,
  );
  console.log(`\n  +${ganhas} formas. O curso tem agora ${frases} frases.\n`);
}

main().catch((error) => {
  console.error("\n✗ Erro:", error instanceof Error ? error.message : error);
  process.exit(1);
});
