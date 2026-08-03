/**
 * Verifica o curso inteiro sem tocar no banco.
 *
 *   npm run verify:content
 *
 * Compõe as 728 lições e checa as invariantes que, se quebrarem, o aluno
 * descobre antes de mim: lição vazia, quiz sem resposta certa, alternativa
 * repetida, diálogo com barra (que quebraria o separador do roteiro).
 */

import { composeLesson } from "@content/compose-lesson";
import { assertContentComplete, CONTENT_BY_CIRCUIT } from "@content/circuits";
import {
  authenticInputFor,
  buildLessonPlan,
  CANTOS,
  CIRCUITS,
  DAY_RHYTHM,
  livePromptFor,
} from "@content/curriculum";
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
    if (circuit.chunks.length < 4) warn(`${where}: ${circuit.chunks.length} blocos — quiz precisa de 4+`);

    // A barra é o separador do roteiro; dentro da fala ela quebra o parser.
    for (const [who, en] of [...m.immersion, ...m.listening]) {
      if (en.includes("/")) warn(`${where}: fala de ${who} contém "/" — quebra o roteiro`);
      if (!en.trim()) warn(`${where}: fala vazia de ${who}`);
    }

    for (const [q, options, answer] of m.quiz) {
      if (options.length !== 4) warn(`${where}: "${q.slice(0, 40)}" tem ${options.length} alternativas`);
      if (answer < 0 || answer >= options.length) warn(`${where}: "${q.slice(0, 40)}" aponta para alternativa inexistente`);
      if (new Set(options).size !== options.length) warn(`${where}: "${q.slice(0, 40)}" tem alternativa repetida`);
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

    const reviewChunks = CIRCUITS.filter((c) => c.number < circuit.number)
      .slice(-6)
      .map((c) => ({ circuit: c.number, title: c.title, chunks: c.chunks as Chunk[] }));

    const lesson = composeLesson({
      circuit,
      material,
      day,
      reviewOf: spec.reviewOf,
      authenticInput: authenticInputFor(circuit, canto.level),
      livePrompt: livePromptFor(circuit),
      reviewChunks,
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
        warn(`${where}: questão "${question.id}" tem alternativa repetida — a "certa" fica ambígua`);
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
