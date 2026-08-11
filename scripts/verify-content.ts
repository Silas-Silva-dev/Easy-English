/**
 * Verifica o curso inteiro sem tocar no banco.
 *
 *   npm run verify:content
 *
 * Compõe as 728 lições e checa as invariantes que, se quebrarem, o aluno
 * descobre antes de mim: lição vazia, quiz sem resposta certa, alternativa
 * repetida, diálogo com barra (que quebraria o separador do roteiro).
 */

import {
  audioJobs,
  chunkVoice,
  isCast,
  narratorVoice,
  spokenLines,
  voiceFor,
} from "@content/audio-manifest";
import { composeLesson } from "@content/compose-lesson";
import {
  ancorasExigidas,
  ehConsolidacao,
  materialDoCircuito,
} from "@content/material";
import {
  cargaDe,
  cognatosDe,
  ehRespiro,
  gramaticaDe,
  somDe,
} from "@content/metodo";
import {
  authenticInputFor,
  buildLessonPlan,
  CANTOS,
  CIRCUITS,
  DAY_RHYTHM,
  livePromptFor,
  reviewChunksFor,
} from "@content/curriculum";
import { EXPOSICAO, escutasExigidas, TOTAL_CIRCUITOS } from "@content/metodo";
import { PORTOES, portaoDe } from "@content/metodo/portoes";
import { semTextoTravado } from "@/lib/exposicao";
import { chunksSpokenIn } from "@/lib/srs";
import type { Chunk } from "@/lib/types/database";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const problems: string[] = [];
const warn = (msg: string) => problems.push(msg);

/**
 * Nenhum campo da lição devolve o inglês que o portão está escondendo.
 *
 * ===========================================================================
 * POR QUE ISTO PRECISA SER MEDIDO, E NÃO LEMBRADO
 * ===========================================================================
 * O portão do dia 1 esconde `content.gated`. A primeira versão do conserto
 * removeu esse campo do payload e deu o assunto por encerrado. Medido depois,
 * contra as 728 lições compostas, o mesmo inglês continuava saindo por três
 * outras portas: `chunks` (102 dias, 530 blocos), `briefing.expressions` (51
 * dias) e `quiz` (49 dias). Na tela, seis dos oito blocos do diálogo travado do
 * dia 1 apareciam na aba "Blocos" — com tradução, pronúncia figurada e player
 * próprio, a um clique do portão fechado.
 *
 * A coincidência não é acidente: `ancorasExigidas` EXIGE que o diálogo recite
 * os blocos do circuito palavra por palavra. Enquanto o diálogo estiver
 * travado, tudo que o cita está travado junto — e é por isso que a regra tem
 * que ser conferida a cada composição, não confiada à memória de quem mexer
 * no `compose-lesson` daqui a um ano.
 */
function verificarVazamentoDoPortao() {
  for (let n = 1; n <= TOTAL_CIRCUITOS; n++) {
    for (const dia of [1, 4]) {
      const material = materialDoCircuito(n);
      if (!material) continue;

      const licao = composeLesson({
        circuito: n,
        dia,
        material,
        livePrompt: "",
      });
      if (!licao.content.gated?.length) continue;

      const papel = licao.immersionScript ? "imersao" : "escuta";

      /**
       * SÓ o inglês travado — a tradução não é segredo.
       *
       * O portão existe para impedir que a grafia inglesa entre pelos olhos
       * antes de entrar pelo ouvido: é ela que gruda o fonema português nas
       * letras. O português do bloco não faz isso, e de fato o dia 2 já
       * apresenta a tradução sozinha, de propósito. Comparar contra o JSON
       * inteiro dos blocos travados acusava 36 lições por mostrarem "É minha
       * primeira vez nesta cidade" — que não é o que está trancado.
       */
      const ingles: string[] = [];
      for (const bloco of licao.content.gated) {
        if (bloco.type === "dialogue")
          ingles.push(...bloco.lines.map((l) => l.en));
        else if (bloco.type === "examples")
          ingles.push(...bloco.items.map((i) => i.en));
      }
      const travado =
        ingles.join(" | ") +
        " | " +
        (licao.immersionScript ?? "") +
        " | " +
        (licao.listeningScript ?? "");

      // Exatamente a função que a página aplica. Conferir a poda de verdade,
      // e não uma cópia dela, é o ponto: uma segunda implementação aqui
      // passaria a valer enquanto a da página divergisse em silêncio.
      const podada = semTextoTravado(
        {
          content: licao.content,
          chunks: licao.chunks,
          quiz: licao.quiz,
          immersion_script: licao.immersionScript,
          listening_script: licao.listeningScript,
        },
        papel,
      );

      // Todo texto que sobrou no payload, de qualquer profundidade.
      const sobrou: string[] = [];
      const varrer = (v: unknown) => {
        if (typeof v === "string") sobrou.push(v);
        else if (Array.isArray(v)) v.forEach(varrer);
        else if (v && typeof v === "object") Object.values(v).forEach(varrer);
      };
      varrer(podada);

      // Trechos curtos casam por acaso ("I'm", "Yes"); doze caracteres já
      // exigem uma expressão inteira para haver coincidência.
      const vazam = sobrou.filter((t) => t.length > 12 && travado.includes(t));
      if (vazam.length) {
        warn(
          `C${n} dia ${dia}: o payload podado ainda devolve ${vazam.length} trecho(s) travado(s) — "${vazam[0]}"`,
        );
      }
    }
  }
}

/**
 * Os 104 portões continuam legíveis, e cada um ainda cobra o que dá para medir.
 *
 * O parser já derruba o import quando algum deixa de casar. O que se confere
 * aqui é o outro lado: que o denominador citado na prosa bate com a rampa. Um
 * portão que pede "5 dos 8 blocos novos" num circuito que traz 9 é um portão
 * escrito contra uma versão antiga da rampa, e ninguém percebe pela leitura.
 */
function verificarPortoes() {
  if (PORTOES.length !== TOTAL_CIRCUITOS * 2) {
    warn(`portões: ${PORTOES.length} lidos, esperados ${TOTAL_CIRCUITOS * 2}`);
  }

  const nucleo = (blocos: number) => Math.min(10, Math.ceil(0.32 * blocos));

  for (let n = 1; n <= TOTAL_CIRCUITOS; n++) {
    const carga = cargaDe(n);
    if (!carga) continue;

    for (const trilha of ["complete", "essential"] as const) {
      const portao = portaoDe(n, trilha);
      if (!portao) {
        warn(`portão C${n} (${trilha}): não existe`);
        continue;
      }

      const novos = portao.componentes.find((c) => c.tipo === "novos");
      if (novos && novos.tipo === "novos") {
        const esperado =
          trilha === "essential"
            ? nucleo(carga.blocosNovos)
            : carga.blocosNovos;
        if (novos.de !== esperado) {
          warn(
            `portão C${n} (${trilha}): cobra sobre ${novos.de} blocos, a rampa traz ${esperado}`,
          );
        }
      }

      const defasado = portao.componentes.find((c) => c.tipo === "defasado");
      if (defasado && defasado.tipo === "defasado" && defasado.circuito >= n) {
        // Domínio só é cobrado de circuito anterior, com 28 dias de folga: o
        // motor SM-2 leva no mínimo 22 dias até `repetitions >= 4`, e o
        // circuito tem 14. Cobrar do próprio circuito é porta trancada por
        // construção — nem um aluno perfeito passa.
        warn(
          `portão C${n} (${trilha}): cobra domínio do circuito ${defasado.circuito}, que não é anterior`,
        );
      }
    }
  }
}

/**
 * O banco e a espinha concordam sobre quantas escutas destravam o texto.
 *
 * `EXPOSICAO.escutasPorCanto` é 4/3/2/2. `public.required_plays` repete esses
 * números como literal em SQL, porque a decisão precisa ser do servidor: se ela
 * viesse do cliente, o portão seria um parâmetro que qualquer um edita. Duas
 * cópias, então, e esta função existe para elas nunca andarem separadas.
 */
function verificarEscutasDoBanco() {
  const arquivo = join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260101001400_espinha.sql",
  );

  let sql: string;
  try {
    sql = readFileSync(arquivo, "utf8");
  } catch {
    warn("escutas: migration 20260101001400_espinha.sql não foi encontrada");
    return;
  }

  const corpo =
    /create or replace function public\.required_plays[\s\S]*?\$\$([\s\S]*?)\$\$/.exec(
      sql,
    )?.[1];
  if (!corpo) {
    warn("escutas: não achei o corpo de public.required_plays na migration");
    return;
  }

  const degraus = [...corpo.matchAll(/<=\s*(\d+)\s*then\s*(\d+)/g)].map(
    (m) => ({
      ate: Number(m[1]),
      escutas: Number(m[2]),
    }),
  );
  const resto = Number(/else\s+(\d+)/.exec(corpo)?.[1] ?? NaN);

  if (!degraus.length || !Number.isFinite(resto)) {
    warn("escutas: o corpo de public.required_plays deixou de ser legível");
    return;
  }

  const doBanco = (n: number) =>
    degraus.find((d) => n <= d.ate)?.escutas ?? resto;

  for (let n = 1; n <= TOTAL_CIRCUITOS; n++) {
    if (doBanco(n) !== escutasExigidas(n)) {
      warn(
        `escutas C${n}: o banco exige ${doBanco(n)}, orcamento.json exige ${escutasExigidas(n)}`,
      );
    }
  }

  if (EXPOSICAO.escutasPorCanto.length !== 4) {
    warn(
      `escutas: orcamento.json declara ${EXPOSICAO.escutasPorCanto.length} cantos, não 4`,
    );
  }
}

function main() {
  // ------------------------------------------------ a espinha e o material
  //
  // Cada camada é escrita por um gerador diferente e num momento diferente. As
  // checagens abaixo pegam o que a revisão humana deixa passar: circuito sem
  // material, bloco que o aluno não reencontra no diálogo, formato que quebra
  // o player, e texto que quebra as regras de escrita do curso.
  for (const circuit of CIRCUITS) {
    const onde = `circuito ${circuit.number} (${circuit.title})`;
    const carga = cargaDe(circuit.number)!;
    const material = materialDoCircuito(circuit.number);

    const consolidacao = ehConsolidacao(circuit.number);

    if (!material) {
      warn(
        consolidacao
          ? `${onde}: circuito de consolidação sem canto para revisitar — os circuitos anteriores estão vazios`
          : `${onde}: sem blocos escritos — rode gen:blocos --circuito ${circuit.number}`,
      );
      continue;
    }

    // O circuito de consolidação não escreve bloco: ele revisita o canto. Medir
    // o que ele revisita contra `blocosNovos: 0` acusaria erro em todo circuito
    // que está exatamente certo.
    if (!consolidacao && material.blocos.length !== carga.blocosNovos) {
      warn(
        `${onde}: ${material.blocos.length} blocos, e a rampa pede ${carga.blocosNovos}`,
      );
    }

    if (!material.imersao.length || !material.escuta.length) {
      warn(
        `${onde}: sem diálogo — rode gen:dialogos --circuito ${circuit.number}`,
      );
    }

    // A barra é o separador do roteiro; dentro da fala ela quebra o parser e a
    // voz troca no meio da frase.
    for (const [quem, en, pt] of [...material.imersao, ...material.escuta]) {
      if (en.includes("/"))
        warn(`${onde}: fala de ${quem} contém "/": quebra o roteiro`);
      if (!en.trim()) warn(`${onde}: fala vazia de ${quem}`);
      if (!pt.trim()) warn(`${onde}: fala de ${quem} sem tradução`);
    }

    // Âncoras: quantos blocos treinados aparecem de fato no diálogo. É a
    // checagem que pegou o defeito do curso anterior — o circuito 1 tinha dois
    // minutos de áudio e nenhum dos blocos dos dias 1 a 7. Sem âncora o áudio
    // deixa de ser degrau e vira muro.
    if (material.imersao.length && material.blocos.length) {
      const texto = [...material.imersao, ...material.escuta]
        .map(([, en]) => en)
        .join(" ");
      const ancoras = chunksSpokenIn(texto, material.blocos).length;
      const exigido = ancorasExigidas(
        circuit.number,
        material.blocos.length,
        material.imersao.length + material.escuta.length,
      );
      if (ancoras < exigido) {
        warn(
          `${onde}: só ${ancoras} dos ${material.blocos.length} blocos aparecem nos diálogos ` +
            `(mínimo ${exigido}) — o aluno não tem onde se segurar`,
        );
      }
    }

    // O `evita` da peça de gramática é o campo perigoso: a tela o mostra
    // RISCADO e sem markdown. Se a correção vier junto, o aluno lê a forma
    // certa tachada como errada, dentro de uma nota de gramática.
    const g = gramaticaDe(circuit.number);
    if (g && !ehRespiro(g)) {
      const ondeG = `${onde} · gramática`;
      if (!g.corpo) {
        warn(`${ondeG}: peça "${g.peca}" sem texto redigido`);
      } else {
        const palavras = g.corpo.trim().split(/\s+/).length;
        if (palavras > 110)
          warn(`${ondeG}: corpo com ${palavras} palavras (teto 110)`);
        if (/[*_#]/.test(g.corpo)) warn(`${ondeG}: corpo com markdown`);
      }
      if ((g.exemplos?.length ?? 0) < 2) warn(`${ondeG}: menos de 2 exemplos`);
      if (!g.evita?.trim()) {
        warn(`${ondeG}: sem a frase errada`);
      } else {
        if (/[*_«»]/.test(g.evita))
          warn(`${ondeG}: "evita" tem markdown — sai literal na tela`);
        if (/\bo certo é\b|\bcorreto\b|\bem vez de\b|→/i.test(g.evita))
          warn(
            `${ondeG}: "evita" traz a correção — ela sairia RISCADA. Só o erro aqui`,
          );
        if (g.evita.split(/\s+/).length > 14)
          warn(
            `${ondeG}: "evita" com ${g.evita.split(/\s+/).length} palavras — é uma frase só`,
          );
      }
    }

    // Som e falso cognato não podem faltar: são as duas camadas mais
    // especificamente brasileiras do curso.
    if (!somDe(circuit.number)) warn(`${onde}: sem degrau de fonologia`);
    if (!cognatosDe(circuit.number).length) warn(`${onde}: sem falso cognato`);
  }

  // ------------------------------------------------ o bloco que se apresenta
  //
  // O bloco onde alguém diz o próprio nome tem que sair com a voz do gênero
  // daquele nome. A narradora fixa dizia "Hi, I'm Alex." com voz de mulher —
  // logo no primeiro bloco do curso, um homem se apresentando com voz feminina.
  //
  // Isto confere que todo nome que aparece num "I'm X" está na tabela de
  // gênero: nome novo que entre num bloco e não esteja lá volta a cair na
  // narradora em silêncio, que é como o defeito nasceu.
  {
    const seApresenta = /\b(?:I'm|I am|my name is|this is)\s+([A-Z][a-z]+)/;
    for (const job of audioJobs()) {
      if (job.kind !== "chunk") continue;
      const nome = seApresenta.exec(job.text)?.[1];
      if (!nome) continue;
      if (
        chunkVoice(job.text, "gemini") === narratorVoice("gemini") &&
        !isCast(nome)
      ) {
        warn(
          `áudio "${job.text}": "${nome}" se apresenta e não tem gênero declarado — ` +
            `sai na voz da narradora`,
        );
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
          warn(
            `${where}: "${who}" não está no elenco de content/audio-manifest.ts`,
          );
        }
      }

      // Duas pessoas na mesma voz: o Gemini recusa o pedido, e no Piper o
      // aluno deixa de separar os turnos da conversa.
      const used = new Map<string, string>();
      for (const who of job.speakers) {
        const voice = voiceFor(who, engine);
        const taken = used.get(voice);
        if (taken)
          warn(`${where}: "${who}" e "${taken}" dividem a voz ${voice}`);
        else used.set(voice, who);
      }

      // O que de fato vai para o TTS, fala a fala: pega divergência entre o
      // elenco e o desempate de `voicePairFor`.
      if (
        new Set(spokenLines(job, engine).map((l) => l.voice)).size !==
        job.speakers.length
      ) {
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
    const material = materialDoCircuito(circuit.number);
    // Circuito sem blocos ainda não é lição: o gerador chega nele depois.
    if (!material) continue;
    const day = DAY_RHYTHM.find((d) => d.day === spec.circuitDay)!;
    const canto = CANTOS.find(
      (c) => circuit.number >= c.weekStart && circuit.number <= c.weekEnd,
    )!;

    const lesson = composeLesson({
      circuito: circuit.number,
      dia: spec.circuitDay,
      material,
      livePrompt: livePromptFor(circuit),
    });

    const where = `dia ${spec.dayNumber} (circuito ${spec.circuitNumber}, dia ${spec.circuitDay})`;
    const blocks =
      (lesson.content.blocks?.length ?? 0) +
      (lesson.content.gated?.length ?? 0);

    if (!blocks) warn(`${where}: nenhum bloco de conteúdo`);
    if (!lesson.content.warmup?.trim()) warn(`${where}: sem aquecimento`);
    if (!lesson.content.summary?.trim()) warn(`${where}: sem resumo`);
    if (!lesson.speakingPrompt.trim()) warn(`${where}: sem tarefa de fala`);
    if (spec.circuitDay === 1 && !lesson.immersionScript)
      warn(`${where}: dia 1 sem áudio de imersão`);
    if (spec.circuitDay === 1 && !lesson.content.gated?.length) {
      warn(`${where}: dia 1 sem blocos atrás do portão de imersão`);
    }
    // O portão só vale se a transcrição NÃO estiver nos blocos abertos — e ele
    // só existe no dia 1. O dia 9 é shadowing: ali o aluno fala JUNTO com o
    // áudio, então o texto tem que estar na tela, e a checagem acusava os 52
    // circuitos de vazamento por fazer exatamente o que o exercício pede.
    if (lesson.immersionScript && spec.circuitDay === 1) {
      const openText = JSON.stringify(lesson.content.blocks ?? []);
      const firstLine = material.imersao[0]?.[1] ?? "";
      if (firstLine && openText.includes(firstLine)) {
        warn(
          `${where}: a fala "${firstLine.slice(0, 30)}" vazou para fora do portão de imersão`,
        );
      }
    }

    for (const question of lesson.quiz) {
      if (question.options.length !== 4) {
        warn(
          `${where}: questão "${question.id}" tem ${question.options.length} alternativas`,
        );
      }
      if (
        question.answerIndex < 0 ||
        question.answerIndex >= question.options.length
      ) {
        warn(
          `${where}: questão "${question.id}" aponta para alternativa inexistente`,
        );
      }
      if (new Set(question.options).size !== question.options.length) {
        warn(
          `${where}: questão "${question.id}" tem alternativa repetida: a "certa" fica ambígua`,
        );
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

  // ------------------------------------------------------- portões e escutas
  //
  // Duas regras do método vivem em DOIS lugares cada uma, e as duas cópias
  // divergem em silêncio: o portão de cada circuito está escrito em prosa em
  // `rampa.json` e é lido por regex em `portoes.ts`; quantas escutas o circuito
  // exige está em `orcamento.json` e de novo, como literal, dentro de
  // `public.required_plays` na migration 1400. Divergir aqui não gera erro em
  // lugar nenhum: gera um portão que ninguém passa, ou um portão que abre sem
  // escuta. É por isso que a conferência mora no verificador e não num
  // comentário.
  verificarPortoes();
  verificarEscutasDoBanco();
  verificarVazamentoDoPortao();

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
    // Agrupar antes de listar. A versão anterior imprimia os 40 primeiros
    // problemas e escondia o resto — com 747, isso mostrava vinte "sem resumo"
    // do circuito 1 e escondia as outras seis classes inteiras. Contar por
    // classe diz quantos defeitos DIFERENTES existem, que é o número que
    // decide o que consertar primeiro.
    const classes = new Map<string, string[]>();
    for (const p of problems) {
      const chave = p
        .replace(/^.*?: /, "")
        .replace(/"[^"]*"/g, '"…"')
        .replace(/\d+/g, "N");
      const lista = classes.get(chave) ?? [];
      lista.push(p);
      classes.set(chave, lista);
    }

    const ordenadas = [...classes.entries()].sort(
      (a, b) => b[1].length - a[1].length,
    );
    console.error(
      `✗ ${problems.length} problema(s) em ${ordenadas.length} classe(s):\n`,
    );

    for (const [chave, exemplos] of ordenadas) {
      console.error(
        `  \x1b[1m${String(exemplos.length).padStart(4)}×\x1b[0m ${chave}`,
      );
      for (const e of exemplos.slice(0, 3)) console.error(`         ${e}`);
      if (exemplos.length > 3)
        console.error(`         … e mais ${exemplos.length - 3}`);
      console.error("");
    }
    process.exit(1);
  }

  console.log("✓ Nenhum problema. O curso está íntegro.\n");
}

main();
