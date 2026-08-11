/**
 * Passa o curso inteiro por um revisor e tira o que ninguém diz.
 *
 * ===========================================================================
 * POR QUE ISTO PRECISOU EXISTIR
 * ===========================================================================
 * O bloco "How interesting!" é uma exclamação. Pedir a família dele produziu
 * "Is it how interesting?" (pergunta) e "It's how interesting." (terceira
 * pessoa) — duas frases que nenhum falante de inglês diz, com tradução
 * convincente ao lado.
 *
 * Isso não foi acaso, foi consequência de uma decisão minha. Ao descobrir que
 * as formas vinham pela metade do volume desenhado, passei a exigir que o LOTE
 * fechasse a média. O modelo fechou a média — e fechou completando número nos
 * blocos que não aguentavam mais nenhuma forma honesta. Troquei um defeito
 * (volume magro) por outro (frase inventada), que é o pior dos dois: volume
 * magro é um curso menor, frase inventada é um aluno aprendendo a errar com
 * confiança e descobrindo na cara de espanto do interlocutor.
 *
 * Nenhuma regra mecânica pega isso. "It's how interesting." tem maiúscula,
 * ponto final, contração correta, não repete nada e cabe no limite de
 * palavras: passa em todas as checagens que existem. O que reprova essa frase
 * é saber inglês.
 *
 * ===========================================================================
 * O QUE ELE FAZ
 * ===========================================================================
 * Manda as frases em lotes, pede o veredito de cada uma, e:
 *
 *   - frase boa: fica como está;
 *   - frase ruim com conserto: troca pelo conserto, revalidado;
 *   - frase ruim sem conserto honesto: SAI.
 *
 * Sair é uma opção de primeira classe, e é a diferença entre este script e o
 * que criou o problema. Um bloco de cumprimento com uma forma só está certo;
 * foi exigir três dele que quebrou. Preferir 12.900 frases reais a 13.240 com
 * 300 falsas não é perder volume: é parar de contar as falsas.
 *
 * Uso:
 *   npm run revisar -- --amostra 200     mede a taxa sem escrever nada
 *   npm run revisar                      revisa e corrige o curso inteiro
 *   npm run revisar -- --circuito 17     só um circuito
 */

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { contrair, faltaContracao } from "@content/contracao";
import { progressaoDe } from "@content/metodo";
import type { Bloco } from "@content/movimentos";
import { chunkKey, chunksSpokenIn } from "@/lib/srs";

import { env, genaiBatch, isRede, sleep } from "./_shared";

const JSON_PATH = join(process.cwd(), "content", "metodo", "blocos.json");

/** Frases por chamada. Acima disso o revisor começa a julgar no atacado. */
const LOTE = 25;

interface BlocosDoCircuito {
  n: number;
  blocos: Bloco[];
}

/** Uma frase do curso, com o endereço de onde ela mora. */
interface Frase {
  circuito: number;
  bloco: string;
  onde: "forma" | "recombinacao" | "base";
  indice: number;
  en: string;
  pt: string;
  tipo?: string;
}

const ESQUEMA = {
  type: "object",
  required: ["vereditos"],
  properties: {
    vereditos: {
      type: "array",
      items: {
        type: "object",
        required: ["n", "natural"],
        properties: {
          n: { type: "integer" },
          natural: { type: "boolean" },
          motivo: { type: "string" },
          conserto: { type: "string" },
          consertoPt: { type: "string" },
        },
      },
    },
  },
};

function prompt(lote: Frase[]): string {
  return `Você é falante nativo de inglês americano e revisa o conteúdo de um
curso de conversação para brasileiros.

Para cada frase abaixo, responda uma pergunta só: UMA PESSOA DE VERDADE DIRIA
ISSO EM VOZ ALTA, numa conversa?

Não é pergunta de gramática. Frase gramaticalmente correta que ninguém usa
REPROVA — ela ensina o aluno a soar estranho com confiança, e ele só descobre
na cara de espanto do interlocutor.

Estes são erros reais deste curso, para calibrar o seu rigor:
  "It's how interesting."     <- veio de "How interesting!" virando terceira
                                 pessoa. Ninguém diz isso.
  "Is it how interesting?"    <- mesma origem, virando pergunta.
  "Hi, I'm not Alex."         <- ninguém se apresenta negando o próprio nome.
  "It's not nice to meet you."<- cumprimento não tem negativa.
  "Are you good, thanks?"     <- o "thanks" não sobrevive à inversão.

E estes PASSAM, para você não reprovar demais:
  "Yes, I am."                <- resposta curta não contrai. Está certo.
  "I don't like that show, I think it's sad."  <- conversa normal.
  "It's unfair that that fee wasn't disclosed."  <- "that that" é inglês.

Frase informal, gíria, contração e frase incompleta de conversa PASSAM. O curso
ensina inglês falado, não inglês de prova.

AS FRASES:
${lote
  .map(
    (f, i) =>
      `  ${i + 1}. "${f.en}"${f.tipo ? `   [pedida como: ${f.tipo}]` : ""}\n` +
      `       traducao dada: ${f.pt}\n` +
      `       vem do bloco: "${f.bloco}"`,
  )
  .join(String.fromCharCode(10))}

O QUE DEVOLVER, um item por frase, com "n" sendo o número dela acima:

  natural: true se uma pessoa diria; false se não.

  Quando for false, escolha UMA das duas saídas:

    a) "conserto" + "consertoPt": outra frase que serve para o MESMO propósito
       naquele bloco e que gente diz de verdade. Use quando o problema é a
       redação e existe uma frase honesta no lugar.

    b) nada além de "motivo": quando o bloco simplesmente NÃO aceita aquilo.
       Exclamação não vira pergunta, cumprimento não vira negativa, despedida
       não vira terceira pessoa. Nesses casos a frase tem que sair do curso, e
       inventar um substituto seria repetir o erro.

  Prefira (b) quando estiver em dúvida. Frase a menos é um curso menor; frase
  inventada é um aluno falando errado com confiança.`;
}

function load(): BlocosDoCircuito[] {
  return JSON.parse(readFileSync(JSON_PATH, "utf8")) as BlocosDoCircuito[];
}

function salvar(todos: BlocosDoCircuito[]) {
  const texto = JSON.stringify(todos, null, 2) + String.fromCharCode(10);
  const temp = `${JSON_PATH}.${process.pid}.tmp`;
  for (let t = 1; t <= 3; t++) {
    try {
      writeFileSync(temp, texto, "utf8");
      renameSync(temp, JSON_PATH);
      return;
    } catch {
      /* tenta de novo: no Windows o rename colide com quem estiver lendo */
    }
  }
  writeFileSync(JSON_PATH, texto, "utf8");
}

/** Todas as frases derivadas do curso, na ordem em que moram no arquivo. */
function todasAsFrases(
  todos: BlocosDoCircuito[],
  soCircuito: number | null,
  soBase = false,
): Frase[] {
  const saida: Frase[] = [];
  for (const c of todos) {
    if (soCircuito && c.n !== soCircuito) continue;
    for (const b of (c.blocos ?? []).entries()) {
      const [iBloco, bloco] = b;
      if (soBase) {
        saida.push({
          circuito: c.n,
          bloco: bloco.en,
          onde: "base",
          indice: iBloco,
          en: bloco.en,
          pt: bloco.pt,
        });
      }
    }
    if (soBase) continue;
    for (const b of c.blocos ?? []) {
      (b.formas ?? []).forEach((f, i) =>
        saida.push({
          circuito: c.n,
          bloco: b.en,
          onde: "forma",
          indice: i,
          en: f.en,
          pt: f.pt,
          tipo: f.tipo,
        }),
      );
      (b.recombinacoes ?? []).forEach((r, i) =>
        saida.push({
          circuito: c.n,
          bloco: b.en,
          onde: "recombinacao",
          indice: i,
          en: r.en,
          pt: r.pt,
        }),
      );
    }
  }
  return saida;
}

/**
 * Aplica os consertos nos blocos base, levando as recombinacoes junto.
 *
 * O bloco base nao e uma frase qualquer: ele e a ANCORA do dialogo (o aluno
 * tem que reencontra-lo la dentro, palavra por palavra) e e o miolo de cada
 * recombinacao (que e o bloco DENTRO de uma frase maior). Trocar o texto do
 * bloco sem mexer em mais nada quebraria os dois contratos de uma vez.
 *
 * A recombinacao tem conserto mecanico e exato: ela CONTEM o texto antigo,
 * entao trocar essa parte pelo texto novo preserva a frase e devolve a
 * contencao. "Do you intend to travel this weekend, or are you staying home?"
 * vira "Are you planning on traveling this weekend, or are you staying home?"
 * — mesma frase, miolo consertado.
 *
 * Quando o texto antigo nao aparece literalmente, a recombinacao SAI. Preferir
 * remover a remendar e a mesma regra do resto deste arquivo.
 *
 * O dialogo e outra historia e nao se conserta por substituicao: ele e prosa.
 * Aqui so se aponta quais circuitos foram mexidos, e a regeracao e um comando
 * separado, depois do verificador dizer quais perderam ancora.
 */
function aplicarNosBlocos(
  todos: BlocosDoCircuito[],
  reprovadas: { frase: Frase; motivo: string; conserto?: string; consertoPt?: string }[],
) {
  let trocados = 0;
  let ajustadas = 0;
  let removidas = 0;
  const mexidos = new Set<number>();

  for (const r of reprovadas) {
    const circuito = todos.find((c) => c.n === r.frase.circuito);
    const bloco = circuito?.blocos[r.frase.indice];
    if (!circuito || !bloco || bloco.en !== r.frase.en) continue;

    const novo = r.conserto ? contrair(r.conserto) : null;
    if (!novo || !r.consertoPt?.trim()) continue;
    if (faltaContracao(novo) || novo.includes("/")) continue;

    const chave = chunkKey(novo);
    if (circuito.blocos.some((b, i) => i !== r.frase.indice && chunkKey(b.en) === chave)) continue;

    const antigo = bloco.en;
    bloco.en = novo;
    bloco.pt = r.consertoPt.trim();
    trocados++;
    mexidos.add(circuito.n);

    bloco.recombinacoes = bloco.recombinacoes.flatMap((rec) => {
      if (!rec.en.includes(antigo)) {
        removidas++;
        return [];
      }
      ajustadas++;
      return [{ ...rec, en: rec.en.replace(antigo, novo) }];
    });

    // A forma que virou igual ao bloco novo deixa de ser "outra cara".
    bloco.formas = bloco.formas.filter((f) => chunkKey(f.en) !== chave);
  }

  salvar(todos);

  console.log(`
  ${trocados} blocos trocados.`);
  console.log(`  ${ajustadas} recombinacoes acompanharam, ${removidas} sairam.`);
  console.log(`  circuitos mexidos: ${[...mexidos].sort((a, b) => a - b).join(", ")}`);
  console.log(`
  Agora rode: npm run verify:content`);
  console.log(`  Os circuitos que perderem ancora precisam de gen:dialogos --force.
`);
}

async function main() {
  const argv = process.argv.slice(2);
  const get = (nome: string) => {
    const i = argv.indexOf(`--${nome}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const amostra = get("amostra") ? Number(get("amostra")) : null;
  const soCircuito = get("circuito") ? Number(get("circuito")) : null;
  const model = get("model") ?? env("GEMINI_MODEL_TUTOR", "gemini-3.1-flash-lite");

  const soBase = argv.includes("--blocos");
  const aplicar = argv.includes("--aplicar");
  const desde = get("novas");
  const todos = load();
  let frases = todasAsFrases(todos, soCircuito, soBase);

  // `--novas <snapshot>`: revisa so o que nao existia no snapshot.
  //
  // Depois da primeira varredura, reler as 11.851 frases ja aprovadas custa
  // meia hora para confirmar o que ja se sabe. O que precisa de revisao e o
  // que a reposicao de formas acrescentou desde entao — e e justamente ali que
  // mora o risco, porque foi pedindo volume que o modelo inventou da primeira
  // vez.
  if (desde) {
    const antes = JSON.parse(readFileSync(desde, "utf8")) as BlocosDoCircuito[];
    const conhecidas = new Set<string>();
    for (const c of antes) {
      for (const b of c.blocos ?? []) {
        conhecidas.add(chunkKey(b.en));
        for (const f of b.formas ?? []) conhecidas.add(chunkKey(f.en));
        for (const r of b.recombinacoes ?? []) conhecidas.add(chunkKey(r.en));
      }
    }
    const antesDeFiltrar = frases.length;
    frases = frases.filter((f) => !conhecidas.has(chunkKey(f.en)));
    console.log(`  (--novas: ${antesDeFiltrar - frases.length} ja revisadas ficaram de fora)`);
  }

  if (amostra) {
    // Amostra espalhada, e não as primeiras: os primeiros circuitos são os mais
    // curtos e os mais revisados, e mediriam uma taxa que não é a do curso.
    const passo = Math.max(1, Math.floor(frases.length / amostra));
    frases = frases.filter((_, i) => i % passo === 0).slice(0, amostra);
  }

  const { via } = genaiBatch();
  console.log(`\n\x1b[1m▸ Revisão das frases\x1b[0m`);
  console.log(`  a revisar ... ${frases.length}${amostra ? "  (amostra)" : ""}`);
  console.log(`  rota ........ ${via}\n`);

  const reprovadas: { frase: Frase; motivo: string; conserto?: string; consertoPt?: string }[] = [];
  let revisadas = 0;

  for (let i = 0; i < frases.length; i += LOTE) {
    const lote = frases.slice(i, i + LOTE);

    for (let t = 1; t <= 3; t++) {
      try {
        const r = await genaiBatch().client.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: prompt(lote) }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: ESQUEMA as never,
            temperature: 0.2,
          },
        });

        const bruto = r.text;
        if (!bruto) throw new Error("resposta vazia");
        const vindo = JSON.parse(bruto) as {
          vereditos: { n: number; natural: boolean; motivo?: string; conserto?: string; consertoPt?: string }[];
        };

        for (const v of vindo.vereditos ?? []) {
          const frase = lote[v.n - 1];
          if (!frase || v.natural) continue;
          reprovadas.push({
            frase,
            motivo: v.motivo ?? "",
            conserto: v.conserto,
            consertoPt: v.consertoPt,
          });
        }

        revisadas += lote.length;
        process.stdout.write(
          `\r  ${revisadas}/${frases.length}  reprovadas: ${reprovadas.length}   `,
        );
        break;
      } catch (error) {
        if (isRede(error)) {
          await sleep(10_000);
          t--;
          continue;
        }
        if (t === 3) {
          console.log(`\n  \x1b[33m!\x1b[0m lote ${Math.floor(i / LOTE) + 1} falhou: pulei`);
          break;
        }
        await sleep(2000);
      }
    }

    await sleep(300);
  }

  const taxa = revisadas ? (100 * reprovadas.length) / revisadas : 0;
  console.log(`\n\n  ${reprovadas.length} de ${revisadas} reprovadas (${taxa.toFixed(1)}%)\n`);

  for (const r of reprovadas.slice(0, 25)) {
    console.log(`  c${r.frase.circuito} \x1b[31m"${r.frase.en}"\x1b[0m`);
    console.log(`      do bloco "${r.frase.bloco}"${r.frase.tipo ? ` [${r.frase.tipo}]` : ""}`);
    if (r.motivo) console.log(`      ${r.motivo}`);
    console.log(r.conserto ? `      \x1b[32m→ "${r.conserto}"\x1b[0m` : `      \x1b[33m→ sai do curso\x1b[0m`);
  }
  if (reprovadas.length > 25) console.log(`  … e mais ${reprovadas.length - 25}`);

  if (amostra || (soBase && !aplicar)) {
    // `--blocos` sozinho só relata. Trocar o bloco base cascateia — ele é a
    // âncora do diálogo e o miolo da recombinação — então a troca precisa ser
    // uma decisão, e não efeito colateral de rodar um relatório.
    console.log(
      `\n  (${soBase ? "--blocos: relatório. Use --aplicar para escrever" : "--amostra: nada foi escrito"})\n`,
    );
    return;
  }

  if (soBase) {
    aplicarNosBlocos(todos, reprovadas);
    return;
  }

  // ------------------------------------------------------------ aplicar
  //
  // Aplicar de trás para frente dentro de cada bloco: remover pelo índice
  // invalida os índices seguintes, e a recombinação 3 vira a 2 no meio da
  // limpeza.
  let trocadas = 0;
  let removidas = 0;

  const porBloco = new Map<string, typeof reprovadas>();
  for (const r of reprovadas) {
    const chave = `${r.frase.circuito}|${r.frase.bloco}`;
    porBloco.set(chave, [...(porBloco.get(chave) ?? []), r]);
  }

  for (const [chave, lista] of porBloco) {
    const [nStr, ...resto] = chave.split("|");
    const n = Number(nStr);
    const enBloco = resto.join("|");
    const circuito = todos.find((c) => c.n === n);
    const bloco = circuito?.blocos.find((b) => b.en === enBloco);
    if (!bloco) continue;

    for (const r of [...lista].sort((a, b) => b.frase.indice - a.frase.indice)) {
      const lugar = r.frase.onde === "forma" ? bloco.formas : bloco.recombinacoes;
      const atual = lugar[r.frase.indice];
      if (!atual || atual.en !== r.frase.en) continue;

      const conserto = r.conserto ? contrair(r.conserto) : null;

      // O conserto precisa passar nas mesmas regras do original. Um substituto
      // que repete outra forma, perde a contração ou — no caso da recombinação
      // — não contém mais o bloco, é conserto que estraga.
      const serve =
        conserto &&
        r.consertoPt?.trim() &&
        !faltaContracao(conserto) &&
        chunkKey(conserto) !== chunkKey(bloco.en) &&
        !lugar.some((x, k) => k !== r.frase.indice && chunkKey(x.en) === chunkKey(conserto)) &&
        (r.frase.onde === "forma" || chunksSpokenIn(conserto, [{ en: bloco.en }]).length > 0);

      if (serve) {
        atual.en = conserto;
        atual.pt = r.consertoPt!.trim();
        trocadas++;
      } else {
        lugar.splice(r.frase.indice, 1);
        removidas++;
      }
    }
  }

  salvar(todos);

  const frasesAgora = todos.reduce(
    (a, c) =>
      a + (c.blocos ?? []).reduce((x, b) => x + 1 + b.formas.length + b.recombinacoes.length, 0),
    0,
  );
  console.log(`\n  ${trocadas} trocadas, ${removidas} removidas.`);
  console.log(`  O curso tem agora ${frasesAgora} frases.\n`);
}

main().catch((error) => {
  console.error("\n✗ Erro:", error instanceof Error ? error.message : error);
  process.exit(1);
});
