/**
 * Repetição espaçada por bloco (chunk).
 *
 * Implementa SM-2 com duas adaptações para fala:
 *
 *   1. A nota não vem de um botão "eu lembrei". Vem do desempenho real:
 *      da nota da tutora quando o aluno FALOU o bloco, ou do acerto na
 *      recuperação ativa. Autoavaliação infla: desempenho medido, não.
 *
 *   2. Reconhecer não é o mesmo que produzir. `spoken_count` conta quantas
 *      vezes o aluno de fato disse o bloco em voz alta; um bloco só é
 *      considerado dominado depois de produzido, não só revisado.
 *
 * O cálculo de agenda vive no banco (função `review_chunk`) para que qualquer
 * cliente: app, script, futura API: use exatamente a mesma regra.
 */

import type { StudyTrack } from "@/lib/types/database";

export interface ChunkMastery {
  id: string;
  user_id: string;
  course_id: string;
  circuit_number: number;
  chunk_key: string;
  chunk_en: string;
  chunk_pt: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  due_date: string;
  last_grade: number | null;
  last_reviewed_at: string | null;
  spoken_count: number;
  /** Bloco do NÚCLEO: o baralho reduzido que a trilha Essencial estuda. */
  is_core: boolean;
  /**
   * Acertos seguidos desde o último lapso. Aos 3, `review_chunk` apaga um lapso.
   *
   * É a coluna que faz `lapses` DESCER. Sem ela o contador era monotônico e
   * "travado" era condenação permanente: o bloco que o aluno já tinha
   * recuperado continuava vermelho na tela até o fim do curso.
   */
  correct_streak: number;
  /**
   * Sanguessuga: 8 lapsos tiraram o bloco da agenda.
   *
   * Ele continua sendo ensinado pela lição — sai da fila, não do curso. Um
   * bloco que falhou oito vezes consome revisão que os outros 1.192 precisam,
   * e mais uma passada dele não resolve.
   */
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Identidade estável de um bloco.
 *
 * PRECISA produzir exatamente o mesmo slug que `enroll_circuit_chunks` no SQL
 * (migration 20260101000500): é essa chave que liga o que o aluno falou ao
 * item da agenda dele. Se as duas divergirem, `mark_chunks_spoken` não casa
 * nada e o contador de produção falada fica em zero sem erro nenhum.
 */
export function chunkKey(en: string): string {
  return en
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Normaliza para comparar fala transcrita com o bloco escrito. */
function normalizeSpoken(text: string) {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Quais blocos do circuito o aluno REALMENTE falou numa gravação.
 *
 * O SRS só promove um bloco a "dominado" depois de produzido em voz alta, e
 * essa é a única evidência honesta disso que temos: a transcrição do que saiu
 * da boca dele, não a de o que ele deveria ter dito. Por isso a comparação é
 * contra `transcript` e nunca contra `corrected_text`.
 *
 * Mora aqui, e não na rota, porque a regra precisa ser executável fora do Next:
 * é ela que revela se trocar o modelo de transcrição muda o que o aluno recebe
 * como "dominado" — uma quebra que não gera erro nenhum.
 */
export function chunksSpokenIn(transcript: string, chunks: { en: string }[]): string[] {
  const said = normalizeSpoken(transcript);
  if (!said) return [];

  return chunks
    .filter((chunk) => {
      // A parte fixa do molde é o que importa; o "___" é a peça que varia.
      const core = normalizeSpoken(chunk.en.replace(/_+/g, " "));
      if (core.length < 6) return false;
      return said.includes(core);
    })
    .map((chunk) => chunkKey(chunk.en));
}

/**
 * Converte a nota 0-10 da tutora na escala 0-5 do SM-2, RELATIVA ao piso que o
 * circuito espera.
 *
 * O piso é o ponto onde a nota vale 4, que é o degrau NEUTRO do SM-2: quem
 * entrega exatamente o que o circuito pede não sobe nem desce o `ease_factor`.
 * O default 6,0 é o piso que os 15 portões com nota de fala citam, e nenhum
 * deles desce abaixo disso.
 *
 * A escala era absoluta, com o mesmo corte para o curso inteiro: 7,5 para o 4,
 * 6,0 para o 3, e lapso abaixo disso. O iniciante passa meses abaixo de 7,5 e
 * era medido contra um número que o circuito 3 nem esperava dele — por isso
 * nenhum portão antes do C27 podia citar nota de fala.
 *
 * O QUE MUDA DE FATO EM PRODUÇÃO, e não é o que a versão anterior deste
 * comentário dizia: o caminho da gravação nunca chegou a fabricar lapso, porque
 * ele passa por `gradeFromSpokenChunk`, que já tinha o piso de 3. O que muda é
 * o degrau de cima — um turno entre o piso e 75% do caminho até 10 passa a
 * gravar 4 (neutro) onde gravava 3 (−0,14 de `ease_factor`). Ou seja: quem
 * entrega o que o circuito pede para de perder facilidade por isso. Com piso
 * 6,0 isso é a faixa de 6,0 a 9,0, que antes valia 3 ou 4 conforme o 7,5.
 *
 * As faixas são as mesmas de sempre, medidas em proporção do piso em vez de em
 * pontos fixos: acima do piso o 5 entra a 75% do caminho até 10, o que com piso
 * 6,0 dá exatamente os 9,0 de antes; abaixo, o piso é dividido em quatro para
 * 3, 2, 1 e 0 continuarem descendo até o zero.
 */
export function gradeFromScore(score0to10: number, pisoDoCircuito = 6.0): number {
  // O piso entra em [1, 10]. Abaixo de 1 as quatro faixas de baixo colapsam
  // em zero e QUALQUER nota, inclusive 0,0, devolveria 3 — o motor pararia de
  // registrar lapso para sempre. Acima de 10 a faixa do 5 fica vazia e nota
  // perfeita devolveria 4. Nenhum portão declara um piso assim; o clamp existe
  // porque o argumento é opcional e chega de fora desta função.
  const piso = Math.min(10, Math.max(1, pisoDoCircuito));

  if (score0to10 >= piso + (10 - piso) * 0.75) return 5;
  if (score0to10 >= piso) return 4;
  if (score0to10 >= piso * 0.75) return 3;
  if (score0to10 >= piso * 0.5) return 2;
  if (score0to10 >= piso * 0.25) return 1;
  return 0;
}

/**
 * Nota do SM-2 para um bloco que o aluno FALOU numa gravação.
 *
 * Não é `gradeFromScore` crua, e a diferença decide se o curso funciona para
 * iniciante. Duas razões:
 *
 * A nota da tutora é do TURNO INTEIRO — pronúncia, fluência, gramática,
 * vocabulário e tarefa somados. O bloco é um pedaço daquele turno. Usar a nota
 * do turno para agendar o bloco pune um bloco dito perfeitamente porque o resto
 * da resposta saiu torto.
 *
 * E `chunksSpokenIn` só casa um bloco quando ele aparece na transcrição: o
 * aluno puxou o bloco da memória e produziu de forma reconhecível. Em SM-2 isso
 * é recuperação bem-sucedida, e recuperação bem-sucedida é nota 3 no mínimo.
 * Se a pronúncia tivesse saído irreconhecível, o bloco simplesmente não casaria
 * — o casamento já É o teste, e falhar nele não gera revisão nenhuma.
 *
 * O piso do circuito protege a NOTA; este `Math.max` protege o BLOCO, e são
 * coisas diferentes: o piso trata o aluno que ainda está no começo, o `max`
 * trata o turno em que ele acertou o bloco e errou o resto. Medido nas
 * gravações reais do banco, 26% delas virariam lapso sem ele.
 *
 * A nota do turno continua modulando a qualidade (3, 4 ou 5), que é o que
 * alimenta o `ease_factor`. Ela só não fabrica mais lapso.
 */
export function gradeFromSpokenChunk(score0to10: number, pisoDoCircuito?: number): number {
  return Math.max(3, gradeFromScore(score0to10, pisoDoCircuito));
}

/**
 * Nota a partir de uma recuperação ativa (saiu na hora / hesitei / não lembrei).
 *
 * "Hesitei" vale 4, e o 4 não é arbitrário: é o degrau NEUTRO do SM-2. O motor
 * move o `ease_factor` por `0,10 - (5-nota) * (0,08 + (5-nota) * 0,02)`, e essa
 * conta dá exatamente zero na nota 4. Nota 5 sobe 0,10; nota 3 DERRUBA 0,14.
 *
 * A fila oferece três botões, e "hesitei" é a resposta honesta mais comum de
 * quem está aprendendo. Mapeada em 3, ela cobrava 0,14 de ease a cada revisão
 * acertada. Com uma distribuição realista de 55/33/12 a esperança era de
 * −0,056 por revisão: o ease só descia, virava catraca de mão única, e em
 * cerca de 40 revisões batia no piso de 1,30. Como `isMastered` exige
 * `ease_factor >= 2,3`, "dominado" era inalcançável — o aluno que revisava
 * todo dia empurrava os próprios blocos para "Travado".
 *
 * É a semântica clássica de três botões: fácil sobe, acertei segura, errei
 * reinicia. Quem acerta não pode ser punido por ter demorado um segundo.
 */
export function gradeFromRecall(result: "instant" | "hesitant" | "failed"): number {
  return result === "instant" ? 5 : result === "hesitant" ? 4 : 1;
}

/**
 * A régua única de "dominado". Espelha `public.is_mastered` do SQL, argumento
 * por argumento.
 *
 * Havia três réguas para a mesma palavra: esta função pedia `repetitions >= 4
 * and ease >= 2,3 and spoken_count >= 2`; a view `chunk_review_queue` pedia
 * `repetitions >= 3 and ease >= 2,3` e ignorava a fala; e os 52 portões pediam
 * uma terceira coisa. O app lê a view para os agregados e esta função para o
 * selo do bloco, então o mesmo bloco aparecia dominado num número e não no
 * outro, dentro da mesma sessão.
 *
 * A Essencial não cobra produção falada porque não grava: os 48 portões dela
 * dizem isso por extenso. Não é régua mais frouxa, é a régua do que a trilha
 * mede.
 *
 * A cópia em TypeScript existe para a tela não ir ao banco só para desenhar um
 * selo. Mexer aqui sem mexer na função SQL recria exatamente a divergência
 * descrita acima.
 */
export function isMastered(
  chunk: Pick<ChunkMastery, "repetitions" | "ease_factor" | "spoken_count">,
  track: StudyTrack = "complete",
): boolean {
  return (
    chunk.repetitions >= 4 &&
    chunk.ease_factor >= 2.3 &&
    (track === "essential" || chunk.spoken_count >= 2)
  );
}

export type MasteryStage =
  | "novo"
  | "aprendendo"
  | "consolidando"
  | "dominado"
  | "travado"
  | "suspenso";

/**
 * Estágio exibido ao aluno.
 *
 * "dominado" é `isMastered`, e nada mais: qualquer outra conta aqui volta a
 * fazer a tela discordar da view e dos portões.
 *
 * "suspenso" vem antes de "travado" porque um bloco suspenso tem 8 lapsos e
 * cairia em "travado" pela linha seguinte. São coisas diferentes: o travado
 * ainda é cartão, o suspenso saiu da fila e continua sendo ensinado pela lição.
 *
 * "travado" continua sendo `lapses >= 3 && ease < 2,0`, mas deixou de ser
 * condenação permanente: `review_chunk` apaga um lapso a cada 3 acertos
 * seguidos, então o rótulo sai sozinho quando o aluno volta a acertar. Enquanto
 * `lapses` só subia, o bloco já recuperado ficava vermelho até o fim do curso —
 * e era por isso que nenhum dos 52 portões usava lapso como critério.
 */
export function masteryStage(chunk: ChunkMastery, track: StudyTrack = "complete"): MasteryStage {
  if (chunk.suspended_at) return "suspenso";
  if (chunk.lapses >= 3 && chunk.ease_factor < 2.0) return "travado";
  if (chunk.repetitions === 0) return "novo";
  if (isMastered(chunk, track)) return "dominado";
  if (chunk.repetitions >= 2) return "consolidando";
  return "aprendendo";
}

export const STAGE_LABEL: Record<MasteryStage, string> = {
  novo: "Novo",
  aprendendo: "Aprendendo",
  consolidando: "Consolidando",
  dominado: "Dominado",
  travado: "Travado",
  suspenso: "Fora da fila",
};

export const STAGE_TONE: Record<MasteryStage, "neutral" | "warning" | "default" | "success" | "destructive"> = {
  novo: "neutral",
  aprendendo: "warning",
  consolidando: "default",
  dominado: "success",
  travado: "destructive",
  // Neutro de propósito: sair da fila não é castigo nem fracasso do aluno, é o
  // sistema parando de cobrar um cartão que só fabricava lapso.
  suspenso: "neutral",
};

/**
 * Ordena a fila de revisão do dia.
 *
 * Prioridade: os atrasados primeiro, depois os mais antigos por vencimento,
 * depois os que nunca foram falados em voz alta.
 *
 * Os travados NÃO vêm mais na frente, e duas coisas mudaram embaixo daquela
 * regra. O critério era `lapses >= 3`, e um bloco suspenso tem 8: a fila abria
 * com exatamente os blocos que já tinham saído dela. E `lapses` deixou de ser
 * monotônico — 3 acertos seguidos apagam um —, então o número não diz mais
 * "está esquecendo agora", diz "já esqueceu alguma vez". Com o teto diário, pôr
 * os mais difíceis na frente entregava a sessão inteira às sanguessugas, e os
 * blocos do circuito corrente não recebiam revisão nenhuma.
 */
export function sortReviewQueue(chunks: ChunkMastery[]): ChunkMastery[] {
  return [...chunks].sort((a, b) => {
    // Só duas regras, e as duas fazem alguma coisa.
    //
    // Havia uma terceira na frente: "atrasados primeiro", comparando `due_date`
    // com o hoje calculado aqui dentro. Ela era inócua por construção — a lista
    // chega filtrada por `due_date <= hoje`, então ordenar por vencimento
    // ascendente já põe o mais atrasado na frente, e o teste extra nunca
    // trocava a ordem de nada. Pior: ele montava o "hoje" em UTC enquanto o
    // resto do fluxo passou a usar o fuso do aluno, então a única coisa que
    // aquela linha podia fazer era discordar.
    if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    // Empate no vencimento: primeiro o que nunca foi dito em voz alta.
    return a.spoken_count - b.spoken_count;
  });
}

/**
 * Quantos blocos o ORÇAMENTO da trilha paga por dia.
 * Cerca de 20 segundos por bloco, incluindo a fala em voz alta.
 *
 * Os minutos são os do movimento Memória — 3 na Essencial, 9 no Completo, 15 no
 * Intensivo —, nunca um número escrito na chamada. Quem aplica isso é
 * `tetoDiarioDaFila` em content/curriculum.ts: o teto do dia é o MENOR entre
 * esta conta e o desenho da rampa por canto.
 */
export function reviewBatchSize(minutes: number): number {
  return Math.max(5, Math.min(60, Math.round((minutes * 60) / 20)));
}

/** Prévia local do próximo intervalo: só para mostrar na UI antes de salvar. */
export function previewNextInterval(chunk: ChunkMastery, grade: number): number {
  const ef = Math.max(
    1.3,
    chunk.ease_factor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)),
  );
  if (grade < 3) return 1;
  const reps = chunk.repetitions + 1;
  if (reps === 1) return 1;
  if (reps === 2) return 6;
  return Math.max(1, Math.round(chunk.interval_days * ef));
}

export function formatInterval(days: number): string {
  if (days <= 1) return "amanhã";
  if (days < 30) return `em ${days} dias`;
  const months = Math.round(days / 30);
  return months <= 1 ? "em 1 mês" : `em ${months} meses`;
}
