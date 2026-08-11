/**
 * Verifica o curso inteiro sem tocar no banco.
 *
 *   npm run verify:content
 *
 * Compõe as 728 lições e checa as invariantes que, se quebrarem, o aluno
 * descobre antes de mim: lição vazia, quiz sem resposta certa, alternativa
 * repetida, diálogo com barra (que quebraria o separador do roteiro).
 */

import { audioJobs, isCast, spokenLines, voiceFor } from "@content/audio-manifest";
import { composeLesson } from "@content/compose-lesson";
import { assertContentComplete, connectionsBefore, CONTENT_BY_CIRCUIT } from "@content/circuits";
import { AUTHENTIC_PIECES, authenticPieceFor } from "@content/circuits/authentic";
import {
  authenticInputFor,
  buildLessonPlan,
  CANTOS,
  CIRCUITS,
  DAY_RHYTHM,
  livePromptFor,
  reviewChunksFor,
} from "@content/curriculum";
import { chunksSpokenIn } from "@/lib/srs";
import type { Chunk } from "@/lib/types/database";

const problems: string[] = [];
const warn = (msg: string) => problems.push(msg);

function main() {
  assertContentComplete(CIRCUITS.length);

  // ------------------------------------------------ material bruto
  for (const circuit of CIRCUITS) {
    const m = CONTENT_BY_CIRCUIT.get(circuit.number)!;
    const where = `circuito ${circuit.number} (${circuit.title})`;

    if (m.immersion.length < 6) warn(`${where}: diálogo de imersão com só ${m.immersion.length} falas`);
    if (m.listening.length < 6) warn(`${where}: diálogo do dia 4 com só ${m.listening.length} falas`);
    if (m.swaps.length < 6) warn(`${where}: só ${m.swaps.length} peças de troca`);
    if (m.expansion.length < 3) warn(`${where}: só ${m.expansion.length} frases de expansão`);
    if (m.drift.length < 3) warn(`${where}: só ${m.drift.length} assuntos para derivar`);
    if (m.sounds.length < 2) warn(`${where}: só ${m.sounds.length} focos de som`);
    if (circuit.chunks.length < 4) warn(`${where}: ${circuit.chunks.length} blocos: quiz precisa de 4+`);

    // A barra é o separador do roteiro; dentro da fala ela quebra o parser.
    for (const [who, en] of [...m.immersion, ...m.listening]) {
      if (en.includes("/")) warn(`${where}: fala de ${who} contém "/": quebra o roteiro`);
      if (!en.trim()) warn(`${where}: fala vazia de ${who}`);
    }

    for (const [q, options, answer] of m.quiz) {
      if (options.length !== 4) warn(`${where}: "${q.slice(0, 40)}" tem ${options.length} alternativas`);
      if (answer < 0 || answer >= options.length) warn(`${where}: "${q.slice(0, 40)}" aponta para alternativa inexistente`);
      if (new Set(options).size !== options.length) warn(`${where}: "${q.slice(0, 40)}" tem alternativa repetida`);
    }

    /**
     * A peça de conexão, quando o circuito tem uma.
     *
     * O `avoids` é o campo perigoso: a tela o mostra RISCADO e sem markdown.
     * Numa primeira redação, várias notas puseram a correção junto do erro
     * («o certo é *They were talking*») — o que faria o aluno ler a forma
     * certa tachada como errada, numa nota de gramática. Aqui isso vira erro
     * de build em vez de defeito em produção.
     */
    if (m.connection) {
      const c = m.connection;
      const onde = `${where} · conexão`;

      if (!c.piece.trim()) warn(`${onde}: sem o nome da peça`);
      if (!c.title.trim()) warn(`${onde}: sem título`);

      // 3 a 6 frases é a spec. As notas do projeto têm ~60 palavras; o dia 3
      // já carrega a nota `why` na mesma tela, e as duas somadas é o que o
      // aluno lê de uma vez.
      const palavras = c.body.trim().split(/\s+/).length;
      if (palavras > 110) warn(`${onde}: corpo com ${palavras} palavras (teto 110)`);

      if (c.examples.length < 2) warn(`${onde}: só ${c.examples.length} exemplo(s), mínimo 2`);
      for (const ex of c.examples) {
        if (!ex.en.trim() || !ex.pt.trim()) warn(`${onde}: exemplo sem inglês ou sem tradução`);
      }

      if (!c.avoids.trim()) {
        warn(`${onde}: sem a frase errada`);
      } else {
        if (/[*_«»]/.test(c.avoids))
          warn(`${onde}: "avoids" tem markdown — sai literal na tela, é texto cru`);
        if (/\bo certo é\b|\bcorreto\b|\bem vez de\b|→/i.test(c.avoids))
          warn(`${onde}: "avoids" traz a correção — ela sairia RISCADA. Só o erro aqui`);
        if (c.avoids.split(/\s+/).length > 14)
          warn(`${onde}: "avoids" com ${c.avoids.split(/\s+/).length} palavras — é uma frase só`);
      }
    }
  }

  // ------------------------------------------------ escuta estendida (dia 8)
  //
  // Este material é redigido pelo Gemini em `npm run gen:listening` e revisado
  // por gente. As checagens abaixo pegam o que a revisão humana deixa passar:
  // formato que quebra o player e limite do TTS.
  for (const piece of AUTHENTIC_PIECES) {
    const where = `escuta estendida do circuito ${piece.n}`;

    const speakers = [...new Set(piece.lines.map(([who]) => who))];
    if (speakers.length !== 2) {
      warn(`${where}: ${speakers.length} locutores (${speakers.join(", ")}): o TTS exige 2`);
    }

    const circuito = CIRCUITS.find((c) => c.number === piece.n);
    const nivel = circuito
      ? (CANTOS.find((k) => piece.n >= k.weekStart && piece.n <= k.weekEnd)?.level ?? "B1")
      : "B1";

    // O mínimo acompanha o nível: 20 falas valem para um B1, e são peça longa
    // demais para quem está no oitavo dia de inglês. Ver CALIBRAGEM em
    // `scripts/generate-listening.ts`.
    const minimoFalas = nivel === "A1" ? 12 : nivel === "A2" ? 18 : 20;
    if (piece.lines.length < minimoFalas) {
      warn(`${where}: só ${piece.lines.length} falas (mínimo ${minimoFalas} para ${nivel})`);
    }

    /**
     * Âncoras: quantos dos blocos treinados aparecem de fato no áudio.
     *
     * É a checagem que teria pegado o defeito do circuito 1 — 25 falas, dois
     * minutos, e nenhum dos 7 blocos dos dias 1 a 7. Sem âncora o dia 8 deixa
     * de ser um degrau e vira um muro: o aluno não reconhece nada, e conclui
     * que o curso pulou uma etapa.
     */
    if (circuito) {
      const texto = piece.lines.map(([, en]) => en).join(" ");
      const ancoras = chunksSpokenIn(texto, circuito.chunks).length;
      const exigido = nivel === "A1" ? 4 : nivel === "A2" ? 3 : nivel === "B1" ? 2 : 1;
      if (ancoras < exigido) {
        warn(
          `${where}: ${ancoras} dos ${circuito.chunks.length} blocos do circuito aparecem no áudio ` +
            `(mínimo ${exigido} para ${nivel}) — o aluno não tem onde se segurar`,
        );
      }
    }

    for (const [who, en, pt] of piece.lines) {
      if (en.includes("/")) warn(`${where}: fala de ${who} contém "/": quebra o roteiro`);
      if (!en.trim()) warn(`${where}: fala vazia de ${who}`);
      if (!pt.trim()) warn(`${where}: fala de ${who} sem tradução`);
    }

    if (piece.questions.length !== 3) warn(`${where}: ${piece.questions.length} perguntas`);
    for (const q of piece.questions) {
      if (q.options.length !== 4) warn(`${where}: "${q.question.slice(0, 40)}" tem ${q.options.length} alternativas`);
      if (q.answerIndex < 0 || q.answerIndex >= q.options.length) {
        warn(`${where}: "${q.question.slice(0, 40)}" aponta para alternativa inexistente`);
      }
      if (new Set(q.options).size !== q.options.length) {
        warn(`${where}: "${q.question.slice(0, 40)}" tem alternativa repetida`);
      }
    }
  }

  // ------------------------------------------------ elenco de vozes
  //
  // Duas invariantes que só se descobre ouvindo, e que já quebraram uma vez: a
  // Sarah saiu com voz de homem e o Bruno trocou de voz entre diálogos porque
  // a voz vinha de um hash cego. Agora vem de uma tabela: e a tabela é
  // conferida aqui, antes de virar 461 arquivos de áudio.
  for (const engine of ["piper", "gemini"] as const) {
    for (const job of audioJobs()) {
      if (job.kind !== "dialogue") continue;
      const where = `áudio ${job.label} [${engine}]`;

      for (const who of job.speakers) {
        if (!isCast(who)) {
          warn(`${where}: "${who}" não está no elenco de content/audio-manifest.ts`);
        }
      }

      // Duas pessoas na mesma voz: o Gemini recusa o pedido, e no Piper o
      // aluno deixa de separar os turnos da conversa.
      const used = new Map<string, string>();
      for (const who of job.speakers) {
        const voice = voiceFor(who, engine);
        const taken = used.get(voice);
        if (taken) warn(`${where}: "${who}" e "${taken}" dividem a voz ${voice}`);
        else used.set(voice, who);
      }

      // O que de fato vai para o TTS, fala a fala: pega divergência entre o
      // elenco e o desempate de `voicePairFor`.
      if (new Set(spokenLines(job, engine).map((l) => l.voice)).size !== job.speakers.length) {
        warn(`${where}: as falas saem com menos vozes distintas que locutores`);
      }
    }
  }

  // ------------------------------------------------ lições compostas
  const plan = buildLessonPlan();
  let totalBlocks = 0;
  let totalQuestions = 0;
  let withQuiz = 0;
  let withAudio = 0;

  for (const spec of plan) {
    const circuit = CIRCUITS.find((c) => c.number === spec.circuitNumber)!;
    const material = CONTENT_BY_CIRCUIT.get(spec.circuitNumber)!;
    const day = DAY_RHYTHM.find((d) => d.day === spec.circuitDay)!;
    const canto = CANTOS.find((c) => circuit.number >= c.weekStart && circuit.number <= c.weekEnd)!;

    const reviewChunks = reviewChunksFor(circuit.number) as {
      circuit: number;
      title: string;
      chunks: Chunk[];
    }[];

    const lesson = composeLesson({
      circuit,
      material,
      day,
      reviewOf: spec.reviewOf,
      authenticInput: authenticInputFor(circuit, canto.level),
      authentic: authenticPieceFor(circuit.number),
      livePrompt: livePromptFor(circuit),
      reviewChunks,
      carriedConnections: connectionsBefore(spec.circuitNumber),
    });

    const where = `dia ${spec.dayNumber} (circuito ${spec.circuitNumber}, dia ${spec.circuitDay})`;
    const blocks = (lesson.content.blocks?.length ?? 0) + (lesson.content.gated?.length ?? 0);

    if (!blocks) warn(`${where}: nenhum bloco de conteúdo`);
    if (!lesson.content.warmup?.trim()) warn(`${where}: sem aquecimento`);
    if (!lesson.content.summary?.trim()) warn(`${where}: sem resumo`);
    if (!lesson.speakingPrompt.trim()) warn(`${where}: sem tarefa de fala`);
    if (spec.circuitDay === 1 && !lesson.immersionScript) warn(`${where}: dia 1 sem áudio de imersão`);
    if (spec.circuitDay === 1 && !lesson.content.gated?.length) {
      warn(`${where}: dia 1 sem blocos atrás do portão de imersão`);
    }
    // O portão só vale se a transcrição NÃO estiver nos blocos abertos.
    if (lesson.immersionScript) {
      const openText = JSON.stringify(lesson.content.blocks ?? []);
      const firstLine = material.immersion[0]?.[1] ?? "";
      if (firstLine && openText.includes(firstLine)) {
        warn(`${where}: a fala "${firstLine.slice(0, 30)}" vazou para fora do portão de imersão`);
      }
    }

    for (const question of lesson.quiz) {
      if (question.options.length !== 4) {
        warn(`${where}: questão "${question.id}" tem ${question.options.length} alternativas`);
      }
      if (question.answerIndex < 0 || question.answerIndex >= question.options.length) {
        warn(`${where}: questão "${question.id}" aponta para alternativa inexistente`);
      }
      if (new Set(question.options).size !== question.options.length) {
        warn(`${where}: questão "${question.id}" tem alternativa repetida: a "certa" fica ambígua`);
      }
      if (question.options.some((o) => !o?.trim())) {
        warn(`${where}: questão "${question.id}" tem alternativa vazia`);
      }
    }

    totalBlocks += blocks;
    totalQuestions += lesson.quiz.length;
    if (lesson.quiz.length) withQuiz++;
    if (lesson.immersionScript || lesson.listeningScript) withAudio++;
  }

  console.log(`
▸ Verificação do curso

  Circuitos redigidos ...... ${CIRCUITS.length}
  Lições compostas ......... ${plan.length}
  Blocos de conteúdo ....... ${totalBlocks}
  Questões de quiz ......... ${totalQuestions}
  Lições com quiz .......... ${withQuiz}
  Lições com diálogo ....... ${withAudio}
`);

  if (problems.length) {
    console.error(`✗ ${problems.length} problema(s):\n`);
    for (const p of problems.slice(0, 40)) console.error(`  · ${p}`);
    if (problems.length > 40) console.error(`  … e mais ${problems.length - 40}`);
    console.error("");
    process.exit(1);
  }

  console.log("✓ Nenhum problema. O curso está íntegro.\n");
}

main();
