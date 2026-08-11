/**
 * Publica o curso inteiro no Supabase: 4 Cantos, 52 Circuitos e 728 lições.
 *
 *   npm run seed:curriculum
 *   npm run seed:curriculum -- --dry     (não escreve nada, só valida)
 *
 * TODO o conteúdo vem de `content/`: nenhuma chamada de API acontece aqui.
 * As lições nascem PUBLICADAS porque elas estão prontas: foram redigidas à
 * mão em `content/circuits/` e expandidas por `content/compose-lesson.ts`.
 *
 * Idempotente: rodar de novo atualiza o que existe em vez de duplicar.
 */

import { materialDoCircuito } from "@content/material";
import {
  composeLesson,
  type Bloco,
  type Fala,
  type MaterialDoCircuito,
} from "@content/compose-lesson";
import {
  authenticInputFor,
  buildLessonPlan,
  CANTOS,
  CIRCUITS,
  DAY_RHYTHM,
  interleavedReview,
  livePromptFor,
  reviewChunksFor,
  TOTAL_DAYS,
} from "@content/curriculum";
import { PORTOES, portaoDe } from "@content/metodo/portoes";
import type { Chunk, StudyTrack } from "@/lib/types/database";

import { progress, supabaseAdmin } from "./_shared";

const DRY = process.argv.includes("--dry");

const COURSE = {
  slug: "ingles-para-conversacao",
  title: "Inglês Destravado: 4 Cantos",
  subtitle: "52 circuitos · 728 dias · da primeira frase à conversa livre",
  description:
    "Inglês para conversação, para brasileiros que começam do zero. Aqui você não estuda " +
    "'verbo to be': aprende blocos de fala prontos e sai usando desde o primeiro dia. " +
    "Cada circuito é uma situação real: pedir um café, resolver um problema no hotel, " +
    "participar de uma reunião: trabalhada em 14 dias: os 7 primeiros para adquirir, " +
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
  console.log(`\n✓ Material completo: ${CIRCUITS.length} circuitos redigidos.`);

  if (DRY) {
    const plan = buildLessonPlan();
    console.log(`✓ Plano expande para ${plan.length} lições (esperado: ${TOTAL_DAYS}).`);
    const sample = composeFor(1);
    console.log(`✓ Composição do dia 1 gerou ${sample.content.blocks?.length ?? 0} blocos e ${sample.quiz.length} questões.`);
    console.log(`✓ Portões: ${PORTOES.length} legíveis na prosa, ${gateRows().length} linhas a semear.`);
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
  // órfãs junto: inofensivo em base nova, destrutivo em base com alunos.
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
        `aplicação sem roteiro. Nenhum bloco novo: os mesmos, em condições mais duras.`,
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
      throw new Error(`Falha ao inserir lições ${i + 1}: ${i + batch.length}: ${error.message}`);
    }
    progress(Math.min(i + CHUNK, lessonRows.length), lessonRows.length, "lições");
  }

  const { count: published } = await supabase
    .from("lessons")
    .select("*", { count: "exact", head: true })
    .eq("course_id", course.id)
    .eq("is_published", true);

  // ------------------------------------------------------------ 156 portões
  //
  // DEPOIS das lições, e não antes, de propósito. Os portões são diagnóstico:
  // eles dizem ao aluno por que passou ou não, e não trancam nada. Semeá-los
  // antes fazia uma tabela diagnóstica virar pré-requisito do produto: quem
  // rodasse o seed contra um banco sem a migration 1400 morria aqui e ficava
  // com zero das 728 lições publicadas. Agora o curso inteiro entra primeiro,
  // e uma falha aqui é ruidosa sem ser destrutiva.
  console.log("\n▸ Portões…");
  const { data: portoes, error: portoesError } = await supabase
    .from("circuit_gates")
    .upsert(gateRows(), { onConflict: "track,circuit_number" })
    .select();

  if (portoesError || !portoes) {
    throw new Error(
      `Falha ao semear os portões: ${portoesError?.message}\n` +
        `  As lições JÁ foram publicadas: o curso está no ar. Falta só o\n` +
        `  diagnóstico dos 52 circuitos. Rode npm run db:bundle, cole\n` +
        `  supabase/schema.sql e rode este seed de novo.`,
    );
  }
  console.log(`  ✓ ${portoes.length} portões`);

  const withQuiz = lessonRows.filter((l) => l.quiz.length > 0).length;
  const withAudio = lessonRows.filter((l) => l.immersion_script || l.listening_script).length;

  console.log(`
✓ Seed concluído: o curso está pronto para uso.

  Curso .................. ${course.title}
  Cantos ................. ${cantos.length}
  Circuitos .............. ${circuits.length}
  Portões ................ ${portoes.length}
  Lições ................. ${lessonRows.length}
  Publicadas ............. ${published ?? 0}
  Com quiz ............... ${withQuiz}
  Com diálogo em áudio ... ${withAudio}

  O áudio é sintetizado no navegador a partir destes textos: não há
  arquivo para gerar nem chave de API envolvida.

  Próximo passo: npm run dev
`);
}

/**
 * Os 156 portões: 52 circuitos × 3 trilhas.
 *
 * `content/metodo/portoes.ts` extrai 104 deles da prosa de rampa.json — 52 do
 * Completo e 52 da Essencial — e é essa mesma prosa que vai inteira para
 * `prose`: é o que o aluno lê, e é o único lugar onde está a tarefa falada de
 * cada quinzena, que não tem número e nenhuma consulta avalia.
 *
 * O Intensivo repete o portão do Completo: as duas trilhas medem as mesmas
 * coisas, e o que o Intensivo compra é volume e velocidade, não critério
 * diferente. Semear só as duas trilhas escritas faria `evaluate_circuit_gate`
 * levantar "Portão do circuito N não foi semeado para a trilha intensive" na
 * primeira vez que um aluno do Intensivo abrisse a tela do portão.
 */
function gateRows() {
  const trilhas: StudyTrack[] = ["essential", "complete", "intensive"];
  const agora = new Date().toISOString();

  return trilhas.flatMap((track) =>
    CIRCUITS.map((circuit) => {
      const portao = portaoDe(circuit.number, track);
      // `portoes.ts` já derruba o import quando um portão fica ilegível; aqui
      // sobra o caso de a rampa perder um circuito inteiro. Semear a linha com
      // `components: []` seria pior que falhar: portão sem componente PASSA, e
      // o aluno receberia aprovação automática num circuito que não fez.
      if (!portao) {
        throw new Error(`Nenhum portão para o circuito ${circuit.number} na trilha ${track}`);
      }

      return {
        track,
        circuit_number: circuit.number,
        is_closing: portao.fechamento,
        components: portao.componentes,
        prose: portao.texto,
        updated_at: agora,
      };
    }),
  );
}

/** Compõe a lição de um dia absoluto (1..728) a partir do material local. */
function composeFor(dayNumber: number) {
  const circuitNumber = Math.ceil(dayNumber / DAY_RHYTHM.length);
  const dayInCircuit = ((dayNumber - 1) % DAY_RHYTHM.length) + 1;

  const circuit = CIRCUITS.find((c) => c.number === circuitNumber);
  if (!circuit) throw new Error(`Circuito ${circuitNumber} não existe`);
  const material = materialDoCircuito(circuit.number);
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
        ? interleavedReview(circuit.number)
        : [];

  // Blocos dos circuitos anteriores, para os dias de revisão e de expansão.

  return composeLesson({
      circuito: circuit.number,
      dia: dayInCircuit,
      material,
      livePrompt: livePromptFor(circuit),
    });
}

main().catch((error) => {
  console.error("\n✗ Erro no seed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
