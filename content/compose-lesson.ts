/**
 * Montagem local das lições — sem API, sem geração em tempo de execução.
 *
 * ===========================================================================
 * POR QUE ISSO EXISTE
 * ===========================================================================
 * Antes as 728 lições eram redigidas por uma chamada ao Gemini. Isso trazia
 * três problemas que nenhum ajuste de prompt resolve:
 *
 *   - O conteúdo mudava a cada execução. Duas pessoas rodando o mesmo comando
 *     recebiam cursos diferentes, e não havia como revisar o que ia ao ar.
 *   - Dependia de cota, de rede e de um modelo continuar existindo.
 *   - Ninguém tinha lido o curso inteiro antes de o aluno ler.
 *
 * Agora o material é escrito à mão em `content/circuits/` e este arquivo o
 * expande nos 14 dias de forma DETERMINÍSTICA: mesma entrada, mesma saída,
 * sempre. O curso inteiro está no repositório e pode ser lido, revisado e
 * versionado como qualquer outro código.
 *
 * ===========================================================================
 * O QUE CADA DIA RECEBE
 * ===========================================================================
 * O ritmo de 14 dias (DAY_RHYTHM) é fixo. Cada papel de dia consome uma parte
 * diferente do material do circuito:
 *
 *   1  Imersão            diálogo de imersão (atrás do portão de escuta)
 *   2  Blocos na boca     os chunks, um a um, com o foco de som
 *   3  Troca de peças     o molde + as peças + a nota "por que funciona assim"
 *   4  Escuta ativa       o segundo diálogo, em velocidade real
 *   5  Sua vez            produção livre gravada
 *   6  Revisão espaçada   blocos vencidos + circuitos de 1, 2 e 4 atrás
 *   7  Missão real        simulação + tarefa fora do aplicativo
 *   8  Input autêntico    material do mundo real, calibrado por nível
 *   9  Shadowing          as falas do diálogo de imersão, para repetir por cima
 *   10 Expansão           frases longas cruzando este circuito com anteriores
 *   11 Conversa ao vivo   roteiro para a sala de voz
 *   12 Escuta acelerada   o segundo diálogo a 1,25x e 1,5x
 *   13 Revisão intercalada blocos de circuitos misturados
 *   14 Sem roteiro        os assuntos para a conversa derivar
 */

import type {
  Chunk,
  LessonBlock,
  LessonContent,
  LessonExtensions,
  QuizQuestion,
} from "@/lib/types/database";

import type { AuthenticInput, CircuitSpec, DayRole } from "./curriculum";

// ===========================================================================
// Formato compacto do material redigido à mão
//
// Tuplas em vez de objetos: 52 circuitos com 8 falas de diálogo cada viram um
// arquivo bem menor e bem mais fácil de revisar lado a lado.
// ===========================================================================

/** [quem fala, o que diz em inglês, tradução] */
export type Line = [speaker: string, en: string, pt: string];

/** [inglês, português] */
export type Pair = [en: string, pt: string];

/** [pergunta, alternativas, índice da correta, explicação] */
export type Q = [question: string, options: string[], answer: number, explanation: string];

/** [o som ou traço de pronúncia, como treinar] */
export type Sound = [focus: string, tip: string];

export interface CircuitContent {
  /** 1..52 — casa com CircuitSpec.number. */
  n: number;
  /** Diálogo do dia 1. É o primeiro contato do aluno com a situação. */
  immersion: Line[];
  /** Diálogo do dia 4: mesma situação, outra cena, outras vozes. */
  listening: Line[];
  /** A nota curta do dia 3. Nunca titula a lição, nunca vem antes do uso. */
  why: { title: string; body: string };
  /** As peças que entram no molde do circuito. */
  swaps: string[];
  /** Frases longas do dia 10 — o molde cruzado com o que já passou. */
  expansion: Pair[];
  /** Para onde a conversa do dia 14 pode derivar. */
  drift: string[];
  /** Os sons que este circuito trabalha. */
  sounds: Sound[];
  /** 4 perguntas: as duas primeiras sobre o dia 1, as duas últimas sobre o dia 4. */
  quiz: [Q, Q, Q, Q];
}

export interface ComposedLesson {
  content: LessonContent;
  chunks: Chunk[];
  quiz: QuizQuestion[];
  speakingPrompt: string;
  immersionScript: string | null;
  listeningScript: string | null;
  grammarFocus: string | null;
  grammarExplanation: string | null;
  extensions: LessonExtensions;
}

// ===========================================================================
// Utilitários determinísticos
//
// Nada aqui usa Math.random: o mesmo circuito produz sempre a mesma lição, e
// é isso que permite revisar o curso antes de ele chegar ao aluno.
// ===========================================================================

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Passo coprimo com `len`, para percorrer a lista inteira sem repetir índice.
 *
 * O passo PRECISA ser coprimo: se ele dividir `len`, o percurso fecha num ciclo
 * curto e nunca visita o resto da lista — e um laço que espera visitar tudo
 * trava. Por isso procuramos, e caímos em 1 se nada servir.
 */
function stride(len: number, seed: number): number {
  if (len <= 1) return 1;
  for (let i = 0; i < len; i++) {
    const candidate = ((seed + i) % (len - 1)) + 1;
    if (gcd(candidate, len) === 1) return candidate;
  }
  return 1;
}

function pick<T>(items: T[], seed: number, count: number): T[] {
  if (items.length <= count) return [...items];

  const step = stride(items.length, seed);
  const out: T[] = [];
  let i = ((seed % items.length) + items.length) % items.length;

  // Com passo coprimo, `items.length` iterações cobrem a lista inteira.
  for (let n = 0; n < items.length && out.length < count; n++) {
    out.push(items[i]);
    i = (i + step) % items.length;
  }
  return out;
}

/**
 * Aplica a peça ao molde. Os circuitos de fechamento de canto (13, 26, 39, 51)
 * não têm lacuna no molde — lá as "peças" já são frases inteiras.
 */
function applySwap(pattern: string, piece: string): string {
  return pattern.includes("___") ? pattern.replace("___", piece) : piece;
}

function scriptOf(lines: Line[]): string {
  // O player separa as falas por " / ", então nenhuma fala pode conter barra.
  return lines.map(([who, en]) => `${who}: ${en.replace(/\s*\/\s*/g, " ou ")}`).join(" / ");
}

function dialogueBlock(title: string, lines: Line[]): LessonBlock {
  return {
    type: "dialogue",
    title,
    lines: lines.map(([speaker, en, pt]) => ({ speaker, en, pt })),
  };
}

// ---------------------------------------------------------------------------
// Quiz gerado a partir dos blocos
//
// Não é preenchimento: recuperação ativa PT -> EN é exatamente o exercício que
// transfere o bloco para a memória de longo prazo. O que varia entre os dias é
// a direção da pergunta, para o aluno não decorar a posição da resposta.
// ---------------------------------------------------------------------------
type RecallMode = "pt-en" | "en-pt" | "when";

function recallQuiz(
  chunks: Chunk[],
  seed: number,
  mode: RecallMode,
  count: number,
  idPrefix: string,
): QuizQuestion[] {
  const usable = chunks.filter((c) => c.en.trim() && c.pt.trim());
  if (usable.length < 4) return [];

  /** O texto que vai virar alternativa, conforme a direção da pergunta. */
  const display = (c: Chunk) =>
    mode === "en-pt" ? c.pt : mode === "when" ? (c.when ?? c.pt) : c.en;

  const chosen = pick(usable, seed, Math.min(count, usable.length));

  return chosen
    .map((chunk, i): QuizQuestion | null => {
      const correct = display(chunk);

      /**
       * Distratores precisam ser distintos DO TEXTO EXIBIDO, não do bloco.
       * Circuitos como o 44 (formal vs informal) têm blocos diferentes com a
       * mesma tradução — se filtrássemos só por `en`, a alternativa certa
       * apareceria duas vezes e a questão ficaria sem resposta única.
       */
      const seen = new Set([correct]);
      const candidates: Chunk[] = [];
      for (const other of usable) {
        const text = display(other);
        if (seen.has(text)) continue;
        seen.add(text);
        candidates.push(other);
      }

      // Sem três alternativas distintas não há questão honesta a fazer.
      if (candidates.length < 3) return null;

      const distractors = pick(candidates, seed + i * 3, 3);
      const answerIndex = (seed + i) % 4;
      const options: string[] = [];
      let d = 0;
      for (let slot = 0; slot < 4; slot++) {
        options.push(slot === answerIndex ? correct : display(distractors[d++]));
      }

      const question =
        mode === "pt-en"
          ? `Como você diz «${chunk.pt}» em inglês?`
          : mode === "en-pt"
            ? `«${chunk.en}» — o que significa?`
            : `Em que momento você usa «${chunk.en}»?`;

      return {
        id: `${idPrefix}q${i + 1}`,
        question,
        options,
        answerIndex,
        explanation: chunk.when
          ? `«${chunk.en}» = «${chunk.pt}». ${chunk.when}.`
          : `«${chunk.en}» = «${chunk.pt}».`,
      };
    })
    .filter((q): q is QuizQuestion => q !== null);
}

function authoredQuiz(items: Q[], idPrefix: string): QuizQuestion[] {
  return items.map(([question, options, answerIndex, explanation], i) => ({
    id: `${idPrefix}q${i + 1}`,
    question,
    options,
    answerIndex,
    explanation,
  }));
}

// ===========================================================================
// O composer
// ===========================================================================

export interface ComposeContext {
  circuit: CircuitSpec;
  material: CircuitContent;
  day: DayRole;
  /** Circuitos revisados neste dia (dias 6 e 13). */
  reviewOf: number[];
  authenticInput: AuthenticInput[];
  livePrompt: string;
  /** Blocos vindos dos circuitos revisados — alimentam os dias 6, 10 e 13. */
  reviewChunks: { circuit: number; title: string; chunks: Chunk[] }[];
}

export function composeLesson(ctx: ComposeContext): ComposedLesson {
  const { circuit, material, day, reviewOf, authenticInput, livePrompt, reviewChunks } = ctx;
  const seed = circuit.number * 17 + day.day;
  const chunks = circuit.chunks;
  const chunkList = chunks.map((c) => `${c.en} — ${c.pt}`);

  const soundsBlock: LessonBlock = {
    type: "callout",
    variant: "tip",
    title: "Os sons que travam o brasileiro aqui",
    body: material.sounds.map(([focus, tip]) => `**${focus}** — ${tip}`).join("\n\n"),
  };

  const pitfallBlock: LessonBlock = {
    type: "callout",
    variant: "warning",
    title: "O erro que quase todo brasileiro comete",
    body: circuit.pitfall,
  };

  switch (day.day) {
    // ===================================================== DIA 1 — Imersão
    case 1:
      return {
        content: {
          warmup:
            "Hoje você não lê nada em inglês. Só **ouve**. Não é preguiça de método, é a ordem certa: " +
            "quando você lê antes de ouvir, seu cérebro gruda a pronúncia do português nas letras — e " +
            "desfazer isso depois dá muito mais trabalho do que acertar agora.",
          gated: [
            dialogueBlock("Agora sim: o texto", material.immersion),
            pitfallBlock,
            {
              type: "practice",
              title: "Última escuta, agora acompanhando",
              instruction:
                "Ouça de novo lendo junto. Deixe a boca se mexer, mesmo sem som — é assim que a memória motora começa.",
              prompts: [
                `Quantas vezes você ouviu «${chunks[0]?.en ?? ""}»?`,
                "Qual foi a última frase da conversa?",
                "Que palavras soaram grudadas, como se fossem uma só?",
              ],
            },
          ],
          blocks: [
            {
              type: "callout",
              variant: "tip",
              title: "Como usar os próximos minutos",
              body:
                "**Primeira escuta:** deixe passar. Não tente entender nada. Preste atenção só na música da conversa — onde sobe, onde desce.\n\n" +
                "**Segunda escuta:** tente pegar os nomes e os números. Só isso.\n\n" +
                "**Terceira escuta:** tente perceber qual frase se repete.\n\n" +
                "Só depois das três o texto aparece.",
            },
            {
              type: "text",
              title: "A cena de hoje",
              body:
                `${circuit.situation}\n\nA conversa inteira dura menos de um minuto e usa ${chunks.length} blocos prontos. ` +
                "É literalmente tudo que essa situação exige de você.",
            },
          ],
          summary:
            "Você acabou de ouvir uma conversa inteira em inglês e reconheceu pedaços dela. Não porque estudou " +
            "gramática — porque conversa é feita de blocos repetidos, e você começou a reconhecê-los.",
          homework: "Antes de dormir, ouça o áudio mais uma vez. Sem o texto. Só deixe passar.",
        },
        chunks,
        quiz: authoredQuiz(material.quiz.slice(0, 2) as Q[], `c${circuit.number}d1`),
        speakingPrompt:
          `Listen to the dialogue one more time. Then record yourself saying just the first line out loud: ` +
          `"${chunks[0]?.en ?? ""}". Don't worry about your accent yet — just say it.`,
        immersionScript: scriptOf(material.immersion),
        listeningScript: null,
        grammarFocus: null,
        grammarExplanation: null,
        extensions: { srs_target: 0 },
      };

    // =============================================== DIA 2 — Blocos na boca
    case 2:
      return {
        content: {
          warmup:
            "Ontem você ouviu. Hoje você põe na boca. A regra do dia é uma só: **nada em silêncio**. " +
            "Ler bloco com os olhos não constrói nada — fala é memória motora, e músculo só aprende se mexer.",
          blocks: [
            {
              type: "examples",
              title: `Os ${chunks.length} blocos deste circuito`,
              items: chunks.map((c) => ({ en: c.en, pt: c.pt, note: c.when })),
            },
            {
              type: "practice",
              title: "Como treinar cada bloco",
              instruction:
                "Para cada bloco: ouça o modelo, pause, repita 3x em voz alta. Na terceira, tente sair sem olhar o texto.",
              prompts: [
                "1ª repetição: copie o som, mesmo sem entender cada palavra.",
                "2ª repetição: copie a entonação — onde a voz sobe e onde desce.",
                "3ª repetição: fale olhando para o lado, sem ler.",
              ],
            },
            soundsBlock,
            {
              type: "callout",
              variant: "culture",
              title: "Bloco inteiro, nunca palavra solta",
              body:
                `Não decore «${chunks[0]?.en.split(" ")[0] ?? ""}» separado. Decore «${chunks[0]?.en ?? ""}» inteiro. ` +
                "Palavra solta você precisa montar na hora, e montar na hora é o que trava. Bloco inteiro sai sozinho.",
            },
          ],
          summary: `${chunks.length} blocos na boca. Amanhã você começa a trocar as peças deles.`,
          homework:
            "Escolha 2 blocos e diga cada um 5 vezes enquanto faz outra coisa — lavando louça, no chuveiro, no trânsito.",
        },
        chunks,
        quiz: recallQuiz(chunks, seed, "pt-en", 4, `c${circuit.number}d2`),
        speakingPrompt:
          `Record yourself saying all ${chunks.length} chunks from this circuit, one after another, ` +
          `without reading. Pause between them. Start with "${chunks[0]?.en ?? ""}".`,
        immersionScript: null,
        listeningScript: null,
        grammarFocus: null,
        grammarExplanation: null,
        extensions: { srs_target: chunks.length },
      };

    // ============================================== DIA 3 — Troca de peças
    case 3:
      return {
        content: {
          warmup:
            `Hoje o bloco vira molde. Você já disse «${circuit.pattern}» várias vezes — agora vai descobrir ` +
            "que a maior parte dele é fixa, e só um pedacinho muda. É por isso que sete blocos viram setenta frases.",
          blocks: [
            {
              type: "text",
              title: "O molde do circuito",
              body: `**${circuit.pattern}**\n\n${circuit.patternNote}`,
            },
            {
              type: "drill",
              title: "Troque a peça, mantenha o molde",
              instruction:
                "Fale cada uma em voz alta, sem pausa entre elas. A parte fixa tem que sair igual todas as vezes — é ela que precisa virar automática.",
              items: material.swaps.map((piece) => applySwap(circuit.pattern, piece)),
            },
            {
              type: "practice",
              title: "Agora sem a lista",
              instruction:
                "Feche os olhos e produza 5 frases novas com o mesmo molde, usando peças que você inventar.",
              prompts: [
                "Uma sobre você.",
                "Uma sobre alguém da sua casa.",
                "Uma sobre o seu trabalho.",
                "Uma que seria útil numa viagem.",
                "Uma que você usaria hoje mesmo.",
              ],
            },
          ],
          summary:
            "Um molde, muitas peças. É assim que se fala inglês sem montar frase do zero toda vez.",
          homework: "Escreva 3 frases suas com o molde de hoje. Depois diga cada uma em voz alta.",
        },
        chunks,
        quiz: recallQuiz(chunks, seed, "when", 4, `c${circuit.number}d3`),
        speakingPrompt:
          `Use the pattern "${circuit.pattern}" to say five different sentences about your own life. ` +
          "Record them one after another, without stopping to think between them.",
        immersionScript: null,
        listeningScript: null,
        grammarFocus: material.why.title,
        grammarExplanation: material.why.body,
        extensions: { srs_target: chunks.length },
      };

    // ================================================ DIA 4 — Escuta ativa
    case 4:
      return {
        content: {
          warmup:
            "Mesma situação, cena diferente, gente diferente. É aqui que se descobre se o bloco realmente colou: " +
            "reconhecer o que você treinou dentro de uma conversa que você nunca ouviu antes.",
          blocks: [
            {
              type: "practice",
              title: "Ouça ANTES de ler a transcrição",
              instruction:
                "Duas escutas sem texto. Só depois abra a transcrição — e só se precisar.",
              prompts: [
                "Qual dos blocos do circuito apareceu nesta conversa?",
                "O que a pessoa queria resolver?",
                "Alguma frase apareceu num formato diferente do que você treinou?",
              ],
            },
            dialogueBlock("A conversa de hoje", material.listening),
            {
              type: "callout",
              variant: "tip",
              title: "Não entendeu tudo? Ótimo sinal",
              body:
                "Nativo não desacelera, e você não precisa de 100% para acompanhar. O que importa é pegar o " +
                "suficiente para responder. Entender tudo virá — e virá de ouvir muito, não de traduzir devagar.",
            },
          ],
          summary:
            "Você reconheceu blocos treinados dentro de uma conversa nova. É esse reconhecimento que vira compreensão.",
          homework: "Ouça o diálogo mais uma vez com o texto fechado. Veja quanto mudou desde a primeira escuta.",
        },
        chunks,
        quiz: authoredQuiz(material.quiz.slice(2, 4) as Q[], `c${circuit.number}d4`),
        speakingPrompt:
          "Retell this conversation in your own words, in English. Two or three sentences is enough. " +
          "Who was talking, what did they want, how did it end?",
        immersionScript: null,
        listeningScript: scriptOf(material.listening),
        grammarFocus: null,
        grammarExplanation: null,
        extensions: { srs_target: chunks.length },
      };

    // =================================================== DIA 5 — Sua vez
    case 5:
      return {
        content: {
          warmup:
            "Hoje é você quem fala, e a tutora ouve. Ela vai transcrever o que você **realmente** disse — " +
            "não o que você quis dizer — e mostrar onde a boca escorregou. Erre à vontade: erro gravado é erro que dá para corrigir.",
          blocks: [
            {
              type: "text",
              title: "A cena",
              body: circuit.situation,
            },
            {
              type: "practice",
              title: "Antes de gravar",
              instruction: "Trinta segundos de preparo, não mais. Preparar demais vira leitura, e leitura não é fala.",
              prompts: [
                "Escolha 3 blocos do circuito que você vai usar de propósito.",
                "Diga a primeira frase em voz alta uma vez, só para destravar.",
                "Grave sem parar. Se travar no meio, siga assim mesmo.",
              ],
            },
            soundsBlock,
            {
              type: "callout",
              variant: "culture",
              title: "Sobre a vergonha de ouvir a própria voz",
              body:
                "Todo mundo acha a própria gravação estranha, inclusive em português. Isso não é o seu inglês sendo ruim — " +
                "é o seu ouvido escutando sua voz por fora pela primeira vez. Passa na terceira gravação.",
            },
          ],
          summary: "Fala gravada e corrigida vale mais que uma hora de exercício escrito.",
          homework: "Leia a correção da tutora e regrave só a frase que ela apontou.",
        },
        chunks,
        quiz: [],
        speakingPrompt: `${circuit.situation}\n\nRecord yourself handling this situation in English, for about 45 seconds. Use at least three chunks from this circuit.`,
        immersionScript: null,
        listeningScript: null,
        grammarFocus: null,
        grammarExplanation: null,
        extensions: { srs_target: chunks.length },
      };

    // ============================================ DIA 6 — Revisão espaçada
    case 6: {
      const revisited = reviewChunks.filter((r) => reviewOf.includes(r.circuit));
      return {
        content: {
          warmup:
            "Hoje não entra nada novo. Hoje você puxa da memória — sem consultar. Lembrar com esforço é o que " +
            "transfere o bloco do curto para o longo prazo; reler é o que dá a sensação de saber sem o saber.",
          blocks: [
            {
              type: "text",
              title: "O que volta hoje",
              body: revisited.length
                ? revisited.map((r) => `**Circuito ${r.circuit} — ${r.title}**`).join("\n\n") +
                  "\n\nEsses intervalos (1, 2 e 4 circuitos atrás) não são aleatórios: batem a curva do esquecimento no ponto em que o bloco está prestes a sumir."
                : "Este é o começo do curso, então a revisão de hoje é só do próprio circuito. A partir do próximo, os blocos antigos começam a voltar.",
            },
            {
              type: "practice",
              title: "Recuperação ativa, sem olhar",
              instruction:
                "Leia só o português e produza o inglês em voz alta antes de conferir. Errar aqui é parte do exercício — é o erro que marca onde reforçar.",
              prompts: (revisited.length ? revisited.flatMap((r) => r.chunks) : chunks)
                .slice(0, 8)
                .map((c) => c.pt),
            },
            {
              type: "callout",
              variant: "tip",
              title: "Sua fila individual está na aba Revisão",
              body:
                "Cada bloco que você já viu tem uma data própria de retorno, calculada pelo seu desempenho. " +
                "A aba **Revisão** mostra só os que venceram hoje — e um bloco só conta como dominado depois " +
                "que você o **falou** em voz alta, não depois de reconhecê-lo numa lista.",
            },
          ],
          summary: "Revisão espaçada é o que separa quem lembra em novembro do que estudou em março.",
          homework: "Abra a aba Revisão e zere a fila de hoje. Leva menos tempo do que parece.",
        },
        chunks,
        quiz: recallQuiz(
          revisited.length ? revisited.flatMap((r) => r.chunks) : chunks,
          seed,
          "pt-en",
          5,
          `c${circuit.number}d6`,
        ),
        speakingPrompt:
          "Say out loud, from memory, every chunk you can remember from the last three circuits. " +
          "Don't check the list first — record whatever comes, then compare.",
        immersionScript: null,
        listeningScript: null,
        grammarFocus: null,
        grammarExplanation: null,
        extensions: { srs_target: 20 },
      };
    }

    // ================================================= DIA 7 — Missão real
    case 7:
      return {
        content: {
          warmup:
            "Fim da primeira semana do circuito. Hoje o inglês sai do aplicativo: você vai usar isso com uma " +
            "pessoa de verdade, ou com você mesmo em condição real. Aplicativo nenhum ensina a falar — ele só prepara.",
          blocks: [
            {
              type: "callout",
              variant: "tip",
              title: "Sua missão",
              body: circuit.mission,
            },
            {
              type: "text",
              title: "Simulação completa antes de valer",
              body:
                "Rode a cena inteira sozinho, do começo ao fim, em voz alta. Faça as duas vozes. " +
                "Parece bobo e funciona: quando a situação real chegar, sua boca já vai ter passado por ela.",
            },
            dialogueBlock("O roteiro base, para você adaptar", material.immersion),
            {
              type: "practice",
              title: "Checklist da missão",
              instruction: "Marque mentalmente cada item enquanto faz.",
              prompts: [
                "Usei pelo menos 3 blocos do circuito.",
                "Falei sem traduzir do português no meio.",
                "Quando travei, usei uma frase de socorro em vez de calar.",
                "Terminei a interação sem trocar para o português.",
              ],
            },
          ],
          summary:
            "Fase A fechada. Você conhece a situação, tem os blocos e já usou fora daqui. A fase B endurece as condições.",
          homework: circuit.mission,
        },
        chunks,
        quiz: recallQuiz(chunks, seed, "en-pt", 4, `c${circuit.number}d7`),
        speakingPrompt: `${circuit.mission}\n\nRecord the whole interaction from start to finish, playing both sides if you need to.`,
        immersionScript: null,
        listeningScript: scriptOf(material.immersion),
        grammarFocus: null,
        grammarExplanation: null,
        extensions: { srs_target: chunks.length },
      };

    // ============================================ DIA 8 — Input autêntico
    case 8:
      return {
        content: {
          warmup:
            "A partir de hoje entra material que **não foi feito para estudante**. Áudio de curso é limpo, pausado " +
            "e articulado; conversa real é rápida, sobreposta e cheia de ruído. Quem só treina no limpo trava no primeiro contato com o sujo.",
          blocks: [
            {
              type: "callout",
              variant: "tip",
              title: "Como consumir sem desistir nos primeiros 5 minutos",
              body:
                "**Não busque entender tudo.** Busque entender o suficiente para acompanhar.\n\n" +
                "Passe 1: assista/ouça inteiro, sem legenda, sem pausar. Vai perder muito. Normal.\n\n" +
                "Passe 2: de novo, agora anotando 3 pedaços que você reconheceu.\n\n" +
                "Passe 3 (opcional): com legenda em inglês — nunca em português.",
            },
            {
              type: "text",
              title: "Por que legenda em português atrapalha",
              body:
                "Com legenda em português seu cérebro lê e desliga o ouvido. Você termina o episódio achando que " +
                "treinou escuta, e treinou leitura. Legenda em inglês ainda serve de muleta; a em português substitui a perna.",
            },
            {
              type: "practice",
              title: "Depois de consumir",
              instruction: "Responda em voz alta, em inglês, mesmo que saia torto.",
              prompts: [
                "What was it about?",
                "What is one thing you understood completely?",
                "What is one thing you heard but could not understand?",
              ],
            },
          ],
          summary:
            "Input autêntico é o que faz a diferença entre entender o professor e entender um americano.",
          homework: "Escolha um dos materiais sugeridos e consuma 10 minutos. Sem legenda em português.",
        },
        chunks,
        quiz: [],
        speakingPrompt:
          "Talk for 40 seconds in English about what you just watched or listened to. " +
          "What was it about? What did you catch? What went over your head?",
        immersionScript: null,
        listeningScript: null,
        grammarFocus: null,
        grammarExplanation: null,
        extensions: { authentic_input: authenticInput, srs_target: 10 },
      };

    // =================================================== DIA 9 — Shadowing
    case 9: {
      const shadow = material.immersion.map(([, en]) => en);
      return {
        content: {
          warmup:
            "Shadowing é o exercício que mais muda ritmo e sotaque, e é o mais desconfortável dos primeiros dias. " +
            "Você fala **por cima** do áudio, com cerca de meio segundo de atraso, sem parar — mesmo perdendo pedaços.",
          blocks: [
            {
              type: "callout",
              variant: "tip",
              title: "Como fazer shadowing de verdade",
              body:
                "1. Deixe o áudio rodar do início ao fim, **sem pausar**.\n" +
                "2. Comece a falar meio segundo depois de cada fala começar.\n" +
                "3. Perdeu o fio? Não volte. Entre de novo na próxima frase.\n" +
                "4. Repita a faixa inteira 3 vezes.\n\n" +
                "Não é para entender. É para **imitar**: velocidade, ligação entre palavras, onde a voz sobe e cai.",
            },
            {
              type: "drill",
              title: "As falas de hoje",
              instruction:
                "Primeiro leia em voz alta no seu ritmo. Depois jogue o áudio e fale por cima, sem olhar.",
              items: shadow,
            },
            {
              type: "callout",
              variant: "warning",
              title: "Se está confortável, está fácil demais",
              body:
                "Shadowing bem feito cansa a boca e dá a sensação de estar sempre meio passo atrás. É esse desconforto " +
                "que reprograma o ritmo. Quando ficar fácil, suba para 1,25x.",
            },
          ],
          summary: "Ritmo e ligação entre palavras não se aprendem lendo. Se aprendem imitando, em cima do áudio.",
          homework: "Mais uma rodada de shadowing antes de dormir. 3 minutos bastam.",
        },
        chunks,
        quiz: [],
        speakingPrompt:
          "Record yourself shadowing the dialogue: play the audio and speak over it, half a second behind. " +
          "Send the recording even if you lose track in the middle — that is expected.",
        immersionScript: null,
        listeningScript: scriptOf(material.immersion),
        grammarFocus: null,
        grammarExplanation: null,
        extensions: {
          shadowing: {
            script: scriptOf(material.immersion),
            instruction:
              "Fale por cima do áudio com meio segundo de atraso, sem pausar. Três passadas completas.",
          },
          srs_target: 10,
        },
      };
    }

    // ==================================================== DIA 10 — Expansão
    case 10: {
      const crossed = reviewChunks.slice(0, 3);
      return {
        content: {
          warmup:
            "Até aqui suas frases foram curtas, e frase curta resolve o balcão mas não sustenta conversa. " +
            "Hoje você emenda: o molde deste circuito grudado no que já passou, virando frase longa.",
          blocks: [
            {
              type: "examples",
              title: "Curto vira longo",
              items: material.expansion.map(([en, pt]) => ({ en, pt })),
            },
            {
              type: "text",
              title: "O truque é o conectivo",
              body:
                "Repare que nenhuma dessas frases tem palavra nova. O que mudou foi a costura: **and**, **but**, " +
                "**because**, **so**, **when**. Cinco palavrinhas que transformam quem fala por blocos em quem fala por parágrafos.",
            },
            crossed.length
              ? {
                  type: "drill",
                  title: "Cruze com o que já passou",
                  instruction:
                    "Monte uma frase longa juntando um bloco deste circuito com um bloco de cada circuito abaixo.",
                  items: crossed.map(
                    (r) => `Circuito ${r.circuit} (${r.title}): «${r.chunks[0]?.en ?? ""}»`,
                  ),
                }
              : {
                  type: "drill",
                  title: "Emende os blocos deste circuito",
                  instruction: "Junte dois blocos numa frase só, usando and, but, because ou so.",
                  items: chunkList.slice(0, 5),
                },
            {
              type: "practice",
              title: "Fale 40 segundos sem parar",
              instruction:
                "Cronometre. O objetivo não é acertar tudo — é não deixar buraco de silêncio. Emende com conectivo mesmo que a frase fique torta.",
              prompts: [
                "Comece pela situação deste circuito.",
                "Emende com algo que você fez ontem.",
                "Termine com o que pretende fazer amanhã.",
              ],
            },
          ],
          summary:
            "Frase longa não é frase difícil. É frase curta com conectivo — e é isso que faz você soar fluente.",
          homework: "Grave 40 segundos falando sem parar sobre qualquer coisa. Conte quantas vezes usou conectivo.",
        },
        chunks,
        quiz: recallQuiz(chunks, seed, "pt-en", 4, `c${circuit.number}d10`),
        speakingPrompt:
          "Speak for 40 seconds without stopping. Link your sentences with and, but, because, so and when. " +
          "Silence is the only mistake here — a clumsy sentence is fine.",
        immersionScript: null,
        listeningScript: null,
        grammarFocus: null,
        grammarExplanation: null,
        extensions: { srs_target: chunks.length },
      };
    }

    // ============================================ DIA 11 — Conversa ao vivo
    case 11:
      return {
        content: {
          warmup:
            "Hoje é voz em tempo real. Sem gravar e regravar, sem tempo de montar a frase na cabeça — que é " +
            "exatamente a condição da vida real, e a única que treina responder no susto.",
          blocks: [
            {
              type: "callout",
              variant: "tip",
              title: "Antes de abrir a sala",
              body:
                "Escolha 3 blocos do circuito que você vai usar de propósito. Ter uma intenção evita a conversa " +
                "virar só *yes / no / I don't know*.",
            },
            {
              type: "text",
              title: "O cenário de hoje",
              body: circuit.situation,
            },
            {
              type: "practice",
              title: "Frases de socorro — decore antes de entrar",
              instruction:
                "Travar é normal e vai acontecer. O que separa quem evolui de quem desiste é ter o que dizer no travamento.",
              prompts: [
                "Sorry, could you say that again?",
                "How do you say ___ in English?",
                "Let me think for a second.",
                "I'm not sure how to say this, but...",
              ],
            },
            {
              type: "callout",
              variant: "warning",
              title: "Você vai errar ao vivo. É para errar mesmo",
              body:
                "A Emma corrige só o que atrapalha o entendimento, e corrige dentro da conversa — repetindo certo e seguindo. " +
                "Ninguém para para explicar gramática, porque na vida real também ninguém para.",
            },
          ],
          summary: "Conversa ao vivo é o treino que mais se parece com o jogo. O resto é aquecimento.",
          homework: "Se sobrar ânimo, abra a sala uma segunda vez e fale de outro assunto qualquer.",
        },
        chunks,
        quiz: [],
        speakingPrompt:
          "Open the live room and have a real conversation in this scenario. Aim for at least 5 minutes " +
          "and try to use three chunks from this circuit on purpose.",
        immersionScript: null,
        listeningScript: null,
        grammarFocus: null,
        grammarExplanation: null,
        extensions: { live_prompt: livePrompt, srs_target: 10 },
      };

    // =========================================== DIA 12 — Escuta acelerada
    case 12:
      return {
        content: {
          warmup:
            "Mesmo diálogo do dia 4, agora acelerado. O princípio é o de treinar com peso e competir sem: depois " +
            "de acompanhar a 1,5x, a velocidade normal do americano soa quase devagar.",
          blocks: [
            {
              type: "callout",
              variant: "tip",
              title: "A escada de velocidade",
              body:
                "**1x** — uma passada só, para reativar.\n\n" +
                "**1,25x** — duas passadas. Vai parecer rápido; siga assim mesmo.\n\n" +
                "**1,5x** — duas passadas. Você vai perder pedaços, e tudo bem.\n\n" +
                "**1x de novo** — a última. Repare como agora sobra tempo.",
            },
            dialogueBlock("A transcrição, se precisar conferir", material.listening),
            {
              type: "practice",
              title: "O teste do dia",
              instruction: "Depois da escada completa, responda sem olhar o texto.",
              prompts: [
                "Você conseguiu acompanhar a 1,5x sem se perder totalmente?",
                "A passada final a 1x soou mais lenta que a primeira do dia?",
                "Que palavras continuaram grudadas mesmo na velocidade normal?",
              ],
            },
          ],
          summary:
            "Velocidade de escuta é treinável, e treina-se por sobrecarga — não por ouvir devagar mais vezes.",
          homework: "Pegue qualquer vídeo em inglês e assista 5 minutos a 1,25x.",
        },
        chunks,
        quiz: recallQuiz(chunks, seed, "en-pt", 4, `c${circuit.number}d12`),
        speakingPrompt:
          "Listen at 1.5x one last time, then record yourself summarizing the dialogue in English " +
          "as fast as you comfortably can. Speed matters more than perfection today.",
        immersionScript: null,
        listeningScript: scriptOf(material.listening),
        grammarFocus: null,
        grammarExplanation: null,
        extensions: { srs_target: chunks.length },
      };

    // ========================================= DIA 13 — Revisão intercalada
    case 13: {
      const mixed = reviewChunks.filter((r) => reviewOf.includes(r.circuit));
      const pool = mixed.length ? mixed.flatMap((r) => r.chunks) : chunks;
      return {
        content: {
          warmup:
            "Hoje os blocos vêm embaralhados, de circuitos distantes e fora de ordem. Vai render menos acertos que " +
            "uma revisão organizada — e é justamente por isso que funciona melhor. Quando tudo vem em bloco, você lembra do bloco; quando vem misturado, você lembra do bloco certo.",
          blocks: [
            {
              type: "text",
              title: "De onde vêm os blocos de hoje",
              body: mixed.length
                ? mixed.map((r) => `**Circuito ${r.circuit} — ${r.title}**`).join("\n\n")
                : "Ainda há poucos circuitos para trás, então a mistura de hoje é do próprio circuito. A partir dos próximos, o embaralhamento fica sério.",
            },
            {
              type: "practice",
              title: "Português na tela, inglês na boca",
              instruction:
                "Sem consultar. Diga em voz alta antes de conferir. Se demorar mais de 3 segundos, conte como erro — na conversa real você não teria esses 3 segundos.",
              prompts: pool.slice(0, 10).map((c) => c.pt),
            },
            {
              type: "callout",
              variant: "culture",
              title: "Por que intercalar parece pior e é melhor",
              body:
                "Revisão em bloco dá sensação de domínio porque o contexto entrega a resposta. Intercalada, seu " +
                "cérebro precisa primeiro descobrir de onde vem a pergunta — que é exatamente o trabalho que a " +
                "conversa real exige. Custa mais e fixa mais.",
            },
          ],
          summary: "Errar mais hoje é sinal de que o exercício está calibrado, não de que você regrediu.",
          homework: "Abra a aba Revisão e feche a fila do dia.",
        },
        chunks,
        quiz: recallQuiz(pool, seed, "pt-en", 5, `c${circuit.number}d13`),
        speakingPrompt:
          "Pick five chunks at random from any circuit you have done so far and use each one in a new sentence. " +
          "Record all five in a row, without stopping.",
        immersionScript: null,
        listeningScript: null,
        grammarFocus: null,
        grammarExplanation: null,
        extensions: { srs_target: 20 },
      };
    }

    // ================================================= DIA 14 — Sem roteiro
    default:
      return {
        content: {
          warmup:
            "Último dia do circuito, e o único sem roteiro. Começa na situação que você treinou e deriva para " +
            "onde a conversa quiser ir — porque conversa real nunca fica no assunto que começou.",
          blocks: [
            {
              type: "text",
              title: "Comece aqui",
              body: circuit.situation,
            },
            {
              type: "drill",
              title: "E deixe derivar para",
              instruction:
                "Não escolha antes. Deixe a conversa te levar para um destes — ou para qualquer outro lugar.",
              items: material.drift,
            },
            {
              type: "callout",
              variant: "tip",
              title: "Como manter a conversa viva quando acaba o assunto",
              body:
                "**Devolva a pergunta:** *What about you?*\n\n" +
                "**Peça detalhe:** *How was that?* / *What happened next?*\n\n" +
                "**Reaja e emende:** *Oh really? That's funny, because...*\n\n" +
                "Conversa não morre por falta de vocabulário. Morre por falta de curiosidade demonstrada.",
            },
            {
              type: "practice",
              title: "Fechando o circuito",
              instruction: "Antes de seguir, responda honestamente para si mesmo.",
              prompts: [
                "Quais blocos deste circuito já saem sem eu pensar?",
                "Qual ainda me faz parar para montar?",
                "Eu conseguiria me virar nesta situação hoje, na rua?",
              ],
            },
          ],
          summary: `Circuito ${circuit.number} fechado: ${circuit.title}. Amanhã começa uma situação nova — e esta volta na sua fila de revisão.`,
          homework:
            "Conte para alguém, em português mesmo, o que você consegue fazer em inglês agora que não conseguia há duas semanas.",
        },
        chunks,
        quiz: recallQuiz(chunks, seed, "when", 4, `c${circuit.number}d14`),
        speakingPrompt:
          `Start talking about this: ${circuit.situation}\n\n` +
          "Then let the topic drift wherever it wants. Speak for at least a minute and do not go back to Portuguese.",
        immersionScript: null,
        listeningScript: null,
        grammarFocus: null,
        grammarExplanation: null,
        extensions: { live_prompt: livePrompt, srs_target: chunks.length },
      };
  }
}
