/**
 * Publica o curso inteiro no Supabase: 4 Cantos, 52 Circuitos e 728 lições.
 *
 *   npm run seed:curriculum
 *   npm run seed:curriculum -- --dry     (não escreve nada, só valida)
 *
 * TODO o conteúdo vem de `content/` — nenhuma chamada de API acontece aqui.
 * As lições nascem PUBLICADAS porque elas estão prontas: foram redigidas à
 * mão em `content/circuits/` e expandidas por `content/compose-lesson.ts`.
 *
 * Idempotente: rodar de novo atualiza o que existe em vez de duplicar.
 */

import { composeLesson } from "@content/compose-lesson";
import { assertContentComplete, CONTENT_BY_CIRCUIT } from "@content/circuits";
import { authenticPieceFor } from "@content/circuits/authentic";
import {
  authenticInputFor,
  buildLessonPlan,
  CANTOS,
  CIRCUITS,
  DAY_RHYTHM,
  livePromptFor,
  TOTAL_DAYS,
} from "@content/curriculum";
import type { Chunk } from "@/lib/types/database";

import { progress, supabaseAdmin } from "./_shared";

const DRY = process.argv.includes("--dry");

const COURSE = {
  slug: "ingles-para-conversacao",
  title: "Inglês Destravado — 4 Cantos",
  subtitle: "52 circuitos · 728 dias · da primeira frase à conversa livre",
  description:
    "Inglês para conversação, para brasileiros que começam do zero. Aqui você não estuda " +
    "'verbo to be': aprende blocos de fala prontos e sai usando desde o primeiro dia. " +
    "Cada circuito é uma situação real — pedir um café, resolver um problema no hotel, " +
    "participar de uma reunião — trabalhada em 14 dias: os 7 primeiros para adquirir, " +
    "os 7 seguintes para consolidar com input autêntico, shadowing e conversa ao vivo por voz. " +
    "O cronograma é medido em dias, não em dias da semana: você faz o Dia 1, depois o Dia 2, " +
    "no ritmo que a sua vida permitir. A tutora de IA ouve sua gravação, transcreve o que você " +
    "realmente disse e mostra como corrigir, incluindo os erros que só quem fala português comete.",
  language: "en",
  level_from: "A1" as const,
  level_to: "B2" as const,
  duration_days: TOTAL_DAYS,
  daily_minutes: 60,
  accent_color: "#FF4A17",
  is_published: true,
};

async function main() {
  // Antes de tocar no banco: o curso tem que estar inteiro.
  assertContentComplete(CIRCUITS.length);
  console.log(`\n✓ Material completo: ${CIRCUITS.length} circuitos redigidos.`);

  if (DRY) {
    const plan = buildLessonPlan();
    console.log(`✓ Plano expande para ${plan.length} lições (esperado: ${TOTAL_DAYS}).`);
    const sample = composeFor(1);
    console.log(`✓ Composição do dia 1 gerou ${sample.content.blocks?.length ?? 0} blocos e ${sample.quiz.length} questões.`);
    console.log("\nModo --dry: nada foi escrito no banco.\n");
    return;
  }

  const supabase = supabaseAdmin();

  console.log("\n▸ Curso…");
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .upsert({ ...COURSE, published_at: new Date().toISOString() }, { onConflict: "slug" })
    .select()
    .single();

  if (courseError || !course) throw new Error(`Falha ao criar o curso: ${courseError?.message}`);
  console.log(`  ✓ ${course.title}`);

  // ------------------------------------------------------------ 4 Cantos
  console.log("\n▸ Cantos…");
  const { data: cantos, error: cantosError } = await supabase
    .from("modules")
    .upsert(
      CANTOS.map((c) => ({
        course_id: course.id,
        position: c.position,
        code: c.code,
        title: c.title,
        subtitle: c.subtitle,
        description: c.description,
        level: c.level,
        week_start: c.weekStart,
        week_end: c.weekEnd,
        objectives: c.objectives,
        can_do: c.canDo,
        is_published: true,
      })),
      { onConflict: "course_id,position" },
    )
    .select();

  if (cantosError || !cantos) throw new Error(`Falha ao criar cantos: ${cantosError?.message}`);
  console.log(`  ✓ ${cantos.length} cantos`);

  const cantoIdByCode = new Map(cantos.map((c) => [c.code, c.id]));

  // Módulos de grades antigas saem do catálogo. O cascade limpa as lições
  // órfãs junto — inofensivo em base nova, destrutivo em base com alunos.
  const { error: cleanupError } = await supabase
    .from("modules")
    .delete()
    .eq("course_id", course.id)
    .gt("position", CANTOS.length);

  if (cleanupError) console.warn(`  ! não removi módulos antigos: ${cleanupError.message}`);

  // --------------------------------------------------------- 52 Circuitos
  console.log("\n▸ Circuitos…");
  const circuitRows = CIRCUITS.map((circuit) => {
    const canto = CANTOS.find(
      (c) => circuit.number >= c.weekStart && circuit.number <= c.weekEnd,
    );
    if (!canto) throw new Error(`Nenhum canto cobre o circuito ${circuit.number}`);

    const moduleId = cantoIdByCode.get(canto.code);
    if (!moduleId) throw new Error(`Canto ${canto.code} não encontrado`);

    return {
      course_id: course.id,
      module_id: moduleId,
      number: circuit.number,
      title: circuit.title,
      situation: circuit.situation,
      pattern: circuit.pattern,
      pattern_note: circuit.patternNote,
      chunks: circuit.chunks,
      mission: circuit.mission,
      mindset_note: circuit.mindset,
      pitfall: circuit.pitfall,
      review_circuits: [circuit.number - 1, circuit.number - 2, circuit.number - 4].filter(
        (n) => n >= 1,
      ),
      level: canto.level,
      is_published: true,
      week_b_focus:
        `Consolidação de "${circuit.title}": input autêntico, shadowing, conversa ao vivo e ` +
        `aplicação sem roteiro. Nenhum bloco novo — os mesmos, em condições mais duras.`,
      authentic_input: authenticInputFor(circuit, canto.level),
      live_prompt: livePromptFor(circuit),
    };
  });

  const { data: circuits, error: circuitsError } = await supabase
    .from("circuits")
    .upsert(circuitRows, { onConflict: "course_id,number" })
    .select();

  if (circuitsError || !circuits) {
    throw new Error(
      `Falha ao criar circuitos: ${circuitsError?.message}\n` +
        `  Você aplicou todas as migrations? Rode npm run db:bundle e cole supabase/schema.sql.`,
    );
  }
  console.log(`  ✓ ${circuits.length} circuitos`);

  const circuitIdByNumber = new Map(circuits.map((c) => [c.number, c.id]));

  // ------------------------------------------------------------ 728 lições
  console.log("\n▸ Lições…");
  const plan = buildLessonPlan();

  const lessonRows = plan.map((spec) => {
    const moduleId = cantoIdByCode.get(spec.cantoCode);
    if (!moduleId) throw new Error(`Canto ${spec.cantoCode} não encontrado`);

    const composed = composeFor(spec.dayNumber);

    return {
      course_id: course.id,
      module_id: moduleId,
      circuit_id: circuitIdByNumber.get(spec.circuitNumber) ?? null,
      day_number: spec.dayNumber,
      week_number: spec.circuitNumber,
      circuit_day: spec.circuitDay,
      phase: spec.phase,
      title: spec.title,
      subtitle: spec.subtitle,
      kind: spec.kind,
      level: spec.level,
      estimated_minutes: spec.estimatedMinutes,
      core_minutes: spec.coreMinutes,
      objective: spec.objective,
      situation: spec.situation,
      pattern: spec.pattern,
      mission: spec.mission,
      mindset_note: spec.mindset,
      review_of: spec.reviewOf,
      extensions: composed.extensions,
      content: composed.content,
      chunks: composed.chunks,
      vocabulary: [],
      phrases: [],
      grammar_focus: composed.grammarFocus,
      grammar_explanation: composed.grammarExplanation,
      immersion_script: composed.immersionScript,
      listening_script: composed.listeningScript,
      speaking_prompt: composed.speakingPrompt,
      speaking_rubric: [
        { criterion: "Pronúncia", description: "Clareza dos fonemas, acento tônico e ritmo" },
        { criterion: "Fluência", description: "Velocidade natural, poucas hesitações" },
        { criterion: "Uso dos blocos", description: `Uso dos blocos do circuito ${spec.circuitNumber}` },
        { criterion: "Naturalidade", description: "Soa como alguém falaria de verdade" },
        { criterion: "Tarefa", description: "Cumprimento do que foi pedido" },
      ],
      quiz: composed.quiz,
      // Tudo nasce publicado: o conteúdo já existe e já foi revisado no repo.
      is_published: true,
      generated_by: "authored",
      generated_at: new Date().toISOString(),
    };
  });

  const CHUNK = 100;
  for (let i = 0; i < lessonRows.length; i += CHUNK) {
    const batch = lessonRows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("lessons")
      .upsert(batch, { onConflict: "course_id,day_number" });

    if (error) {
      throw new Error(`Falha ao inserir lições ${i + 1}–${i + batch.length}: ${error.message}`);
    }
    progress(Math.min(i + CHUNK, lessonRows.length), lessonRows.length, "lições");
  }

  const { count: published } = await supabase
    .from("lessons")
    .select("*", { count: "exact", head: true })
    .eq("course_id", course.id)
    .eq("is_published", true);

  const withQuiz = lessonRows.filter((l) => l.quiz.length > 0).length;
  const withAudio = lessonRows.filter((l) => l.immersion_script || l.listening_script).length;

  console.log(`
✓ Seed concluído — o curso está pronto para uso.

  Curso .................. ${course.title}
  Cantos ................. ${cantos.length}
  Circuitos .............. ${circuits.length}
  Lições ................. ${lessonRows.length}
  Publicadas ............. ${published ?? 0}
  Com quiz ............... ${withQuiz}
  Com diálogo em áudio ... ${withAudio}

  O áudio é sintetizado no navegador a partir destes textos — não há
  arquivo para gerar nem chave de API envolvida.

  Próximo passo: npm run dev
`);
}

/** Compõe a lição de um dia absoluto (1..728) a partir do material local. */
function composeFor(dayNumber: number) {
  const circuitNumber = Math.ceil(dayNumber / DAY_RHYTHM.length);
  const dayInCircuit = ((dayNumber - 1) % DAY_RHYTHM.length) + 1;

  const circuit = CIRCUITS.find((c) => c.number === circuitNumber);
  const material = CONTENT_BY_CIRCUIT.get(circuitNumber);
  const day = DAY_RHYTHM.find((d) => d.day === dayInCircuit);

  if (!circuit || !material || !day) {
    throw new Error(`Não consegui compor o dia ${dayNumber} (circuito ${circuitNumber})`);
  }

  const canto = CANTOS.find(
    (c) => circuit.number >= c.weekStart && circuit.number <= c.weekEnd,
  );
  if (!canto) throw new Error(`Nenhum canto cobre o circuito ${circuit.number}`);

  const reviewOf =
    dayInCircuit === 6
      ? [circuit.number - 1, circuit.number - 2, circuit.number - 4].filter((n) => n >= 1)
      : dayInCircuit === 13
        ? interleaved(circuit.number)
        : [];

  // Blocos dos circuitos anteriores, para os dias de revisão e de expansão.
  const reviewChunks = CIRCUITS.filter((c) => c.number < circuit.number)
    .slice(-6)
    .map((c) => ({
      circuit: c.number,
      title: c.title,
      chunks: c.chunks as Chunk[],
    }));

  return composeLesson({
    circuit,
    material,
    day,
    reviewOf,
    authenticInput: authenticInputFor(circuit, canto.level),
    authentic: authenticPieceFor(circuit.number),
    livePrompt: livePromptFor(circuit),
    reviewChunks,
  });
}

/** Mesma lógica determinística do currículo, para a revisão intercalada. */
function interleaved(circuit: number): number[] {
  const pool = Array.from({ length: circuit }, (_, i) => i + 1);
  const picks = new Set<number>();
  for (let i = 0; i < Math.min(5, pool.length); i++) {
    picks.add(pool[(i * 7 + circuit * 3) % pool.length]);
  }
  return [...picks].sort((a, b) => a - b);
}

main().catch((error) => {
  console.error("\n✗ Erro no seed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
