/**
 * Currículo do curso "Inglês Destravado: 4 Cantos".
 *
 * ===========================================================================
 * O MÉTODO
 * ===========================================================================
 * A unidade de aprendizado NÃO é a regra gramatical. É o CHUNK: um bloco de
 * fala pronto, memorizado inteiro e reaproveitado trocando peças.
 *
 * Ninguém aprende a falar montando frases a partir de tabelas de conjugação.
 * Aprende repetindo blocos até eles saírem sem pensar: que é como a criança
 * aprende e como o cérebro adulto também aprende quando você para de atrapalhar.
 *
 * Cinco regras que organizam tudo:
 *
 *   1. SITUAÇÃO ANTES DE REGRA. Cada semana é uma cena real (pedir um café,
 *      se apresentar numa reunião, resolver um problema no hotel): nunca
 *      "verbo to be" ou "present perfect".
 *
 *   2. BLOCO ANTES DE PALAVRA. O aluno decora "Can I have a coffee, please?"
 *      inteiro. Depois troca a peça: coffee -> water -> the check.
 *
 *   3. OUVIR ANTES DE LER. O dia 1 de cada circuito é áudio puro, sem texto.
 *      O cérebro precisa ouvir o som antes de ver a grafia, senão a leitura
 *      contamina a pronúncia com o português.
 *
 *   4. REVISÃO ESPAÇADA. O dia 6 sempre retoma os circuitos de 1, 2 e 4
 *      semanas atrás. É o que transfere o bloco da memória de curto prazo
 *      para o automatismo.
 *
 *   5. GRAMÁTICA É NOTA DE RODAPÉ. Aparece só no dia 3, curta, com o título
 *      "por que funciona assim", e sempre DEPOIS de o aluno já usar o bloco.
 *      Nunca titula uma lição. Nunca é o organizador de nada.
 *
 * ===========================================================================
 * A ESTRUTURA
 * ===========================================================================
 *   4 CANTOS  x  13 CIRCUITOS  =  52 circuitos
 *   1 circuito = 2 SEMANAS = 14 dias
 *   52 x 14 = 728 dias (2 anos)
 *
 *   FASE A (dias 1-7): aquisição: conhecer, colocar na boca, produzir
 *   FASE B (dias 8-14): consolidação: input real, shadowing, conversa ao
 *                          vivo, escuta acelerada e aplicação sem roteiro
 *
 * Por que 2 semanas por circuito? Porque 15 min x 365 dias = 91 horas, e
 * 91 horas não levam ninguém a conversar sobre qualquer assunto com um
 * nativo. As estimativas sérias colocam B2 na casa das 600-700 horas.
 * A fase B é onde as horas viram fluência de verdade.
 *
 * ===========================================================================
 * AS TRILHAS
 * ===========================================================================
 * O conteúdo é o mesmo para todo mundo. O que muda é quanto se faz por dia: * e a meta prometida muda junto, honestamente.
 *
 *   Essencial   20 min/dia    243h   ->  A2   "você se vira sozinho"
 *   Completo    60 min/dia    728h   ->  B2   "você conversa sobre qualquer
 *                                              assunto, sem o outro desacelerar"
 *   Intensivo  100 min/dia   1213h   ->  C1   "você discute e trabalha em inglês"
 *
 * Este arquivo é a FONTE DA VERDADE. `scripts/seed-curriculum.ts` cria os
 * cantos, circuitos e lições a partir daqui; `scripts/generate-lessons.ts`
 * usa cada circuito como briefing para o Gemini redigir os 14 dias.
 */

import blocosJson from "./metodo/blocos.json";
import moldeJson from "./metodo/molde.json";
import { orcamentoDa, PROGRESSAO } from "./metodo";

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1";

/** Valores do enum `lesson_kind` no banco: reaproveitados para os 7 papéis. */
export type LessonKind =
  | "vocabulary"
  | "grammar"
  | "listening"
  | "speaking"
  | "dialogue"
  | "review"
  | "assessment";

export interface CantoSpec {
  code: string;
  position: number;
  title: string;
  subtitle: string;
  description: string;
  level: CefrLevel;
  weekStart: number;
  weekEnd: number;
  objectives: string[];
  canDo: string[];
}

export interface Chunk {
  /** O bloco pronto, exatamente como se fala. */
  en: string;
  pt: string;
  /** Quando usar: o gatilho de memória. */
  when?: string;
}

export interface CircuitSpec {
  /** 1 a 52. */
  number: number;
  title: string;
  /** A cena concreta. É isto que substitui o "tema gramatical". */
  situation: string;
  /** O molde da semana: a parte fixa que aceita troca de peças. */
  pattern: string;
  patternNote: string;
  /** 6 a 8 blocos prontos. O coração do circuito. */
  chunks: Chunk[];
  /** Tarefa no mundo real, no dia 7. */
  mission: string;
  /** Trilha de mentalidade: hábito, vergonha de falar, consistência. */
  mindset: string;
  /** Erro típico de brasileiro que este circuito ataca. */
  pitfall: string;
}

export type StudyTrack = "essential" | "complete" | "intensive";

export interface TrackSpec {
  id: StudyTrack;
  label: string;
  dailyMinutes: number;
  totalHours: number;
  cefr: CefrLevel;
  promise: string;
  /** O que a trilha NÃO entrega. Vai na UI junto com a promessa. */
  honestLimit: string;
  /** Quais blocos do dia essa trilha inclui. */
  blocks: DayBlockId[];
}

export type DayBlockId = "core" | "listening" | "speaking" | "srs" | "authentic";

/**
 * Os quatro movimentos de uma trilha, com os minutos que ela promete.
 *
 * Mora aqui, e nao em `src/lib/learning.ts`, porque a pagina inicial precisa
 * disto e `learning.ts` e `server-only` com o Supabase junto: importar aquilo
 * na landing arrastaria o cliente de banco para uma pagina estatica.
 *
 * A fonte e `content/metodo/orcamento.json`, onde os quatro movimentos somam
 * exatamente a promessa da trilha — 11+3+4+2=20, 33+9+12+6=60,
 * 55+15+20+10=100. A tabela `DAY_BLOCKS` abaixo tinha blocos fixos de 15
 * minutos e a Essencial somava 30 onde vendia 20: quem comprava vinte via
 * trinta em qualquer tela que somasse aquela lista.
 */
export function movimentosDaTrilha(id: StudyTrack) {
  const trilha = TRACKS.find((t) => t.id === id);
  const orc = trilha ? orcamentoDa(trilha.label) : null;
  if (!orc) return [];

  return [
    { id: "ouvido", label: "Ouvido", minutes: orc.ouvido,
      brief: "Input: diálogo, escuta e o áudio do circuito. A maior fatia, todo dia." },
    { id: "memoria", label: "Memória", minutes: orc.memoria,
      brief: "A sua fila de revisão, em voz alta, do português para o inglês." },
    { id: "boca", label: "Boca", minutes: orc.boca,
      brief: "Repetir colado ao áudio e gravar uma resposta sua." },
    { id: "som", label: "Som", minutes: orc.som,
      brief: "Um degrau da espinha de fonologia, com par mínimo e checagem." },
  ] as const;
}

export const DAY_BLOCKS: Record<DayBlockId, { label: string; minutes: number; brief: string }> = {
  core: {
    label: "Núcleo",
    minutes: 15,
    brief: "A lição do dia. Comum a todas as trilhas: é o que sustenta o hábito.",
  },
  listening: {
    label: "Escuta e shadowing",
    minutes: 15,
    brief: "Áudio do circuito em 3 velocidades + repetição sobreposta (shadowing).",
  },
  speaking: {
    label: "Produção falada",
    minutes: 15,
    brief: "Gravação corrigida pela tutora ou conversa ao vivo por voz.",
  },
  srs: {
    label: "Revisão espaçada",
    minutes: 15,
    brief: "Os blocos que venceram hoje na sua agenda individual. Só os seus.",
  },
  authentic: {
    label: "Input autêntico",
    minutes: 40,
    brief: "Material real do mundo: série, podcast, notícia: não material de curso.",
  },
};

/**
 * As três trilhas. Cada uma tem uma promessa E um limite honesto: é assim que
 * o aluno escolhe sabendo o que vai receber, em vez de desistir no mês 8.
 */
export const TRACKS: TrackSpec[] = [
  {
    id: "essential",
    label: "Essencial",
    dailyMinutes: 20,
    totalHours: 243,
    cefr: "A2",
    promise:
      "Você se vira sozinho no dia a dia: pedir, resolver, se apresentar, falar de você.",
    honestLimit:
      "Não é fluência. Numa roda de americanos falando rápido entre si, você ainda vai perder o fio.",
    blocks: ["core", "srs"],
  },
  {
    id: "complete",
    label: "Completo",
    dailyMinutes: 60,
    totalHours: 728,
    cefr: "B2",
    promise:
      "Você conversa sobre qualquer assunto com um nativo, sem ele precisar desacelerar por você.",
    honestLimit:
      "Ainda vai escapar gíria regional muito específica e humor de nicho: como escapa para qualquer estrangeiro.",
    blocks: ["core", "listening", "speaking", "srs"],
  },
  {
    id: "intensive",
    label: "Intensivo",
    dailyMinutes: 100,
    totalHours: 1213,
    cefr: "C1",
    promise:
      "Você discute, argumenta e trabalha em inglês com naturalidade, inclusive em grupo.",
    honestLimit:
      "Exige 1h40 por dia, todo dia. A maioria das pessoas não sustenta esse ritmo: e tudo bem.",
    blocks: ["core", "listening", "speaking", "srs", "authentic"],
  },
];

export const TRACK_BY_ID = new Map(TRACKS.map((t) => [t.id, t]));

export interface DayRole {
  /** 1..14 dentro do circuito. */
  day: number;
  phase: "A" | "B";
  kind: LessonKind;
  role: string;
  label: string;
  brief: string;
}

/**
 * Ritmo fixo de 14 dias. A previsibilidade é deliberada: o aluno não gasta
 * energia decidindo o que fazer, gasta falando.
 *
 * FASE A adquire. FASE B é onde o inglês sai do curso e entra no mundo.
 */
export const DAY_RHYTHM: DayRole[] = [
  // ---------------------------------------- FASE A: aquisição
  {
    day: 1,
    phase: "A",
    kind: "listening",
    role: "immersion",
    label: "Imersão",
    brief:
      "Áudio primeiro, sem texto. Ouve o diálogo da situação 3x antes de ver qualquer palavra escrita.",
  },
  {
    day: 2,
    phase: "A",
    kind: "vocabulary",
    role: "chunks",
    label: "Blocos na boca",
    brief: "Os blocos da semana, um a um, com áudio-modelo e repetição em voz alta.",
  },
  {
    day: 3,
    phase: "A",
    kind: "grammar",
    role: "swap",
    label: "Troca de peças",
    brief:
      "Substitution drill. Aqui: e só aqui: entra a nota curta 'por que funciona assim'.",
  },
  {
    day: 4,
    phase: "A",
    kind: "dialogue",
    role: "active-listening",
    label: "Escuta ativa",
    brief: "Diálogo novo, mesma situação, outra voz e velocidade real.",
  },
  {
    day: 5,
    phase: "A",
    kind: "speaking",
    role: "speaking",
    label: "Sua vez",
    brief: "Produção livre gravada. A tutora corrige pronúncia, naturalidade e uso dos blocos.",
  },
  {
    day: 6,
    phase: "A",
    kind: "review",
    role: "spaced",
    label: "Revisão espaçada",
    brief: "Os blocos que venceram na sua agenda individual. Recuperação ativa, sem consulta.",
  },
  {
    day: 7,
    phase: "A",
    kind: "assessment",
    role: "mission",
    label: "Missão real",
    brief: "Simulação completa + tarefa para usar no mundo real.",
  },

  // ---------------------------------------- FASE B: consolidação
  {
    day: 8,
    phase: "B",
    kind: "listening",
    role: "authentic",
    label: "Input autêntico",
    brief:
      "Material real do mundo: série, podcast, vídeo: não material de curso. Aqui o inglês para de ser didático.",
  },
  {
    day: 9,
    phase: "B",
    kind: "speaking",
    role: "shadowing",
    label: "Shadowing",
    brief:
      "Repetir POR CIMA do áudio, com meio segundo de atraso, sem parar. É o exercício que mais muda ritmo e sotaque.",
  },
  {
    day: 10,
    phase: "B",
    kind: "grammar",
    role: "expansion",
    label: "Expansão",
    brief:
      "O molde da fase A cruzado com circuitos anteriores. Frases longas, não frases novas.",
  },
  {
    day: 11,
    phase: "B",
    kind: "dialogue",
    role: "live",
    label: "Conversa ao vivo",
    brief:
      "Voz em tempo real com a tutora. Sem roteiro, sem pausa para pensar. É o treino que mais aproxima do real.",
  },
  {
    day: 12,
    phase: "B",
    kind: "listening",
    role: "fast",
    label: "Escuta acelerada",
    brief:
      "O mesmo áudio a 1,25x e 1,5x. Depois disso, a velocidade normal do nativo soa devagar.",
  },
  {
    day: 13,
    phase: "B",
    kind: "review",
    role: "interleaved",
    label: "Revisão intercalada",
    brief:
      "Blocos de circuitos aleatórios, misturados. Intercalar custa mais e fixa mais do que revisar em bloco.",
  },
  {
    day: 14,
    phase: "B",
    kind: "assessment",
    role: "free",
    label: "Sem roteiro",
    brief:
      "Conversa livre sobre a situação, mas o assunto deriva. Fecha o circuito com uso imprevisível.",
  },
];

export const DAYS_PER_CIRCUIT = DAY_RHYTHM.length;

export const CANTOS: CantoSpec[] = [
  {
    code: "C1",
    position: 1,
    title: "Primeiro Canto: Destravar",
    subtitle: "Semanas 1 a 13 · A1",
    description:
      "Você sai do zero falando. Nas primeiras semanas já são mais de 80 blocos prontos na boca: cumprimentar, se apresentar, pedir, agradecer, pedir para repetir. Nada de tabela de verbo: você fala primeiro e entende o porquê depois.",
    level: "A1",
    weekStart: 1,
    weekEnd: 13,
    objectives: [
      "Automatizar os 80 blocos que resolvem 80% das primeiras conversas",
      "Sobreviver a uma conversa sem entender tudo, sem travar",
      "Produzir os sons que o português não tem (TH, R, vogais curtas)",
      "Criar o hábito diário de 15 minutos falando em voz alta",
    ],
    canDo: [
      "Consigo me apresentar e puxar assunto sem ensaiar antes",
      "Consigo pedir o que quero em qualquer balcão",
      "Consigo pedir para repetirem sem congelar",
    ],
  },
  {
    code: "C2",
    position: 2,
    title: "Segundo Canto: Contar",
    subtitle: "Semanas 14 a 26 · A1→A2",
    description:
      "Conversa de verdade é contar coisas: o que você faz, o que fez, o que vai fazer. Aqui você ganha os blocos de narrativa e para de responder só 'yes' e 'no'.",
    level: "A2",
    weekStart: 14,
    weekEnd: 26,
    objectives: [
      "Contar o próprio dia, fim de semana e planos sem preparar antes",
      "Encadear frases com conectivos em vez de falar em blocos soltos",
      "Devolver a pergunta e manter a conversa viva",
      "Falar de passado e futuro sem parar para conjugar",
    ],
    canDo: [
      "Consigo contar uma história com começo, meio e fim",
      "Consigo falar dos meus planos e do meu passado",
      "Consigo manter uma conversa de 5 minutos sem travar",
    ],
  },
  {
    code: "C3",
    position: 3,
    title: "Terceiro Canto: Resolver",
    subtitle: "Semanas 27 a 39 · A2→B1",
    description:
      "O inglês que você precisa exatamente quando dá errado: reclamar, negociar, explicar um problema, pedir ajuda, discordar sem brigar. É onde a maioria dos cursos para e a vida real começa.",
    level: "B1",
    weekStart: 27,
    weekEnd: 39,
    objectives: [
      "Resolver problemas por telefone e presencialmente",
      "Reclamar com firmeza sem soar agressivo",
      "Dar opinião e discordar com educação",
      "Se virar em viagem, trabalho e imprevisto",
    ],
    canDo: [
      "Consigo resolver um problema de reserva ou cobrança",
      "Consigo defender meu ponto de vista",
      "Consigo pedir ajuda numa emergência",
    ],
  },
  {
    code: "C4",
    position: 4,
    title: "Quarto Canto: Soar natural",
    subtitle: "Semanas 40 a 52 · B1→B2",
    description:
      "A diferença entre 'falar inglês' e 'soar como quem fala inglês': fala conectada, phrasal verbs, reduções, ironia, registro. Aqui você para de traduzir e começa a pensar em inglês.",
    level: "B2",
    weekStart: 40,
    weekEnd: 52,
    objectives: [
      "Entender fala rápida com reduções e linking",
      "Usar phrasal verbs e colocações sem soar forçado",
      "Ajustar o registro entre formal e informal",
      "Sustentar conversa longa sem tradução mental",
    ],
    canDo: [
      "Consigo assistir série sem legenda na maior parte do tempo",
      "Consigo conduzir uma reunião em inglês",
      "Consigo conversar por 15 minutos sem travar",
    ],
  },
];

// ===========================================================================
// 52 CIRCUITOS: uma situação real por semana
// ===========================================================================

/** O molde, a nota e a mentalidade de cada circuito. */
const MOLDE_POR_N = new Map(
  (moldeJson as { n: number; molde: string; notaDoMolde: string; mentalidade: string }[]).map(
    (m) => [m.n, m],
  ),
);

/**
 * Os blocos base de cada circuito.
 *
 * `blocos.json` é escrito por `npm run gen:blocos` circuito a circuito, então
 * durante uma geração em andamento ele está legitimamente incompleto. Por isso
 * o acesso é tolerante e quem reclama é o verificador.
 */
const BLOCOS_POR_N = new Map(
  (
    blocosJson as {
      n: number;
      blocos: { en: string; pt: string; quando: string }[];
    }[]
  ).map((c) => [c.n, c]),
);

/**
 * Os 52 circuitos, montados a partir de `content/metodo/`.
 *
 * ===========================================================================
 * POR QUE ISTO DEIXOU DE SER ESCRITO A MÃO
 * ===========================================================================
 * Eram 1.185 linhas de dados digitados, com 7 blocos por circuito do 1 ao 52 —
 * uma reta perfeitamente plana onde deveria haver rampa. O aluno do dia 1 e o
 * do dia 700 recebiam a mesma dose, e os mesmos 7 blocos apareciam byte a byte
 * idênticos em 13 dos 14 dias do circuito.
 *
 * Agora cada campo vem da camada que tem autoridade sobre ele, e é lá que se
 * discute o mérito:
 *
 *   title, situation, mission, pitfall   progressao.json
 *   chunks                               blocos.json (só os blocos BASE)
 *   pattern, patternNote, mindset        molde.json
 *
 * O que NÃO entra em `chunks` é tão importante quanto o que entra: as famílias
 * de formas e as recombinações ficam em `blocos.json` e são consumidas na
 * composição da lição. Se elas entrassem aqui, `enroll_circuit_chunks` colocaria
 * doze mil itens na agenda de repetição espaçada em vez de mil e duzentos, e a
 * fila do aluno viraria uma dívida impagável. Uma forma é a CARA de um cartão,
 * não outro cartão.
 */
export const CIRCUITS: CircuitSpec[] = PROGRESSAO.map((prog) => {
  const molde = MOLDE_POR_N.get(prog.n);
  const base = BLOCOS_POR_N.get(prog.n);

  return {
    number: prog.n,
    title: prog.titulo,
    situation: prog.situacao,
    pattern: molde?.molde ?? prog.funcao,
    patternNote: molde?.notaDoMolde ?? "",
    // Vazio enquanto `gen:blocos` não tiver escrito este circuito. O verificador
    // reprova, e é ele quem deve avisar — não um erro no import, que derrubaria
    // até os scripts que existem justamente para consertar o buraco.
    chunks: (base?.blocos ?? []).map((b) => ({ en: b.en, pt: b.pt, when: b.quando })),
    mission: prog.missao,
    mindset: molde?.mentalidade ?? "",
    pitfall: prog.armadilha,
  };
});

// ===========================================================================
// Expansão em 728 dias
// ===========================================================================

export interface AuthenticInput {
  kind: "series" | "podcast" | "video" | "news" | "music" | "social";
  title: string;
  /** O que procurar: busca real, não link que pode quebrar. */
  search: string;
  why: string;
  minutes: number;
}

/**
 * Prescrição de input autêntico por nível.
 *
 * Não entregamos links: links quebram e material com direito autoral não é
 * nosso para distribuir. Entregamos o QUE procurar e POR QUE: que é a parte
 * que o aluno não sabe fazer sozinho.
 */
export function authenticInputFor(circuit: CircuitSpec, level: CefrLevel): AuthenticInput[] {
  const topic = circuit.title.toLowerCase();

  const byLevel: Record<CefrLevel, AuthenticInput[]> = {
    A1: [
      {
        kind: "video",
        title: "Vlog de rotina com legenda em inglês",
        search: `"day in my life" vlog slow english`,
        why: "Fala pausada, contexto visual forte. Você entende pelo contexto antes de entender pela palavra.",
        minutes: 10,
      },
      {
        kind: "series",
        title: "Sitcom com legenda em inglês",
        search: "Friends / Brooklyn Nine-Nine: 1 cena de 3 minutos",
        why: `Cenas curtas e situacionais. Procure uma que envolva "${topic}".`,
        minutes: 10,
      },
    ],
    A2: [
      {
        kind: "podcast",
        title: "Podcast para aprendizes, velocidade média",
        search: "english podcast for intermediate learners",
        why: "Fala natural mas ainda articulada. A ponte entre material didático e conteúdo real.",
        minutes: 15,
      },
      {
        kind: "series",
        title: "Episódio com legenda em inglês",
        search: `cena de série sobre ${topic}`,
        why: "Você já tem blocos suficientes para reconhecer padrões dentro da fala rápida.",
        minutes: 15,
      },
    ],
    B1: [
      {
        kind: "podcast",
        title: "Podcast nativo, sem adaptação",
        search: "podcast episode about " + topic,
        why: "Sem acomodação nenhuma. É aqui que a escuta de verdade se constrói.",
        minutes: 20,
      },
      {
        kind: "news",
        title: "Notícia em vídeo",
        search: "CNN / BBC / NPR: reportagem de 3 a 5 minutos",
        why: "Vocabulário formal, dicção limpa, velocidade real. Bom degrau antes da conversa casual.",
        minutes: 10,
      },
      {
        kind: "social",
        title: "Comentários de nativos",
        search: `Reddit ou YouTube: comentários sobre ${topic}`,
        why: "Inglês escrito informal: gíria, abreviação, ironia. É a linguagem que não aparece em curso.",
        minutes: 10,
      },
    ],
    B2: [
      {
        kind: "podcast",
        title: "Conversa longa entre nativos",
        search: "long form interview podcast, 2 or more speakers",
        why: "Duas ou mais pessoas se interrompendo. O caso mais difícil e o mais parecido com a vida.",
        minutes: 25,
      },
      {
        kind: "series",
        title: "Episódio SEM legenda",
        search: "sitcom or drama episode, no subtitles",
        why: "Sem muleta. Você vai perder coisa: o objetivo é seguir mesmo perdendo.",
        minutes: 20,
      },
      {
        kind: "music",
        title: "Stand-up ou humor",
        search: "stand-up comedy special clip",
        why: "Humor é o último território da fluência: exige cultura, timing e ironia ao mesmo tempo.",
        minutes: 10,
      },
    ],
    C1: [
      {
        kind: "podcast",
        title: "Debate ou painel com sotaques variados",
        search: "panel discussion with speakers from different countries",
        why: "Indiano, escocês, australiano, nigeriano. O inglês do mundo real é multissotaque.",
        minutes: 30,
      },
      {
        kind: "news",
        title: "Análise longa",
        search: "long form analysis or documentary",
        why: "Argumentação densa, vocabulário abstrato, estrutura complexa.",
        minutes: 25,
      },
    ],
  };

  return byLevel[level];
}

/** Roteiro da conversa ao vivo do dia 11, derivado da situação do circuito. */
export function livePromptFor(circuit: CircuitSpec): string {
  return [
    `You are role-playing this situation with the student: ${circuit.situation}`,
    "",
    `Stay in character. Start the conversation naturally: do not explain the exercise.`,
    `Use the target chunks when they fit, so the student hears them in context:`,
    ...circuit.chunks.slice(0, 5).map((c) => `  - "${c.en}"`),
    "",
    "Speak at natural speed. Do not slow down unless the student asks.",
    "If the student gets stuck for more than a few seconds, help with a short prompt.",
    "After about 8 exchanges, let the conversation drift to a related topic : ",
    "real conversations do not stay on script, and that drift is the point.",
    "Correct only what blocks understanding, and do it inside the conversation,",
    "never as a lecture.",
  ].join("\n");
}

export interface LessonSpec {
  /** Dia absoluto do cronograma (1..728). É o rótulo que o aluno vê: "Dia 42". */
  dayNumber: number;
  /**
   * Circuito ao qual o dia pertence (1..52).
   *
   * O nome `weekNumber` é herança da coluna `week_number` no banco. NÃO é
   * semana de calendário: o cronograma é solto do calendário de propósito.
   */
  weekNumber: number;
  /** Posição do dia dentro do circuito (1..14). */
  circuitDay: number;
  phase: "A" | "B";
  cantoCode: string;
  circuitNumber: number;
  kind: LessonKind;
  role: string;
  label: string;
  level: CefrLevel;
  title: string;
  subtitle: string;
  objective: string;
  situation: string;
  pattern: string;
  chunks: Chunk[];
  mission: string;
  mindset: string;
  pitfall: string;
  reviewOf: number[];
  authenticInput: AuthenticInput[];
  livePrompt: string | null;
  speakingPrompt: string;
  coreMinutes: number;
  estimatedMinutes: number;
}

function cantoForWeek(week: number): CantoSpec {
  const found = CANTOS.find((c) => week >= c.weekStart && week <= c.weekEnd);
  if (!found) throw new Error(`Nenhum canto cobre a semana ${week}`);
  return found;
}

/**
 * Revisão espaçada: 1, 2 e 4 semanas atrás.
 * Esses intervalos batem a curva do esquecimento sem sobrecarregar o dia 6.
 */
function spacedReview(circuit: number): number[] {
  return [circuit - 1, circuit - 2, circuit - 4].filter((n) => n >= 1);
}

/**
 * Revisão intercalada: cinco circuitos anteriores, misturando distâncias.
 *
 * A versão anterior era constante e ninguém percebeu. Ela fazia
 * `pool[(i * 7 + circuit * 3) % pool.length]` com `pool.length === circuit` — e
 * `circuit * 3 % circuit` é sempre ZERO, então o termo que deveria variar por
 * circuito era código morto. Sobrava `(i * 7) % circuit`, e todo circuito a
 * partir do 30 devolvia exatamente {1, 8, 15, 22, 29}. Combinado com a janela
 * de seis circuitos que alimentava o dia 13, a interseção era vazia em 20 dos
 * 52 circuitos — inclusive em TODOS de 36 a 52 — e a lição caía silenciosamente
 * nos blocos do próprio circuito, enquanto `lessons.review_of` anunciava cinco
 * outros.
 *
 * O que a intercalação pede não é sorteio: é MISTURAR DISTÂNCIAS. Duas
 * lembranças recentes, duas do meio, uma antiga. É isso que faz a revisão
 * parecer mais difícil e render mais.
 */
export function interleavedReview(circuit: number): number[] {
  const anteriores = circuit - 1;
  if (anteriores <= 0) return [];
  // Com pouca história, revisar tudo é mais honesto do que fingir seleção.
  if (anteriores <= 5) return Array.from({ length: anteriores }, (_, i) => i + 1);

  // Frações da história do aluno, do mais recente ao mais antigo.
  const faixas = [1.0, 0.82, 0.6, 0.38, 0.12];
  const picks = new Set<number>();

  faixas.forEach((fracao, i) => {
    // O desvio por circuito impede que todos os circuitos sorteiem as mesmas
    // posições relativas — sem ele a seleção volta a ser previsível.
    const alvo = Math.round(anteriores * fracao) - ((circuit + i * 2) % 3);
    const base = Math.max(1, Math.min(anteriores, alvo));

    // Colidiu com uma faixa vizinha: anda para trás e, se não couber, para frente.
    let n = base;
    while (n >= 1 && picks.has(n)) n--;
    if (n < 1) {
      n = base;
      while (n <= anteriores && picks.has(n)) n++;
    }
    if (n >= 1 && n <= anteriores) picks.add(n);
  });

  return [...picks].sort((a, b) => a - b);
}

/**
 * Os blocos de TODOS os circuitos anteriores, para os dias de revisão.
 *
 * Antes era `.slice(-6)`, replicado literalmente em três scripts. Com a janela
 * de seis, nada mais antigo que N−6 podia aparecer numa lição: o circuito 1
 * sumia para sempre depois do circuito 7. Repetição espaçada sem memória longa
 * não é repetição espaçada — é repetição.
 *
 * Quem precisa de recorte curto que recorte no ponto de uso: o dia 10 usa
 * `slice(-6, -3)` justamente para continuar cruzando com N−6, N−5 e N−4.
 */
export function reviewChunksFor(circuitNumber: number) {
  return CIRCUITS.filter((c) => c.number < circuitNumber).map((c) => ({
    circuit: c.number,
    title: c.title,
    chunks: c.chunks,
  }));
}

function dayTitle(circuit: CircuitSpec, day: DayRole): { title: string; objective: string } {
  const t = circuit.title;

  switch (day.day) {
    case 1:
      return {
        title: `${t}: ouça primeiro`,
        objective: `Ouvir a situação "${t}" em velocidade real, três vezes, antes de ver qualquer texto.`,
      };
    case 2:
      return {
        title: `${t}: os blocos`,
        objective: `Colocar na boca os ${circuit.chunks.length} blocos prontos deste circuito, um a um, em voz alta.`,
      };
    case 3:
      return {
        title: `${t}: troque as peças`,
        objective: `Usar o molde "${circuit.pattern}" com peças diferentes até sair sem pensar.`,
      };
    case 4:
      return {
        title: `${t}: escuta real`,
        objective: `Reconhecer os blocos num diálogo novo, em velocidade natural e com outro sotaque.`,
      };
    case 5:
      return {
        title: `${t}: sua vez`,
        objective: `Produzir fala espontânea na situação e receber correção da tutora.`,
      };
    case 6:
      return {
        title: `Revisão espaçada: circuito ${circuit.number}`,
        objective: `Puxar da memória os blocos que venceram hoje na sua agenda, sem consultar nada.`,
      };
    case 7:
      return {
        title: `Missão: ${t.toLowerCase()}`,
        objective: `Fechar a fase A usando a situação de verdade, fora do aplicativo.`,
      };

    // ------------------------------------------- FASE B
    case 8:
      return {
        title: `${t}: inglês de verdade`,
        objective: `Consumir material real do mundo sobre a situação: não material de curso.`,
      };
    case 9:
      return {
        title: `${t}: shadowing`,
        objective: `Repetir por cima do áudio com meio segundo de atraso, sem parar, até o ritmo colar.`,
      };
    case 10:
      return {
        title: `${t}: frases longas`,
        objective: `Cruzar o molde desta semana com circuitos anteriores e produzir frases encadeadas.`,
      };
    case 11:
      return {
        title: `${t}: conversa ao vivo`,
        objective: `Conversar por voz, em tempo real, sem roteiro e sem pausa para pensar.`,
      };
    case 12:
      return {
        title: `${t}: escuta acelerada`,
        objective: `Ouvir a 1,25x e 1,5x até a velocidade normal do nativo soar devagar.`,
      };
    case 13:
      return {
        title: `Revisão intercalada: circuito ${circuit.number}`,
        objective: `Blocos de circuitos misturados, fora de ordem. Intercalar custa mais e fixa mais.`,
      };
    default:
      return {
        title: `${t}: sem roteiro`,
        objective: `Conversar sobre a situação deixando o assunto derivar, como na vida real.`,
      };
  }
}

/** Expande a grade em 728 especificações de lição. Determinístico. */
export function buildLessonPlan(): LessonSpec[] {
  const lessons: LessonSpec[] = [];

  for (const circuit of CIRCUITS) {
    const canto = cantoForWeek(circuit.number);
    const authentic = authenticInputFor(circuit, canto.level);
    const livePrompt = livePromptFor(circuit);

    for (const day of DAY_RHYTHM) {
      const dayNumber = (circuit.number - 1) * DAYS_PER_CIRCUIT + day.day;
      const { title, objective } = dayTitle(circuit, day);

      lessons.push({
        dayNumber,
        weekNumber: circuit.number,
        circuitDay: day.day,
        phase: day.phase,
        cantoCode: canto.code,
        circuitNumber: circuit.number,
        kind: day.kind,
        role: day.role,
        label: day.label,
        level: canto.level,
        title,
        subtitle: day.label,
        objective,
        situation: circuit.situation,
        pattern: circuit.pattern,
        chunks: circuit.chunks,
        mission: circuit.mission,
        mindset: circuit.mindset,
        pitfall: circuit.pitfall,
        reviewOf:
          day.day === 6
            ? spacedReview(circuit.number)
            : day.day === 13
              ? interleavedReview(circuit.number)
              : [],
        authenticInput: day.day === 8 ? authentic : [],
        livePrompt: day.day === 11 ? livePrompt : null,
        speakingPrompt: circuit.situation,
        coreMinutes: 15,
        estimatedMinutes: 15,
      });
    }
  }

  return lessons;
}

export const DAYS_TOTAL = CIRCUITS.length * DAYS_PER_CIRCUIT; // 728
export const TOTAL_DAYS = DAYS_TOTAL;
export const TOTAL_CIRCUITS = CIRCUITS.length;

/**
 * Deliberadamente NÃO existe um `TOTAL_WEEKS` aqui.
 *
 * O cronograma é medido em dias e circuitos, nunca em semanas de calendário:
 * o aluno que faz 4 dias numa semana e 9 na outra continua no Dia 13. Amarrar
 * a progressão ao calendário só serviria para fazer quem atrasa se sentir
 * devendo: e quem se sente devendo abandona.
 */
