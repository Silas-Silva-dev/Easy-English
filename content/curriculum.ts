/**
 * Currículo do curso "Inglês Destravado — 4 Cantos".
 *
 * ===========================================================================
 * O MÉTODO
 * ===========================================================================
 * A unidade de aprendizado NÃO é a regra gramatical. É o CHUNK: um bloco de
 * fala pronto, memorizado inteiro e reaproveitado trocando peças.
 *
 * Ninguém aprende a falar montando frases a partir de tabelas de conjugação.
 * Aprende repetindo blocos até eles saírem sem pensar — que é como a criança
 * aprende e como o cérebro adulto também aprende quando você para de atrapalhar.
 *
 * Cinco regras que organizam tudo:
 *
 *   1. SITUAÇÃO ANTES DE REGRA. Cada semana é uma cena real (pedir um café,
 *      se apresentar numa reunião, resolver um problema no hotel) — nunca
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
 *   FASE A (dias 1-7)  — aquisição: conhecer, colocar na boca, produzir
 *   FASE B (dias 8-14) — consolidação: input real, shadowing, conversa ao
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
 * O conteúdo é o mesmo para todo mundo. O que muda é quanto se faz por dia —
 * e a meta prometida muda junto, honestamente.
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

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1";

/** Valores do enum `lesson_kind` no banco — reaproveitados para os 7 papéis. */
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
  /** Quando usar — o gatilho de memória. */
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

export const DAY_BLOCKS: Record<DayBlockId, { label: string; minutes: number; brief: string }> = {
  core: {
    label: "Núcleo",
    minutes: 15,
    brief: "A lição do dia. Comum a todas as trilhas — é o que sustenta o hábito.",
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
    brief: "Material real do mundo — série, podcast, notícia — não material de curso.",
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
      "Ainda vai escapar gíria regional muito específica e humor de nicho — como escapa para qualquer estrangeiro.",
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
      "Exige 1h40 por dia, todo dia. A maioria das pessoas não sustenta esse ritmo — e tudo bem.",
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
  // ---------------------------------------- FASE A — aquisição
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
      "Substitution drill. Aqui — e só aqui — entra a nota curta 'por que funciona assim'.",
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

  // ---------------------------------------- FASE B — consolidação
  {
    day: 8,
    phase: "B",
    kind: "listening",
    role: "authentic",
    label: "Input autêntico",
    brief:
      "Material real do mundo — série, podcast, vídeo — não material de curso. Aqui o inglês para de ser didático.",
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
    title: "Primeiro Canto — Destravar",
    subtitle: "Semanas 1–13 · A1",
    description:
      "Você sai do zero falando. Nas primeiras semanas já são mais de 80 blocos prontos na boca: cumprimentar, se apresentar, pedir, agradecer, pedir para repetir. Nada de tabela de verbo — você fala primeiro e entende o porquê depois.",
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
    title: "Segundo Canto — Contar",
    subtitle: "Semanas 14–26 · A1→A2",
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
    title: "Terceiro Canto — Resolver",
    subtitle: "Semanas 27–39 · A2→B1",
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
    title: "Quarto Canto — Soar natural",
    subtitle: "Semanas 40–52 · B1→B2",
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
// 52 CIRCUITOS — uma situação real por semana
// ===========================================================================

export const CIRCUITS: CircuitSpec[] = [
  // ------------------------------------------------ PRIMEIRO CANTO (1–13)
  {
    number: 1,
    title: "O primeiro oi",
    situation:
      "Você chega a um lugar novo — um evento, um curso, o primeiro dia de trabalho — e alguém vira para você e diz 'Hi!'. Os próximos 20 segundos decidem se a conversa acontece ou morre.",
    pattern: "I'm ___ . Nice to meet you.",
    patternNote:
      "Um único molde resolve toda apresentação. Você troca a peça do nome e o resto sai igual, sempre.",
    chunks: [
      { en: "Hi, I'm Ana.", pt: "Oi, eu sou a Ana.", when: "Abrindo qualquer conversa" },
      { en: "Nice to meet you.", pt: "Prazer em conhecer você.", when: "Logo depois do nome" },
      { en: "Nice to meet you too.", pt: "Prazer em conhecer você também.", when: "Devolvendo" },
      { en: "How are you?", pt: "Tudo bem?", when: "Faz parte do cumprimento, não é pergunta de verdade" },
      { en: "I'm good, thanks. And you?", pt: "Tudo bem, obrigado. E você?", when: "Resposta padrão" },
      { en: "Sorry, what's your name again?", pt: "Desculpa, qual seu nome mesmo?", when: "Quando não pegou o nome" },
      { en: "See you later!", pt: "Até mais!", when: "Fechando a conversa" },
    ],
    mission:
      "Grave um áudio de 30 segundos se apresentando como se estivesse chegando num evento. Mande para alguém.",
    mindset:
      "Você não precisa saber inglês para começar a falar inglês. Precisa de 7 blocos e coragem de errar em voz alta. Hoje você já tem os 7.",
    pitfall:
      "Responder 'How are you?' com um relato do dia. É cumprimento, não consulta médica: responde curto e devolve.",
  },
  {
    number: 2,
    title: "Quem é você em 30 segundos",
    situation:
      "A pessoa gostou de você e quer saber mais: de onde você é, o que faz, com quem mora. É a conversa que se repete em todo primeiro encontro da vida.",
    pattern: "I'm from ___ . I work as ___ .",
    patternNote:
      "Dois moldes cobrem origem e profissão. Você nunca mais monta essas frases do zero.",
    chunks: [
      { en: "I'm from Brazil.", pt: "Eu sou do Brasil.", when: "Origem" },
      { en: "I live in São Paulo.", pt: "Eu moro em São Paulo.", when: "Onde mora agora" },
      { en: "I work as a designer.", pt: "Eu trabalho como designer.", when: "Profissão" },
      { en: "I'm 32.", pt: "Eu tenho 32 anos.", when: "Idade — sem 'have', nunca" },
      { en: "What about you?", pt: "E você?", when: "Devolvendo a pergunta" },
      { en: "That's interesting!", pt: "Que interessante!", when: "Reagindo sem ter o que dizer" },
      { en: "How long have you been here?", pt: "Faz quanto tempo que você está aqui?", when: "Puxando assunto" },
    ],
    mission: "Grave sua apresentação completa de 45 segundos: nome, origem, trabalho, idade.",
    mindset:
      "Ninguém está avaliando seu inglês. Estão tentando entender você. Comunicação vence perfeição — todo dia.",
    pitfall:
      "'I have 32 years' — tradução literal de 'tenho 32 anos'. Em inglês idade é ser, não ter: 'I'm 32'.",
  },
  {
    number: 3,
    title: "Não entendi — e daí?",
    situation:
      "A pessoa falou rápido demais e você não pegou nada. Esse é o momento que faz a maioria desistir. Existem 6 frases que resolvem e mantêm a conversa viva.",
    pattern: "Sorry, could you ___ ?",
    patternNote: "Um molde educado que aceita qualquer pedido de socorro conversacional.",
    chunks: [
      { en: "Sorry, could you say that again?", pt: "Desculpa, pode repetir?", when: "Não entendeu nada" },
      { en: "Could you speak more slowly, please?", pt: "Pode falar mais devagar, por favor?", when: "Falou rápido" },
      { en: "What does that mean?", pt: "O que isso significa?", when: "Palavra desconhecida" },
      { en: "How do you spell that?", pt: "Como se escreve?", when: "Nome ou endereço" },
      { en: "I'm sorry, I don't understand.", pt: "Desculpa, não entendi.", when: "Assumindo sem vergonha" },
      { en: "Do you mean ___ ?", pt: "Você quer dizer ___ ?", when: "Confirmando o que achou que entendeu" },
      { en: "My English is still basic, sorry.", pt: "Meu inglês ainda é básico, desculpa.", when: "Tirando o peso das costas" },
    ],
    mission:
      "Assista 2 minutos de um vídeo em inglês sem legenda. Não entenda. Depois grave dizendo, em inglês, o que conseguiu captar.",
    mindset:
      "Não entender é parte do processo, não sinal de fracasso. O aluno que pergunta 'could you repeat?' aprende. O que finge que entendeu, não.",
    pitfall:
      "Congelar em silêncio ou sorrir fingindo que entendeu. O silêncio mata a conversa; a pergunta a mantém viva.",
  },
  {
    number: 4,
    title: "Pedindo no balcão",
    situation:
      "Café, padaria, lanchonete, farmácia. Você aponta e resmunga, ou pede como gente. A diferença são 6 blocos.",
    pattern: "Can I have ___ , please?",
    patternNote:
      "O molde mais útil do inglês inteiro. Serve para comida, bebida, objeto, informação, favor. Só troca a peça.",
    chunks: [
      { en: "Can I have a coffee, please?", pt: "Pode me ver um café, por favor?", when: "Pedindo qualquer coisa" },
      { en: "I'd like a sandwich.", pt: "Eu queria um sanduíche.", when: "Versão um pouco mais formal" },
      { en: "How much is it?", pt: "Quanto é?", when: "Perguntando o preço" },
      { en: "For here or to go?", pt: "Para comer aqui ou levar?", when: "O que ELES vão te perguntar" },
      { en: "To go, please.", pt: "Para levar, por favor.", when: "Respondendo" },
      { en: "Anything else?", pt: "Mais alguma coisa?", when: "O que eles perguntam no fim" },
      { en: "That's all, thanks.", pt: "Só isso, obrigado.", when: "Fechando o pedido" },
    ],
    mission:
      "Faça o pedido completo de um café em voz alta, do 'Can I have' até o 'That's all, thanks'. Grave.",
    mindset:
      "Quinze minutos por dia batem duas horas no sábado. O cérebro consolida no intervalo, não no esforço concentrado.",
    pitfall:
      "'I want a coffee' soa grosseiro em inglês. 'Can I have' ou 'I'd like' — a educação está no molde, não no tom.",
  },
  {
    number: 5,
    title: "Números que você usa todo dia",
    situation:
      "Preço, horário, telefone, endereço, quantidade. Números são onde o iniciante trava mesmo sabendo o resto.",
    pattern: "It's ___ .",
    patternNote: "O molde mais curto do curso. O trabalho aqui é de ouvido, não de estrutura.",
    chunks: [
      { en: "It's five dollars.", pt: "São cinco dólares.", when: "Dizendo preço" },
      { en: "It's half past three.", pt: "São três e meia.", when: "Dizendo a hora" },
      { en: "What time is it?", pt: "Que horas são?", when: "Perguntando a hora" },
      { en: "Around eight.", pt: "Umas oito.", when: "Horário aproximado" },
      { en: "Two, please.", pt: "Dois, por favor.", when: "Quantidade no balcão" },
      { en: "Sorry, how much?", pt: "Desculpa, quanto?", when: "Não pegou o preço" },
      { en: "Can you write it down?", pt: "Pode escrever?", when: "Número complicado" },
    ],
    mission: "Grave dizendo em inglês: a hora agora, seu telefone e o preço do seu almoço.",
    mindset:
      "Ninguém aprende número lendo. Aprende ouvindo até parar de traduzir. Repita em voz alta, não com os olhos.",
    pitfall:
      "Confundir thirteen/thirty, fourteen/forty. A diferença está na sílaba tônica: thir-TEEN vs THIR-ty.",
  },
  {
    number: 6,
    title: "Seu dia em inglês",
    situation:
      "'So, what do you do every day?' — a pergunta que abre metade das conversas e trava metade dos brasileiros.",
    pattern: "I ___ every day.",
    patternNote: "Molde de rotina. As peças são os verbos do seu dia; o esqueleto nunca muda.",
    chunks: [
      { en: "I wake up at seven.", pt: "Eu acordo às sete.", when: "Começando a rotina" },
      { en: "I usually have coffee first.", pt: "Eu geralmente tomo café primeiro.", when: "Frequência" },
      { en: "Then I go to work.", pt: "Aí eu vou trabalhar.", when: "Encadeando" },
      { en: "I get home around six.", pt: "Chego em casa lá pelas seis.", when: "Fim do dia" },
      { en: "After that, I cook dinner.", pt: "Depois disso, faço o jantar.", when: "Conectivo de sequência" },
      { en: "I go to bed late.", pt: "Eu durmo tarde.", when: "Fechando" },
      { en: "What's your routine like?", pt: "Como é a sua rotina?", when: "Devolvendo" },
    ],
    mission: "Grave 60 segundos contando seu dia inteiro, do acordar ao dormir, sem parar.",
    mindset:
      "Você não precisa de vocabulário novo hoje. Precisa usar o que já tem até sair sem pensar. Repetição é o atalho.",
    pitfall:
      "Esquecer o -s da terceira pessoa: 'He work' em vez de 'He works'. O bloco já vem com o -s embutido — decore o bloco, não a regra.",
  },
  {
    number: 7,
    title: "Do que você gosta",
    situation:
      "A conversa esquentou e agora é sobre gostos: música, comida, série, esporte. É aqui que a conversa fica pessoal.",
    pattern: "I love ___ ing.",
    patternNote:
      "Depois de love/like/hate/enjoy, o verbo vira -ing. Um molde, dezenas de frases.",
    chunks: [
      { en: "I love cooking.", pt: "Eu amo cozinhar.", when: "Gosto forte" },
      { en: "I'm really into music.", pt: "Eu curto muito música.", when: "Versão mais natural" },
      { en: "I'm not a big fan of that.", pt: "Não sou muito fã disso.", when: "Recusando com educação" },
      { en: "Have you seen it?", pt: "Você já viu?", when: "Puxando sobre filme/série" },
      { en: "You should try it!", pt: "Você tem que experimentar!", when: "Recomendando" },
      { en: "It depends.", pt: "Depende.", when: "Ganhando tempo" },
      { en: "Same here!", pt: "Eu também!", when: "Concordando rápido" },
    ],
    mission: "Grave 45 segundos falando de 3 coisas que você ama fazer e por quê.",
    mindset:
      "Falar do que você gosta é o assunto mais fácil do mundo — em qualquer idioma. Comece as conversas por aí.",
    pitfall: "'I like to cooking' — ou usa o -ing ou o 'to', nunca os dois juntos.",
  },
  {
    number: 8,
    title: "Sua gente",
    situation:
      "Mostrar foto da família, falar do irmão, do filho, do parceiro. Conversa que cria vínculo de verdade.",
    pattern: "This is my ___ .",
    patternNote: "Molde de apresentação de pessoas — presencial ou por foto.",
    chunks: [
      { en: "This is my brother.", pt: "Esse é meu irmão.", when: "Apresentando alguém" },
      { en: "I have two kids.", pt: "Eu tenho dois filhos.", when: "Falando de filhos" },
      { en: "We're really close.", pt: "A gente é muito próximo.", when: "Descrevendo o vínculo" },
      { en: "He looks like my dad.", pt: "Ele é parecido com meu pai.", when: "Semelhança" },
      { en: "She's the one who ___ .", pt: "Ela é a que ___ .", when: "Identificando na foto" },
      { en: "Do you have any siblings?", pt: "Você tem irmãos?", when: "Devolvendo" },
      { en: "That's my family.", pt: "Essa é minha família.", when: "Fechando" },
    ],
    mission: "Pegue uma foto da sua família e grave 60 segundos descrevendo cada pessoa.",
    mindset:
      "Se você faltou ontem, não recomece do zero: continue de onde parou. Perfeição não constrói hábito, retomada constrói.",
    pitfall:
      "'Parents' são os pais, não parentes. Parentes é 'relatives'. Falso cognato clássico.",
  },
  {
    number: 9,
    title: "Onde você mora",
    situation:
      "Descrever sua casa, seu bairro, sua cidade. Aparece em conversa social, em aluguel de Airbnb e em entrevista.",
    pattern: "There's a ___ near my place.",
    patternNote:
      "'There is / there are' é como o inglês diz que algo existe. O português usa 'tem' — e é aí que dá errado.",
    chunks: [
      { en: "I live in a small apartment.", pt: "Moro num apartamento pequeno.", when: "Descrevendo a casa" },
      { en: "There's a park near my place.", pt: "Tem um parque perto de casa.", when: "O que existe por perto" },
      { en: "It's about ten minutes away.", pt: "Fica a uns dez minutos.", when: "Distância" },
      { en: "The neighborhood is pretty quiet.", pt: "O bairro é bem tranquilo.", when: "Caracterizando" },
      { en: "I've lived here for three years.", pt: "Moro aqui há três anos.", when: "Tempo de moradia" },
      { en: "It's a nice area.", pt: "É uma área boa.", when: "Avaliação geral" },
      { en: "Where do you live?", pt: "Onde você mora?", when: "Devolvendo" },
    ],
    mission: "Grave um tour de 60 segundos pela sua casa, em inglês, andando pelos cômodos.",
    mindset:
      "Fale sozinho em voz alta. Parece bobo e é o exercício que mais acelera a fala — a boca precisa de quilometragem.",
    pitfall:
      "'In my street have a market' — tradução literal de 'tem'. O correto é 'There's a market on my street'.",
  },
  {
    number: 10,
    title: "Achando o caminho",
    situation:
      "Você está perdido numa cidade estrangeira, sem sinal no celular. Precisa perguntar e — mais difícil — entender a resposta.",
    pattern: "How do I get to ___ ?",
    patternNote:
      "'Where is' pergunta o lugar; 'how do I get to' pergunta o caminho. São coisas diferentes.",
    chunks: [
      { en: "Excuse me, how do I get to the station?", pt: "Com licença, como chego na estação?", when: "Pedindo caminho" },
      { en: "Is it far from here?", pt: "É longe daqui?", when: "Medindo a distância" },
      { en: "Go straight and turn left.", pt: "Siga reto e vire à esquerda.", when: "O que vão te responder" },
      { en: "It's on your right.", pt: "Fica à sua direita.", when: "Resposta comum" },
      { en: "Sorry, left or right?", pt: "Desculpa, esquerda ou direita?", when: "Confirmando" },
      { en: "Can you show me on the map?", pt: "Pode me mostrar no mapa?", when: "Quando não entendeu" },
      { en: "Thanks a lot!", pt: "Muito obrigado!", when: "Fechando" },
    ],
    mission:
      "Abra o mapa e grave, em inglês, as instruções da sua casa até o mercado mais próximo.",
    mindset:
      "Perguntar o caminho em inglês é o teste mais honesto: você não controla a resposta. Treinar isso é treinar a vida real.",
    pitfall:
      "Perguntar 'Where is the station?' quando quer o caminho. Vão apontar vagamente e você continua perdido.",
  },
  {
    number: 11,
    title: "Comprando roupa",
    situation:
      "Loja, provador, tamanho errado, troca. Situação de viagem que todo mundo passa e quase ninguém treina.",
    pattern: "Do you have this in ___ ?",
    patternNote: "Molde de disponibilidade: tamanho, cor, modelo. Uma frase, três usos.",
    chunks: [
      { en: "Do you have this in a medium?", pt: "Tem isso em M?", when: "Pedindo tamanho" },
      { en: "Can I try it on?", pt: "Posso experimentar?", when: "Provador" },
      { en: "Where's the fitting room?", pt: "Onde fica o provador?", when: "Localizando" },
      { en: "It's too tight.", pt: "Está muito apertado.", when: "Não serviu" },
      { en: "I'll take it.", pt: "Vou levar.", when: "Decidindo comprar" },
      { en: "Can I return it if it doesn't fit?", pt: "Posso devolver se não servir?", when: "Política de troca" },
      { en: "I'm just looking, thanks.", pt: "Só estou olhando, obrigado.", when: "Tirando o vendedor de cima" },
    ],
    mission: "Simule uma compra completa em voz alta: pedir tamanho, provar, decidir, perguntar troca.",
    mindset:
      "'I'm just looking, thanks' é o bloco mais libertador da viagem. Aprenda a dizer não em inglês.",
    pitfall:
      "Usar 'how much' para tudo. 'How much' é para dinheiro e incontável; 'how many' para contável.",
  },
  {
    number: 12,
    title: "No restaurante",
    situation:
      "Pedir, ajustar o pedido, avisar de alergia, pedir a conta. Uma hora inteira da sua viagem depende disso.",
    pattern: "Could I get ___ , please?",
    patternNote: "Versão mais polida de 'can I have'. Mesmo molde, registro mais alto.",
    chunks: [
      { en: "A table for two, please.", pt: "Mesa para dois, por favor.", when: "Chegando" },
      { en: "Could I get the chicken, please?", pt: "Eu queria o frango, por favor.", when: "Pedindo prato" },
      { en: "I'm allergic to nuts.", pt: "Sou alérgico a castanhas.", when: "Alerta importante" },
      { en: "What do you recommend?", pt: "O que você recomenda?", when: "Sem saber o que pedir" },
      { en: "Could we get the check, please?", pt: "Pode trazer a conta, por favor?", when: "Fechando" },
      { en: "Can we split the bill?", pt: "Dá para dividir a conta?", when: "Pagando em grupo" },
      { en: "It was delicious, thank you.", pt: "Estava delicioso, obrigado.", when: "Saindo bem" },
    ],
    mission: "Grave um pedido completo de restaurante, da mesa até a conta.",
    mindset:
      "Você já tem 12 semanas de blocos. Volte no circuito 1 e perceba: aquilo que travava já sai automático.",
    pitfall:
      "'The account, please' — 'account' é conta bancária. Conta de restaurante é 'check' (EUA) ou 'bill' (UK).",
  },
  {
    number: 13,
    title: "Fechando o Primeiro Canto",
    situation:
      "Revisão viva de tudo: um dia inteiro simulado em inglês, do bom dia ao boa noite, usando os blocos dos 12 circuitos anteriores.",
    pattern: "Todos os moldes dos circuitos 1–12",
    patternNote:
      "Nada novo. Hoje é sobre puxar da memória sem aviso — que é como a vida real cobra.",
    chunks: [
      { en: "Hi, I'm ___ . Nice to meet you.", pt: "Apresentação", when: "Circuito 1" },
      { en: "Sorry, could you say that again?", pt: "Socorro conversacional", when: "Circuito 3" },
      { en: "Can I have ___ , please?", pt: "Pedido", when: "Circuito 4" },
      { en: "I usually ___ .", pt: "Rotina", when: "Circuito 6" },
      { en: "There's a ___ near my place.", pt: "Existência", when: "Circuito 9" },
      { en: "How do I get to ___ ?", pt: "Caminho", when: "Circuito 10" },
      { en: "Could we get the check, please?", pt: "Conta", when: "Circuito 12" },
    ],
    mission:
      "Passe 30 minutos do seu dia narrando tudo o que você faz em inglês, em voz alta, sem consultar nada.",
    mindset:
      "Treze semanas atrás você não falava nada. Hoje você atravessa um dia inteiro. Isso não foi talento — foi 15 minutos por dia.",
    pitfall:
      "Achar que precisa 'saber mais' antes de usar. Você já tem o suficiente para se virar. Use.",
  },

  // ------------------------------------------------ SEGUNDO CANTO (14–26)
  {
    number: 14,
    title: "O que você fez ontem",
    situation:
      "Você reencontra alguém depois do fim de semana e vem a pergunta: 'How was your weekend?'. São 30 segundos para contar algo que sustente a conversa.",
    pattern: "I went to ___ and I ___ .",
    patternNote:
      "O passado em inglês é mais simples que em português: uma forma só, sem conjugação por pessoa.",
    chunks: [
      { en: "How was your weekend?", pt: "Como foi seu fim de semana?", when: "A pergunta de segunda" },
      { en: "It was great, thanks!", pt: "Foi ótimo, obrigado!", when: "Resposta curta" },
      { en: "I went to the beach.", pt: "Eu fui à praia.", when: "Deslocamento no passado" },
      { en: "I stayed home and watched a movie.", pt: "Fiquei em casa e vi um filme.", when: "Fim de semana caseiro" },
      { en: "I met up with some friends.", pt: "Encontrei uns amigos.", when: "Social" },
      { en: "Nothing special, really.", pt: "Nada de especial, na verdade.", when: "Quando não fez nada" },
      { en: "What about yours?", pt: "E o seu?", when: "Devolvendo" },
    ],
    mission: "Grave 60 segundos contando seu último fim de semana com pelo menos 5 verbos no passado.",
    mindset:
      "Você vai errar verbo irregular. Erre falando. O aluno que espera dominar a tabela nunca abre a boca.",
    pitfall:
      "Pronunciar '-ed' como sílaba extra: 'worked' é /wɜːrkt/, não 'wor-ki-di'. Só ganha sílaba depois de T ou D.",
  },
  {
    number: 15,
    title: "Contando uma história",
    situation:
      "Aconteceu algo engraçado ou absurdo com você e a mesa toda quer ouvir. Contar história é o que separa quem fala de quem só responde.",
    pattern: "So, I was ___ when suddenly ___ .",
    patternNote: "O molde de narrativa: cenário no fundo, evento na frente. É assim que se conta em qualquer língua.",
    chunks: [
      { en: "You won't believe what happened.", pt: "Você não vai acreditar no que aconteceu.", when: "Abrindo a história" },
      { en: "So, I was walking home when...", pt: "Então, eu estava indo pra casa quando...", when: "Cenário + evento" },
      { en: "All of a sudden...", pt: "De repente...", when: "Virada" },
      { en: "And then it got worse.", pt: "E aí piorou.", when: "Escalada" },
      { en: "In the end, everything was fine.", pt: "No fim, deu tudo certo.", when: "Fechamento" },
      { en: "It was so embarrassing!", pt: "Foi tão vergonhoso!", when: "Reação" },
      { en: "That's crazy!", pt: "Que loucura!", when: "Reagindo à história do outro" },
    ],
    mission: "Grave 90 segundos contando a história mais engraçada que já aconteceu com você.",
    mindset:
      "História não precisa de vocabulário difícil. Precisa de ritmo e de conectivo. 'And then' vale mais que uma palavra rara.",
    pitfall:
      "Contar tudo em frases soltas, sem conectivo. Soa robótico. 'So', 'and then', 'in the end' fazem o trabalho.",
  },
  {
    number: 16,
    title: "Como você era antes",
    situation:
      "Conversa sobre infância, escola, como as coisas eram. Assunto que aproxima em qualquer cultura.",
    pattern: "I used to ___ .",
    patternNote: "'Used to' é 'costumava' — algo que era verdade antes e não é mais. Um molde, todo o passado habitual.",
    chunks: [
      { en: "I used to play soccer every day.", pt: "Eu costumava jogar futebol todo dia.", when: "Hábito passado" },
      { en: "When I was a kid...", pt: "Quando eu era criança...", when: "Abrindo memória" },
      { en: "Things were different back then.", pt: "As coisas eram diferentes naquela época.", when: "Comparando eras" },
      { en: "I really miss that.", pt: "Eu sinto muita falta disso.", when: "Nostalgia" },
      { en: "I don't do that anymore.", pt: "Eu não faço mais isso.", when: "Marcando a mudança" },
      { en: "It reminds me of...", pt: "Isso me lembra...", when: "Associação" },
      { en: "What were you like as a kid?", pt: "Como você era quando criança?", when: "Devolvendo" },
    ],
    mission: "Grave 60 segundos comparando como era sua vida aos 10 anos e como é hoje.",
    mindset:
      "Metade das semanas do Primeiro Canto já viraram automatismo. Não é impressão — é o efeito da revisão espaçada.",
    pitfall:
      "'I used to' (costumava) vs 'I'm used to' (estou acostumado). Uma letra, dois significados opostos.",
  },
  {
    number: 17,
    title: "Seus planos",
    situation:
      "'What are you doing this weekend?' — combinar, planejar, recusar. Conversa que acontece toda sexta-feira.",
    pattern: "I'm going to ___ .",
    patternNote:
      "Plano já decidido usa 'going to'. Decisão na hora usa 'will'. A diferença é quando você decidiu.",
    chunks: [
      { en: "What are you up to this weekend?", pt: "O que você vai fazer no fim de semana?", when: "Perguntando planos" },
      { en: "I'm going to visit my parents.", pt: "Vou visitar meus pais.", when: "Plano definido" },
      { en: "I haven't decided yet.", pt: "Ainda não decidi.", when: "Sem plano" },
      { en: "I'm thinking about traveling.", pt: "Estou pensando em viajar.", when: "Plano vago" },
      { en: "Do you want to join?", pt: "Quer vir junto?", when: "Convidando" },
      { en: "I'd love to, but I can't.", pt: "Eu adoraria, mas não posso.", when: "Recusando com jeito" },
      { en: "Maybe next time!", pt: "Quem sabe da próxima!", when: "Deixando a porta aberta" },
    ],
    mission: "Grave 60 segundos contando seus planos para os próximos 3 meses.",
    mindset:
      "Recusar em inglês exige almofada. 'No' seco soa agressivo. 'I'd love to, but...' resolve.",
    pitfall:
      "Usar presente para futuro: 'Tomorrow I go to the beach'. Em inglês é 'I'm going to go' ou 'I'm going'.",
  },
  {
    number: 18,
    title: "Marcando encontro",
    situation:
      "Combinar dia, hora e lugar — e depois remarcar quando der problema. Vale para amigo, médico e cliente.",
    pattern: "Does ___ work for you?",
    patternNote: "Molde de negociação de agenda. Educado, direto, funciona no pessoal e no profissional.",
    chunks: [
      { en: "Are you free on Friday?", pt: "Você está livre sexta?", when: "Sondando" },
      { en: "Does 3 PM work for you?", pt: "15h funciona para você?", when: "Propondo horário" },
      { en: "Works for me!", pt: "Funciona pra mim!", when: "Aceitando" },
      { en: "Can we make it a bit later?", pt: "Dá para deixar um pouco mais tarde?", when: "Ajustando" },
      { en: "Something came up.", pt: "Surgiu um imprevisto.", when: "Desmarcando" },
      { en: "Can we reschedule?", pt: "Podemos remarcar?", when: "Adiando" },
      { en: "See you then!", pt: "Até lá!", when: "Confirmando" },
    ],
    mission:
      "Grave uma negociação completa: propor horário, receber recusa, ajustar e confirmar.",
    mindset:
      "Você já sustenta uma conversa de ida e volta. Não é mais decorar frase: é responder ao que o outro disse.",
    pitfall:
      "Confundir 'by' (até um prazo) com 'until' (até um momento contínuo). 'By Friday' = até sexta; 'until Friday' = até sexta o tempo todo.",
  },
  {
    number: 19,
    title: "Concordar e discordar",
    situation:
      "A conversa virou opinião: política do trabalho, filme, restaurante. Você precisa se posicionar sem criar atrito.",
    pattern: "I see your point, but ___ .",
    patternNote:
      "O inglês discorda com almofada. O molde reconhece o outro antes de contrariar — e isso não é frescura, é o padrão.",
    chunks: [
      { en: "I totally agree.", pt: "Concordo totalmente.", when: "Concordância forte" },
      { en: "That's a good point.", pt: "É um bom argumento.", when: "Reconhecendo" },
      { en: "I see your point, but...", pt: "Entendo seu ponto, mas...", when: "Discordando com jeito" },
      { en: "I'm not so sure about that.", pt: "Não tenho tanta certeza disso.", when: "Discordância suave" },
      { en: "It depends on the situation.", pt: "Depende da situação.", when: "Meio-termo" },
      { en: "Fair enough.", pt: "Justo.", when: "Aceitando o argumento" },
      { en: "Let's agree to disagree.", pt: "Vamos concordar em discordar.", when: "Encerrando sem briga" },
    ],
    mission: "Grave 60 segundos defendendo uma opinião impopular sua, com dois argumentos.",
    mindset:
      "Discordar em inglês não é ser agressivo — é ser claro com educação. O molde faz o trabalho pesado.",
    pitfall:
      "'You are wrong' é uma bofetada em inglês. Ninguém diz isso. Use 'I'm not so sure about that'.",
  },
  {
    number: 20,
    title: "Comparando e escolhendo",
    situation:
      "Dois restaurantes, duas ofertas de emprego, duas cidades. Comparar e justificar a escolha.",
    pattern: "___ is better than ___ because ___ .",
    patternNote: "Comparativo + justificativa num molde só. É o esqueleto de qualquer decisão falada.",
    chunks: [
      { en: "This one is better than that one.", pt: "Esse é melhor que aquele.", when: "Comparando" },
      { en: "It's cheaper, but not as good.", pt: "É mais barato, mas não tão bom.", when: "Trade-off" },
      { en: "I'd rather stay home.", pt: "Eu prefiro ficar em casa.", when: "Preferência" },
      { en: "On the other hand...", pt: "Por outro lado...", when: "Contra-argumento" },
      { en: "It's the best option for me.", pt: "É a melhor opção pra mim.", when: "Decidindo" },
      { en: "What would you do?", pt: "O que você faria?", when: "Pedindo conselho" },
      { en: "That makes sense.", pt: "Faz sentido.", when: "Aceitando o argumento" },
    ],
    mission:
      "Grave 90 segundos comparando duas opções reais da sua vida e explicando sua escolha.",
    mindset:
      "Vinte semanas. Você já passou do ponto em que a maioria desiste. O difícil ficou para trás.",
    pitfall:
      "'More better', 'more easier'. Duplo comparativo não existe: ou é '-er' ou é 'more', nunca os dois.",
  },
  {
    number: 21,
    title: "Sentimentos e reações",
    situation:
      "Alguém te conta uma notícia — boa ou ruim. Ficar mudo é pior que errar. Reagir é obrigatório.",
    pattern: "I'm so ___ for you!",
    patternNote: "Molde de reação empática. Você troca a emoção e a frase inteira sai pronta.",
    chunks: [
      { en: "That's amazing! I'm so happy for you!", pt: "Que incrível! Estou tão feliz por você!", when: "Boa notícia" },
      { en: "I'm so sorry to hear that.", pt: "Sinto muito por isso.", when: "Má notícia" },
      { en: "That must be hard.", pt: "Isso deve ser difícil.", when: "Empatia" },
      { en: "Are you okay?", pt: "Você está bem?", when: "Preocupação" },
      { en: "Congratulations!", pt: "Parabéns!", when: "Conquista" },
      { en: "I'm a bit stressed lately.", pt: "Estou meio estressado ultimamente.", when: "Falando de si" },
      { en: "Let me know if you need anything.", pt: "Me avisa se precisar de algo.", when: "Fechando com apoio" },
    ],
    mission: "Grave suas reações a 5 notícias diferentes — 3 boas, 2 ruins.",
    mindset:
      "Reação vem antes de conteúdo. Quem reage bem em inglês parece muito mais fluente do que é.",
    pitfall:
      "'I'm with cold', 'I'm with hungry'. Não existe 'with': é 'I'm cold', 'I'm hungry'.",
  },
  {
    number: 22,
    title: "Pedindo e oferecendo ajuda",
    situation:
      "Você precisa de um favor — ou alguém precisa de você. Situação diária no trabalho e na rua.",
    pattern: "Could you help me with ___ ?",
    patternNote:
      "'Could' é mais educado que 'can' e resolve praticamente qualquer pedido. Molde de alto retorno.",
    chunks: [
      { en: "Could you help me with this?", pt: "Pode me ajudar com isso?", when: "Pedindo ajuda" },
      { en: "Do you need a hand?", pt: "Precisa de ajuda?", when: "Oferecendo" },
      { en: "Sure, no problem.", pt: "Claro, sem problema.", when: "Aceitando" },
      { en: "I'd appreciate it.", pt: "Eu agradeceria.", when: "Reforçando o pedido" },
      { en: "Sorry to bother you, but...", pt: "Desculpa incomodar, mas...", when: "Abrindo com jeito" },
      { en: "Thanks, you're a lifesaver!", pt: "Valeu, você me salvou!", when: "Agradecendo forte" },
      { en: "Don't worry about it.", pt: "Não esquenta.", when: "Minimizando" },
    ],
    mission: "Grave 3 pedidos de ajuda em contextos diferentes: trabalho, rua e amigo.",
    mindset:
      "Pedir ajuda em inglês é habilidade, não fraqueza. Quem pede avança; quem tenta adivinhar trava.",
    pitfall:
      "Pedir com imperativo puro: 'Help me'. Soa como ordem. 'Could you help me' é o padrão.",
  },
  {
    number: 23,
    title: "Small talk que não morre",
    situation:
      "Elevador, fila, intervalo do café. Trinta segundos de conversa fiada — e o silêncio constrangedor se você não tiver os blocos.",
    pattern: "How's ___ going?",
    patternNote: "Molde de abertura leve. Serve para trabalho, projeto, semana, família.",
    chunks: [
      { en: "How's it going?", pt: "Como vão as coisas?", when: "Abertura genérica" },
      { en: "Busy week?", pt: "Semana corrida?", when: "Puxando assunto no trabalho" },
      { en: "Crazy weather, huh?", pt: "Que tempo doido, né?", when: "O clássico universal" },
      { en: "How's the project going?", pt: "Como está indo o projeto?", when: "Contexto profissional" },
      { en: "Oh really? Tell me more.", pt: "Sério? Me conta mais.", when: "Mantendo viva" },
      { en: "Anyway, I should get going.", pt: "Enfim, preciso ir.", when: "Encerrando com elegância" },
      { en: "Good talking to you!", pt: "Bom falar com você!", when: "Despedida cordial" },
    ],
    mission:
      "Grave um small talk completo de 90 segundos, com abertura, dois turnos e encerramento.",
    mindset:
      "Small talk parece inútil e é a habilidade social mais valiosa em inglês. É o que abre porta antes da conversa séria.",
    pitfall:
      "Responder só o perguntado e parar. Em inglês você devolve a bola sempre — senão a conversa morre em você.",
  },
  {
    number: 24,
    title: "No telefone",
    situation:
      "Ligação sem rosto, sem gesto, sem leitura labial. É o teste mais duro do inglês falado.",
    pattern: "Sorry, I didn't catch that.",
    patternNote: "O bloco que salva qualquer ligação. Decore antes de precisar.",
    chunks: [
      { en: "Hi, this is Ana speaking.", pt: "Oi, aqui é a Ana.", when: "Se identificando" },
      { en: "Can you hear me?", pt: "Você está me ouvindo?", when: "Checando áudio" },
      { en: "Sorry, I didn't catch that.", pt: "Desculpa, não peguei.", when: "Não entendeu" },
      { en: "You're breaking up.", pt: "Está cortando.", when: "Sinal ruim" },
      { en: "Let me call you back.", pt: "Deixa eu te ligar de volta.", when: "Reagendando" },
      { en: "Could you repeat the last part?", pt: "Pode repetir a última parte?", when: "Pedido específico" },
      { en: "Thanks, talk soon!", pt: "Valeu, falamos em breve!", when: "Encerrando" },
    ],
    mission: "Grave uma ligação simulada com 3 problemas de áudio e como você resolve cada um.",
    mindset:
      "Ninguém entende 100% no telefone — nem nativo. A habilidade não é entender tudo: é seguir mesmo sem entender tudo.",
    pitfall:
      "Ficar em silêncio quando não entende numa call. Diga 'Sorry, I didn't catch that' — é o que o nativo diria.",
  },
  {
    number: 25,
    title: "Explicando um problema",
    situation:
      "Algo quebrou, atrasou, veio errado. Você precisa explicar o que houve com clareza e sem rodeio.",
    pattern: "There's a problem with ___ .",
    patternNote: "Molde neutro de abertura de problema. Firme sem ser hostil.",
    chunks: [
      { en: "There's a problem with my order.", pt: "Tem um problema com meu pedido.", when: "Abrindo" },
      { en: "It's not working properly.", pt: "Não está funcionando direito.", when: "Defeito" },
      { en: "It arrived damaged.", pt: "Chegou danificado.", when: "Entrega errada" },
      { en: "I've been waiting for two weeks.", pt: "Estou esperando há duas semanas.", when: "Atraso" },
      { en: "What can we do about it?", pt: "O que podemos fazer?", when: "Buscando solução" },
      { en: "I'd like a refund, please.", pt: "Eu gostaria de um reembolso, por favor.", when: "Pedindo solução" },
      { en: "Who should I talk to?", pt: "Com quem devo falar?", when: "Escalando" },
    ],
    mission: "Grave uma reclamação completa de 90 segundos sobre um produto que veio errado.",
    mindset:
      "Reclamar em inglês exige firmeza sem agressividade. O meio-termo assertivo é o padrão anglófono — e ele se aprende por bloco.",
    pitfall:
      "Alternar entre passividade excessiva e agressividade. O inglês tem um registro assertivo bem definido no meio.",
  },
  {
    number: 26,
    title: "Fechando o Segundo Canto",
    situation:
      "Uma conversa longa e sem roteiro: passado, presente, futuro, opinião e reação — tudo misturado, como na vida.",
    pattern: "Todos os moldes dos circuitos 14–25",
    patternNote: "Sem novidade. Hoje é trocar de tempo verbal no meio da fala sem parar para pensar.",
    chunks: [
      { en: "How was your weekend?", pt: "Passado", when: "Circuito 14" },
      { en: "I used to ___ .", pt: "Passado habitual", when: "Circuito 16" },
      { en: "I'm going to ___ .", pt: "Futuro", when: "Circuito 17" },
      { en: "I see your point, but ___ .", pt: "Opinião", when: "Circuito 19" },
      { en: "I'm so sorry to hear that.", pt: "Reação", when: "Circuito 21" },
      { en: "Sorry, I didn't catch that.", pt: "Socorro", when: "Circuito 24" },
      { en: "There's a problem with ___ .", pt: "Problema", when: "Circuito 25" },
    ],
    mission: "Converse 10 minutos com a tutora de IA sem roteiro. Só assunto livre.",
    mindset:
      "Metade do caminho. Você fala de passado, presente e futuro sem consultar tabela. Isso é fluência em formação.",
    pitfall:
      "Travar ao trocar de tempo verbal no meio da frase. A revisão de hoje existe para automatizar essa troca.",
  },

  // ------------------------------------------------ TERCEIRO CANTO (27–39)
  {
    number: 27,
    title: "O que você faz da vida",
    situation:
      "Networking, entrevista, jantar de negócios. Explicar seu trabalho para quem não é da sua área.",
    pattern: "I'm in charge of ___ .",
    patternNote: "Molde de responsabilidade profissional. Direto e reconhecível em qualquer setor.",
    chunks: [
      { en: "I work in marketing.", pt: "Eu trabalho com marketing.", when: "Área" },
      { en: "I'm in charge of the sales team.", pt: "Sou responsável pelo time de vendas.", when: "Responsabilidade" },
      { en: "Basically, I help companies ___ .", pt: "Basicamente, eu ajudo empresas a ___ .", when: "Explicando sem jargão" },
      { en: "I've been doing this for five years.", pt: "Faço isso há cinco anos.", when: "Tempo de casa" },
      { en: "It's challenging but rewarding.", pt: "É desafiador mas gratificante.", when: "Avaliando o trabalho" },
      { en: "What line of work are you in?", pt: "Você trabalha com o quê?", when: "Devolvendo" },
      { en: "That sounds interesting.", pt: "Parece interessante.", when: "Reagindo" },
    ],
    mission: "Grave 60 segundos explicando seu trabalho para uma criança de 10 anos.",
    mindset:
      "Quem explica o próprio trabalho de forma simples em inglês passa credibilidade. Jargão não impressiona ninguém.",
    pitfall:
      "'Actually' não é 'atualmente' — significa 'na verdade'. Atualmente é 'currently'. Falso cognato caríssimo.",
  },
  {
    number: 28,
    title: "Sua experiência",
    situation:
      "'Have you ever...?' — a pergunta que abre entrevista, jantar e conversa de bar.",
    pattern: "I've never ___ , but I'd like to.",
    patternNote:
      "Experiência de vida sem dizer quando. É o único uso de 'present perfect' que você realmente precisa agora.",
    chunks: [
      { en: "Have you ever been to Europe?", pt: "Você já foi à Europa?", when: "Perguntando experiência" },
      { en: "I've been there twice.", pt: "Já estive lá duas vezes.", when: "Confirmando" },
      { en: "I've never tried that.", pt: "Nunca experimentei isso.", when: "Negando" },
      { en: "I've always wanted to.", pt: "Sempre quis.", when: "Desejo antigo" },
      { en: "I've worked here since 2020.", pt: "Trabalho aqui desde 2020.", when: "Duração até hoje" },
      { en: "It's the best I've ever had.", pt: "É o melhor que já provei.", when: "Superlativo de experiência" },
      { en: "How about you?", pt: "E você?", when: "Devolvendo" },
    ],
    mission: "Grave respostas a 8 perguntas 'Have you ever...?' com detalhe em cada uma.",
    mindset:
      "Você não precisa entender a regra do present perfect. Precisa que 'I've never' saia sem pensar. Bloco antes de regra.",
    pitfall:
      "'I work here for 3 years' — em inglês, algo que começou antes e continua pede 'I've worked here for 3 years'.",
  },
  {
    number: 29,
    title: "Entrevista de emprego",
    situation:
      "Simulação real: fale de você, do seu maior desafio, do seu ponto fraco. As perguntas são sempre as mesmas.",
    pattern: "One of my strengths is ___ .",
    patternNote: "Molde de autoavaliação. Funciona para força, fraqueza e conquista.",
    chunks: [
      { en: "Tell me about yourself.", pt: "Fale sobre você.", when: "A primeira pergunta, sempre" },
      { en: "One of my strengths is problem-solving.", pt: "Um dos meus pontos fortes é resolver problemas.", when: "Força" },
      { en: "I'm working on being more patient.", pt: "Estou trabalhando para ser mais paciente.", when: "Fraqueza bem colocada" },
      { en: "In my last role, I ___ .", pt: "No meu último cargo, eu ___ .", when: "Experiência" },
      { en: "I graduated in 2018.", pt: "Me formei em 2018.", when: "Formação" },
      { en: "I'm looking for a new challenge.", pt: "Estou buscando um novo desafio.", when: "Motivação" },
      { en: "Do you have any questions for me?", pt: "Você tem perguntas para mim?", when: "O fim da entrevista" },
    ],
    mission: "Grave uma entrevista completa de 3 minutos respondendo as 5 perguntas clássicas.",
    mindset:
      "Entrevista em inglês se ganha no ensaio. Grave, ouça, regrave. Ninguém improvisa isso bem na primeira vez.",
    pitfall:
      "'I formed myself in 2018' — tradução literal de 'me formei'. É 'I graduated'.",
  },
  {
    number: 30,
    title: "Reunião de trabalho",
    situation:
      "Você precisa entrar na conversa, discordar do chefe e propor algo — sem parecer rude e sem sumir.",
    pattern: "Can I jump in here?",
    patternNote: "Como interromper sem ofender. É um bloco fixo, não se improvisa.",
    chunks: [
      { en: "Can I jump in here?", pt: "Posso entrar aqui?", when: "Interrompendo com educação" },
      { en: "Just to be clear...", pt: "Só para deixar claro...", when: "Confirmando entendimento" },
      { en: "I'd like to add something.", pt: "Eu gostaria de acrescentar algo.", when: "Contribuindo" },
      { en: "Let's move on to the next point.", pt: "Vamos para o próximo ponto.", when: "Conduzindo" },
      { en: "Can we come back to that later?", pt: "Podemos voltar nisso depois?", when: "Adiando" },
      { en: "So, what are the next steps?", pt: "Então, quais são os próximos passos?", when: "Fechando" },
      { en: "I'll follow up by email.", pt: "Eu mando um e-mail depois.", when: "Encerrando com ação" },
    ],
    mission: "Grave sua participação em uma reunião: interrompa, contribua e proponha um próximo passo.",
    mindset:
      "Silêncio em reunião é lido como falta de opinião, não como timidez. Um bloco bem colocado muda sua imagem.",
    pitfall:
      "Interromper com 'Excuse me!' alto. Existe fórmula suave: 'Can I jump in here?' ou 'Sorry, just one thing...'.",
  },
  {
    number: 31,
    title: "No aeroporto",
    situation:
      "Check-in, imigração, conexão perdida. Alta pressão, pouco tempo, ninguém repete duas vezes.",
    pattern: "Could you tell me where ___ is?",
    patternNote:
      "Pergunta indireta: mais educada e — atenção — mantém a ordem afirmativa depois do 'where'.",
    chunks: [
      { en: "Could you tell me where gate 12 is?", pt: "Pode me dizer onde fica o portão 12?", when: "Localizando" },
      { en: "I'm here on vacation.", pt: "Estou aqui a passeio.", when: "Imigração" },
      { en: "I'll be staying for two weeks.", pt: "Vou ficar duas semanas.", when: "Imigração" },
      { en: "I have nothing to declare.", pt: "Não tenho nada a declarar.", when: "Alfândega" },
      { en: "I missed my connection.", pt: "Perdi minha conexão.", when: "Problema" },
      { en: "What's the next available flight?", pt: "Qual o próximo voo disponível?", when: "Resolvendo" },
      { en: "Where can I pick up my luggage?", pt: "Onde pego minha bagagem?", when: "Chegada" },
    ],
    mission: "Grave a passagem completa pela imigração respondendo às 5 perguntas padrão.",
    mindset:
      "No aeroporto você não escolhe o assunto nem o ritmo. Por isso ensaia antes — o bloco pronto é o que salva.",
    pitfall:
      "'Could you tell me where is the gate?' — em pergunta indireta a ordem é afirmativa: 'where the gate is'.",
  },
  {
    number: 32,
    title: "Hotel e hospedagem",
    situation:
      "Check-in, quarto com problema, pedido especial, check-out. Uma semana de viagem passa por isso todo dia.",
    pattern: "Would it be possible to ___ ?",
    patternNote: "Pedido de alta educação. Abre portas que 'can I' não abre.",
    chunks: [
      { en: "I have a reservation under Silva.", pt: "Tenho uma reserva no nome Silva.", when: "Check-in" },
      { en: "Would it be possible to get a late check-out?", pt: "Seria possível fazer o check-out mais tarde?", when: "Pedido especial" },
      { en: "The air conditioning isn't working.", pt: "O ar-condicionado não está funcionando.", when: "Problema no quarto" },
      { en: "Could I change rooms?", pt: "Eu poderia trocar de quarto?", when: "Solução" },
      { en: "Is breakfast included?", pt: "O café da manhã está incluso?", when: "Checando" },
      { en: "What time is check-out?", pt: "Que horas é o check-out?", when: "Organizando saída" },
      { en: "Could you call me a taxi?", pt: "Pode chamar um táxi para mim?", when: "Saindo" },
    ],
    mission:
      "Grave um check-in completo + uma reclamação de quarto + a negociação da solução.",
    mindset:
      "'Would it be possible to' é o bloco mais rentável da viagem. Ele consegue upgrade, desconto e exceção.",
    pitfall:
      "Reclamar com imperativo: 'Fix it now'. Soa hostil e fecha porta. 'Would it be possible to...' resolve mais.",
  },
  {
    number: 33,
    title: "Saúde e emergência",
    situation:
      "Você passou mal fora do país. Precisa explicar o sintoma, entender a orientação e resolver o seguro.",
    pattern: "I have a ___ .",
    patternNote: "Sintoma em inglês é 'ter', não 'estar com'. Molde curto e vital.",
    chunks: [
      { en: "I don't feel well.", pt: "Não estou me sentindo bem.", when: "Abrindo" },
      { en: "I have a headache.", pt: "Estou com dor de cabeça.", when: "Sintoma" },
      { en: "It hurts here.", pt: "Dói aqui.", when: "Apontando" },
      { en: "I'm allergic to penicillin.", pt: "Sou alérgico a penicilina.", when: "Informação crítica" },
      { en: "Do I need a prescription?", pt: "Preciso de receita?", when: "Farmácia" },
      { en: "Does my insurance cover this?", pt: "Meu seguro cobre isso?", when: "Financeiro" },
      { en: "I need to see a doctor.", pt: "Preciso ver um médico.", when: "Urgência" },
    ],
    mission: "Grave uma consulta médica completa: sintomas, duração, alergias e dúvidas.",
    mindset:
      "Este é o circuito que você espera nunca usar — e é exatamente por isso que precisa estar automático.",
    pitfall:
      "'I am with pain' — tradução literal. É 'I'm in pain' ou 'It hurts'.",
  },
  {
    number: 34,
    title: "Reclamando e resolvendo",
    situation:
      "Cobrança indevida, serviço ruim, produto errado. Você precisa de firmeza, não de agressividade.",
    pattern: "I'm afraid there's been a mistake.",
    patternNote:
      "'I'm afraid' é o amortecedor britânico: anuncia problema sem hostilidade. Alto retorno.",
    chunks: [
      { en: "I'm afraid there's been a mistake.", pt: "Receio que houve um engano.", when: "Abrindo firme e educado" },
      { en: "I was charged twice.", pt: "Fui cobrado duas vezes.", when: "Cobrança" },
      { en: "This isn't what I ordered.", pt: "Não foi isso que eu pedi.", when: "Pedido errado" },
      { en: "I'd like to speak to a manager.", pt: "Gostaria de falar com um gerente.", when: "Escalando" },
      { en: "This is unacceptable.", pt: "Isso é inaceitável.", when: "Quando precisa endurecer" },
      { en: "What can you do to fix this?", pt: "O que vocês podem fazer para resolver?", when: "Exigindo solução" },
      { en: "I appreciate your help.", pt: "Agradeço sua ajuda.", when: "Fechando bem" },
    ],
    mission: "Grave uma reclamação por telefone que escala até o gerente e termina resolvida.",
    mindset:
      "Firmeza e educação não são opostos em inglês. Os blocos de hoje entregam os dois ao mesmo tempo.",
    pitfall:
      "Pedir desculpa por reclamar. Você não está incomodando: está resolvendo. 'I'm afraid' já é a cortesia suficiente.",
  },
  {
    number: 35,
    title: "Dando conselho",
    situation:
      "Alguém te conta um problema e espera sua opinião. Aconselhar sem soar arrogante tem molde próprio.",
    pattern: "If I were you, I'd ___ .",
    patternNote:
      "O conselho hipotético mais usado do inglês. 'Were' mesmo com 'I' — é assim e ponto.",
    chunks: [
      { en: "If I were you, I'd talk to her.", pt: "Se eu fosse você, eu falaria com ela.", when: "Conselho direto" },
      { en: "You should probably wait.", pt: "Você provavelmente deveria esperar.", when: "Conselho suave" },
      { en: "Have you thought about ___ ?", pt: "Você já pensou em ___ ?", when: "Sugerindo sem impor" },
      { en: "It might be worth trying.", pt: "Pode valer a pena tentar.", when: "Sugestão leve" },
      { en: "That's up to you.", pt: "Isso é você quem decide.", when: "Devolvendo a escolha" },
      { en: "Whatever you decide, I support you.", pt: "Decida o que decidir, eu apoio.", when: "Fechando com apoio" },
      { en: "What do you think you'll do?", pt: "O que você acha que vai fazer?", when: "Devolvendo" },
    ],
    mission: "Grave conselhos para 4 dilemas diferentes usando 4 moldes diferentes.",
    mindset:
      "'If I were you' é gramática avançada que você vai usar sem nunca ter estudado a regra. É assim que deve ser.",
    pitfall:
      "'If I was you' — em conselho hipotético o inglês pede 'were' para todas as pessoas.",
  },
  {
    number: 36,
    title: "Arrependimento e o que faria diferente",
    situation:
      "Conversa madura sobre escolhas: o emprego que recusou, a viagem que não fez, o que faria diferente.",
    pattern: "I should have ___ .",
    patternNote:
      "Arrependimento em um molde só. Na fala vira 'should've' — treine o som, não a escrita.",
    chunks: [
      { en: "I should have taken that job.", pt: "Eu deveria ter aceitado aquele emprego.", when: "Arrependimento" },
      { en: "I wish I had studied more.", pt: "Eu queria ter estudado mais.", when: "Desejo sobre o passado" },
      { en: "Looking back, it was the right call.", pt: "Olhando para trás, foi a decisão certa.", when: "Sem arrependimento" },
      { en: "If I'd known, I would have ___ .", pt: "Se eu soubesse, teria ___ .", when: "Hipótese passada" },
      { en: "I don't regret it.", pt: "Eu não me arrependo.", when: "Assumindo a escolha" },
      { en: "Everything happens for a reason.", pt: "Tudo acontece por um motivo.", when: "Fechando" },
      { en: "Do you regret anything?", pt: "Você se arrepende de algo?", when: "Devolvendo" },
    ],
    mission: "Grave 90 segundos sobre uma decisão que você tomaria diferente e o porquê.",
    mindset:
      "Você está falando de hipótese no passado em inglês. Trinta e seis semanas atrás você não dizia 'oi'.",
    pitfall:
      "Escrever 'should of' porque soa igual a 'should've'. Na fala tanto faz; na escrita denuncia.",
  },
  {
    number: 37,
    title: "Relatando o que disseram",
    situation:
      "Passar recado, contar o que o chefe falou, resumir uma conversa. Uso diário no trabalho.",
    pattern: "He said that he ___ .",
    patternNote:
      "Ao relatar, o tempo verbal recua um passo. Você não precisa da regra: precisa do molde na ponta da língua.",
    chunks: [
      { en: "She said she was busy.", pt: "Ela disse que estava ocupada.", when: "Relato simples" },
      { en: "He told me to wait.", pt: "Ele me disse para esperar.", when: "Instrução relatada" },
      { en: "They mentioned something about ___ .", pt: "Eles mencionaram algo sobre ___ .", when: "Relato vago" },
      { en: "According to her, ___ .", pt: "Segundo ela, ___ .", when: "Atribuindo fonte" },
      { en: "I heard that ___ .", pt: "Ouvi dizer que ___ .", when: "Boato" },
      { en: "She asked if I could help.", pt: "Ela perguntou se eu podia ajudar.", when: "Pergunta relatada" },
      { en: "That's what I was told.", pt: "Foi o que me disseram.", when: "Se protegendo" },
    ],
    mission: "Grave o relato de uma conversa real que você teve esta semana.",
    mindset:
      "Relatar é o que mais aparece no trabalho e o que menos se treina em curso. Hoje você resolve isso.",
    pitfall:
      "Esquecer o recuo: 'He said he is tired' vira 'He said he was tired'. O bloco já vem recuado.",
  },
  {
    number: 38,
    title: "Negociando",
    situation:
      "Prazo impossível, preço alto, escopo crescendo. Negociar em inglês sem ceder tudo nem travar tudo.",
    pattern: "Would you be open to ___ ?",
    patternNote: "Abertura de negociação sem confronto. Convida em vez de exigir.",
    chunks: [
      { en: "Would you be open to a different timeline?", pt: "Você estaria aberto a outro prazo?", when: "Abrindo" },
      { en: "That's a bit outside our budget.", pt: "Isso está um pouco fora do nosso orçamento.", when: "Preço" },
      { en: "Could we meet halfway?", pt: "Podemos chegar num meio-termo?", when: "Buscando acordo" },
      { en: "That's a deal breaker for us.", pt: "Isso é impeditivo para nós.", when: "Limite" },
      { en: "Let me check and get back to you.", pt: "Deixa eu verificar e te retorno.", when: "Ganhando tempo" },
      { en: "I think we can work with that.", pt: "Acho que dá para trabalhar com isso.", when: "Aceitando" },
      { en: "Sounds like we have a deal.", pt: "Parece que temos um acordo.", when: "Fechando" },
    ],
    mission: "Grave uma negociação de prazo: receba um pedido impossível e chegue a um meio-termo.",
    mindset:
      "Em negociação, o bloco certo vale mais que vocabulário grande. Poucas frases, muito bem colocadas.",
    pitfall:
      "Dizer 'no' direto. Em negociação anglófona, 'that's a bit outside our budget' recusa e mantém a porta aberta.",
  },
  {
    number: 39,
    title: "Fechando o Terceiro Canto",
    situation:
      "Um dia caótico simulado: problema no hotel, ligação difícil, reunião tensa e uma negociação. Tudo em inglês.",
    pattern: "Todos os moldes dos circuitos 27–38",
    patternNote: "Hoje é sobre resolver sob pressão, sem tempo de pensar na estrutura.",
    chunks: [
      { en: "I'm in charge of ___ .", pt: "Trabalho", when: "Circuito 27" },
      { en: "Have you ever ___ ?", pt: "Experiência", when: "Circuito 28" },
      { en: "Can I jump in here?", pt: "Reunião", when: "Circuito 30" },
      { en: "Would it be possible to ___ ?", pt: "Pedido educado", when: "Circuito 32" },
      { en: "I'm afraid there's been a mistake.", pt: "Reclamação", when: "Circuito 34" },
      { en: "If I were you, I'd ___ .", pt: "Conselho", when: "Circuito 35" },
      { en: "Would you be open to ___ ?", pt: "Negociação", when: "Circuito 38" },
    ],
    mission: "Resolva 4 problemas seguidos com a tutora, sem pausa entre eles.",
    mindset:
      "Você resolve problema em inglês. Isso é o que separa quem 'estudou inglês' de quem usa inglês.",
    pitfall: "Voltar ao português mental sob pressão. A pressão é o treino.",
  },

  // ------------------------------------------------ QUARTO CANTO (40–52)
  {
    number: 40,
    title: "Phrasal verbs do dia a dia",
    situation:
      "O nativo não diz 'I awoke'. Diz 'I got up'. Sem phrasal verb você entende o livro e não entende a pessoa.",
    pattern: "___ up / out / off / on",
    patternNote:
      "A partícula muda tudo. 'Give up' é desistir; 'give out' é distribuir. Decore o par, nunca o verbo sozinho.",
    chunks: [
      { en: "I need to figure this out.", pt: "Preciso descobrir isso.", when: "Resolver" },
      { en: "Let's catch up soon!", pt: "Vamos colocar o papo em dia!", when: "Social" },
      { en: "I ran into an old friend.", pt: "Encontrei um velho amigo por acaso.", when: "Encontro casual" },
      { en: "Don't give up.", pt: "Não desista.", when: "Encorajando" },
      { en: "I'll pick you up at eight.", pt: "Te busco às oito.", when: "Combinando" },
      { en: "Something came up.", pt: "Surgiu um imprevisto.", when: "Desmarcando" },
      { en: "I'm looking forward to it.", pt: "Estou ansioso por isso.", when: "Expectativa" },
    ],
    mission: "Reconte seu dia usando pelo menos 8 phrasal verbs.",
    mindset:
      "Phrasal verb não se deduz — se decora em bloco. Aceite isso e você economiza meses.",
    pitfall:
      "Separar o que não separa: 'I ran my friend into' está errado. 'Run into' é inseparável.",
  },
  {
    number: 41,
    title: "As palavras que andam juntas",
    situation:
      "Você escolhe o verbo errado e a frase soa estrangeira mesmo estando 'correta'. Isso é colocação.",
    pattern: "make / do / take / have + ___",
    patternNote:
      "Não há lógica: 'make a decision' e 'do research' simplesmente andam assim. Decore o par.",
    chunks: [
      { en: "I need to make a decision.", pt: "Preciso tomar uma decisão.", when: "make, não do" },
      { en: "Let's take a break.", pt: "Vamos fazer uma pausa.", when: "take, não make" },
      { en: "Can I have a look?", pt: "Posso dar uma olhada?", when: "have, não give" },
      { en: "I did some research.", pt: "Fiz uma pesquisa.", when: "do, não make" },
      { en: "Let's get in touch next week.", pt: "Vamos entrar em contato semana que vem.", when: "get in touch" },
      { en: "Keep that in mind.", pt: "Tenha isso em mente.", when: "keep in mind" },
      { en: "Pay attention to this part.", pt: "Preste atenção nessa parte.", when: "pay attention" },
    ],
    mission: "Descreva um projeto de trabalho usando 8 colocações corretas.",
    mindset:
      "Colocação é o que faz você soar natural. É pura memorização de bloco — e por isso é rápida.",
    pitfall:
      "'Make a course' (é 'take a course'), 'do a decision' (é 'make a decision'). Sem lógica, só uso.",
  },
  {
    number: 42,
    title: "Fala grudada",
    situation:
      "O nativo não fala palavra por palavra. Ele gruda tudo: 'whaddaya wanna do?' Se você espera espaços, não entende nada.",
    pattern: "gonna / wanna / gotta",
    patternNote:
      "Não é preguiça nem gíria: é como o inglês é falado. Você precisa ENTENDER — usar é opcional.",
    chunks: [
      { en: "What are you gonna do?", pt: "O que você vai fazer?", when: "going to → gonna" },
      { en: "I wanna try that.", pt: "Quero tentar isso.", when: "want to → wanna" },
      { en: "I've gotta go.", pt: "Tenho que ir.", when: "have got to → gotta" },
      { en: "Whatcha doing?", pt: "O que você tá fazendo?", when: "what are you → whatcha" },
      { en: "Lemme know.", pt: "Me avisa.", when: "let me → lemme" },
      { en: "Kinda tired today.", pt: "Meio cansado hoje.", when: "kind of → kinda" },
      { en: "Dunno, honestly.", pt: "Não sei, sinceramente.", when: "don't know → dunno" },
    ],
    mission:
      "Ouça 3 minutos de podcast em velocidade real, transcreva um trecho e imite o ritmo gravando.",
    mindset:
      "Se você entende texto e não entende fala, o problema não é vocabulário: é ritmo. Este circuito resolve.",
    pitfall:
      "Pronunciar cada palavra separada e com força igual. O inglês tem sílabas fortes e fracas — o resto some.",
  },
  {
    number: 43,
    title: "Expressões que ninguém traduz",
    situation:
      "'It's a piece of cake', 'let's call it a day'. Traduzir ao pé da letra vira nonsense.",
    pattern: "Idioms de alta frequência",
    patternNote: "Bloco fechado: não se altera, não se traduz, não se deduz.",
    chunks: [
      { en: "It's a piece of cake.", pt: "É moleza.", when: "Algo fácil" },
      { en: "Let's call it a day.", pt: "Vamos parar por hoje.", when: "Encerrando trabalho" },
      { en: "I'm feeling under the weather.", pt: "Estou meio adoentado.", when: "Não muito bem" },
      { en: "Let's break the ice.", pt: "Vamos quebrar o gelo.", when: "Início social" },
      { en: "We're on the same page.", pt: "Estamos alinhados.", when: "Concordância" },
      { en: "It's not rocket science.", pt: "Não é nenhum bicho de sete cabeças.", when: "Simplificando" },
      { en: "Let's play it by ear.", pt: "Vamos ver como as coisas vão.", when: "Sem plano fixo" },
    ],
    mission: "Conte uma história de 2 minutos usando 5 expressões idiomáticas naturalmente.",
    mindset:
      "Idiom mal colocado soa pior que idiom nenhum. Use só os que você já ouviu em contexto real.",
    pitfall:
      "Usar idiom em registro errado — 'piece of cake' numa apresentação formal soa deslocado.",
  },
  {
    number: 44,
    title: "Formal ou informal",
    situation:
      "A mesma mensagem para o chefe e para o amigo. Errar o registro é errar mais que errar gramática.",
    pattern: "Mesma ideia, dois registros",
    patternNote: "Cada bloco vem em par: a versão de e-mail e a versão de WhatsApp.",
    chunks: [
      { en: "I'd like to request a meeting. / Wanna meet up?", pt: "Formal / informal", when: "Convite" },
      { en: "I apologize for the delay. / Sorry I'm late!", pt: "Formal / informal", when: "Desculpa" },
      { en: "Could you please confirm? / Can you confirm?", pt: "Formal / informal", when: "Pedido" },
      { en: "Thank you for your time. / Thanks!", pt: "Formal / informal", when: "Agradecimento" },
      { en: "I'm afraid I can't attend. / Can't make it, sorry!", pt: "Formal / informal", when: "Recusa" },
      { en: "Please find attached. / Here's the file.", pt: "Formal / informal", when: "Anexo" },
      { en: "Best regards, / Cheers,", pt: "Formal / informal", when: "Assinatura" },
    ],
    mission: "Escreva a mesma mensagem duas vezes — para o chefe e para o amigo — e leia as duas em voz alta.",
    mindset:
      "Registro é o último degrau. Quem acerta o tom passa por fluente mesmo errando gramática.",
    pitfall:
      "'Dear Sir' num e-mail casual soa datado e distante. Ajuste o tom ao contexto, não ao livro.",
  },
  {
    number: 45,
    title: "Apresentando em público",
    situation:
      "Cinco minutos, uma tela, uma plateia. Estruturar e entregar sem ler o slide.",
    pattern: "Let me walk you through ___ .",
    patternNote: "Sinalizador de estrutura. Avisa a plateia para onde você vai — e te dá tempo.",
    chunks: [
      { en: "Let me walk you through the numbers.", pt: "Deixem-me apresentar os números.", when: "Abrindo seção" },
      { en: "First of all...", pt: "Antes de mais nada...", when: "Primeiro ponto" },
      { en: "As you can see here...", pt: "Como vocês podem ver aqui...", when: "Apontando o slide" },
      { en: "This brings me to my next point.", pt: "Isso me leva ao próximo ponto.", when: "Transição" },
      { en: "In a nutshell...", pt: "Em resumo...", when: "Sintetizando" },
      { en: "The key takeaway is ___ .", pt: "A principal conclusão é ___ .", when: "Fechando forte" },
      { en: "I'd be happy to take questions.", pt: "Fico à disposição para perguntas.", when: "Encerrando" },
    ],
    mission: "Grave uma apresentação de 3 minutos sobre um projeto seu, com abertura e fechamento.",
    mindset:
      "Apresentação em inglês se ganha na estrutura, não no vocabulário. Sinalize e a plateia te acompanha.",
    pitfall:
      "Ler o slide em voz alta. A plateia lê mais rápido que você fala — sinalize e comente, não leia.",
  },
  {
    number: 46,
    title: "Feedback difícil",
    situation:
      "Dizer a alguém que o trabalho não ficou bom — sem destruir a pessoa nem amaciar até virar elogio.",
    pattern: "One thing I'd suggest is ___ .",
    patternNote: "Feedback amortecido: crítica embrulhada em sugestão. É o padrão anglófono.",
    chunks: [
      { en: "I really liked the ___ part.", pt: "Gostei bastante da parte ___ .", when: "Abrindo pelo positivo" },
      { en: "One thing I'd suggest is ___ .", pt: "Uma coisa que eu sugeriria é ___ .", when: "A crítica" },
      { en: "There's room for improvement here.", pt: "Há espaço para melhorar aqui.", when: "Apontando problema" },
      { en: "Have you considered ___ ?", pt: "Você considerou ___ ?", when: "Sugerindo sem impor" },
      { en: "That said, overall it's solid.", pt: "Dito isso, no geral está sólido.", when: "Reequilibrando" },
      { en: "Thanks for the feedback.", pt: "Obrigado pelo feedback.", when: "Recebendo" },
      { en: "I'll take that on board.", pt: "Vou levar isso em conta.", when: "Aceitando crítica" },
    ],
    mission: "Grave um feedback difícil completo: elogio, crítica, sugestão e fechamento.",
    mindset:
      "Feedback direto demais soa hostil em inglês; indireto demais não comunica nada. O molde acerta o meio.",
    pitfall:
      "Traduzir a franqueza brasileira direto. 'This is bad' fecha a conversa. 'There's room for improvement' abre.",
  },
  {
    number: 47,
    title: "Humor e ironia",
    situation:
      "A piada passou e todo mundo riu menos você. Humor é o último território da fluência.",
    pattern: "Sarcasmo pelo tom, não pela palavra",
    patternNote:
      "Em inglês a ironia mora na entonação. A mesma frase é elogio ou deboche dependendo da melodia.",
    chunks: [
      { en: "Oh, great. Just what I needed.", pt: "Ah, ótimo. Era só o que faltava.", when: "Sarcasmo" },
      { en: "You're kidding me!", pt: "Você tá brincando!", when: "Surpresa" },
      { en: "No way!", pt: "Não acredito!", when: "Descrença" },
      { en: "I'm just messing with you.", pt: "Tô só brincando com você.", when: "Desfazendo a brincadeira" },
      { en: "Very funny.", pt: "Muito engraçado. (irônico)", when: "Ironia seca" },
      { en: "That's rough.", pt: "Que barra.", when: "Solidariedade casual" },
      { en: "Fair point.", pt: "Ponto justo.", when: "Reconhecendo" },
    ],
    mission:
      "Grave a mesma frase 3 vezes: sincera, irônica e brincalhona. Ouça a diferença de entonação.",
    mindset:
      "Entender humor é o sinal mais honesto de fluência. Se você riu junto, você chegou.",
    pitfall:
      "Ler ironia como sinceridade. Quando a frase for elogiosa demais para o contexto, provavelmente é sarcasmo.",
  },
  {
    number: 48,
    title: "Conversa longa sem roteiro",
    situation:
      "Um jantar de duas horas em inglês. Sem tópico, sem preparo, sem escapatória.",
    pattern: "Estratégias de turno",
    patternNote:
      "Manter conversa não é saber muito: é ter blocos para ganhar tempo, mudar de assunto e devolver a bola.",
    chunks: [
      { en: "That reminds me of something.", pt: "Isso me lembra uma coisa.", when: "Emendando assunto" },
      { en: "Speaking of which...", pt: "Falando nisso...", when: "Transição natural" },
      { en: "How did that go?", pt: "E como foi isso?", when: "Aprofundando" },
      { en: "Let me think for a second.", pt: "Deixa eu pensar um segundo.", when: "Ganhando tempo" },
      { en: "Anyway, what were you saying?", pt: "Enfim, o que você estava dizendo?", when: "Retomando" },
      { en: "By the way, did you hear about ___ ?", pt: "A propósito, você soube de ___ ?", when: "Novo tópico" },
      { en: "It's been great talking to you.", pt: "Foi ótimo conversar com você.", when: "Encerrando" },
    ],
    mission: "Converse 10 minutos seguidos com a tutora, sem tópico definido e sem pausa longa.",
    mindset:
      "Ganhar tempo em inglês é habilidade, não trapaça. Nativo faz o tempo todo com 'let me think'.",
    pitfall:
      "Deixar o silêncio se instalar enquanto procura a palavra. Use um bloco de tempo e siga.",
  },
  {
    number: 49,
    title: "Pensando em inglês",
    situation:
      "Parar de traduzir na cabeça. É a virada que transforma esforço em automatismo.",
    pattern: "Narração interna",
    patternNote:
      "Sem molde novo: o exercício é substituir o monólogo interno em português pelo inglês, o dia inteiro.",
    chunks: [
      { en: "What am I doing right now?", pt: "O que estou fazendo agora?", when: "Narrando o presente" },
      { en: "I need to remember to ___ .", pt: "Preciso lembrar de ___ .", when: "Lembrete interno" },
      { en: "Where did I put my ___ ?", pt: "Onde coloquei meu ___ ?", when: "Procurando" },
      { en: "That doesn't make sense.", pt: "Isso não faz sentido.", when: "Julgamento interno" },
      { en: "Let me try that again.", pt: "Deixa eu tentar de novo.", when: "Recomeçando" },
      { en: "Almost there.", pt: "Quase lá.", when: "Progresso" },
      { en: "I've got this.", pt: "Eu dou conta.", when: "Autoconfiança" },
    ],
    mission: "Passe 2 horas do seu dia narrando internamente tudo em inglês. Depois grave como foi.",
    mindset:
      "Tradução mental é a última muleta a cair. Ela cai por uso, não por estudo.",
    pitfall:
      "Voltar ao português quando não sabe a palavra. Contorne: descreva com o que você já tem.",
  },
  {
    number: 50,
    title: "Sotaques do mundo",
    situation:
      "Inglês não é só americano. Indiano, escocês, australiano, nigeriano. O mundo real é multissotaque.",
    pattern: "Mesmo bloco, sotaques diferentes",
    patternNote: "Os blocos são conhecidos. O treino é de ouvido, não de estrutura.",
    chunks: [
      { en: "Sorry, could you repeat that?", pt: "Bloco universal de socorro", when: "Vale em qualquer sotaque" },
      { en: "Where are you from originally?", pt: "De onde você é originalmente?", when: "Puxando assunto" },
      { en: "I love your accent!", pt: "Adoro seu sotaque!", when: "Elogio que abre porta" },
      { en: "Bear with me, I'm still learning.", pt: "Tenha paciência, ainda estou aprendendo.", when: "Pedindo tempo" },
      { en: "Did I get that right?", pt: "Entendi certo?", when: "Confirmando" },
      { en: "I'm not familiar with that expression.", pt: "Não conheço essa expressão.", when: "Regionalismo" },
      { en: "That's a new one for me!", pt: "Essa é nova para mim!", when: "Reagindo com leveza" },
    ],
    mission:
      "Ouça o mesmo assunto em 3 sotaques diferentes e grave um resumo do que entendeu de cada.",
    mindset:
      "Seu sotaque brasileiro não é defeito — é identidade. O objetivo é ser entendido, não virar americano.",
    pitfall:
      "Achar que só o sotaque americano é 'certo'. A maioria das conversas em inglês no mundo é entre não nativos.",
  },
  {
    number: 51,
    title: "Revisão viva do ano",
    situation:
      "Todos os 50 circuitos misturados, sem aviso. Cada dia desta semana simula uma situação diferente.",
    pattern: "Todos os moldes do curso",
    patternNote: "Nada novo. Só recuperação sob pressão — que é como a memória se consolida de verdade.",
    chunks: [
      { en: "Can I have ___ , please?", pt: "Pedido", when: "Circuito 4" },
      { en: "How was your weekend?", pt: "Passado", when: "Circuito 14" },
      { en: "I'm going to ___ .", pt: "Futuro", when: "Circuito 17" },
      { en: "I see your point, but ___ .", pt: "Opinião", when: "Circuito 19" },
      { en: "I'm afraid there's been a mistake.", pt: "Problema", when: "Circuito 34" },
      { en: "If I were you, I'd ___ .", pt: "Conselho", when: "Circuito 35" },
      { en: "Let me walk you through ___ .", pt: "Apresentação", when: "Circuito 45" },
    ],
    mission: "Sete situações em sete dias, uma por dia, sorteadas sem aviso prévio.",
    mindset:
      "Cinquenta e uma semanas. O que era esforço virou reflexo. Isso não foi dom — foi frequência.",
    pitfall: "Relaxar na reta final. A última milha é onde o automatismo se fixa.",
  },
  {
    number: 52,
    title: "Você fala inglês",
    situation:
      "A semana da verdade: conversa livre de 15 minutos, sem tópico, sem preparo, sem rede de proteção.",
    pattern: "Você mesmo, em inglês",
    patternNote: "Não há molde. Há você.",
    chunks: [
      { en: "I've been learning English for a year now.", pt: "Estudo inglês há um ano.", when: "Contando a jornada" },
      { en: "It's changed a lot for me.", pt: "Mudou muita coisa para mim.", when: "Impacto" },
      { en: "I still make mistakes, but I keep going.", pt: "Ainda erro, mas sigo em frente.", when: "Honestidade madura" },
      { en: "I can hold a conversation now.", pt: "Consigo manter uma conversa agora.", when: "Conquista" },
      { en: "What's next for me is ___ .", pt: "O próximo passo para mim é ___ .", when: "Futuro" },
      { en: "I'm proud of how far I've come.", pt: "Tenho orgulho do quanto avancei.", when: "Fechamento" },
      { en: "This is just the beginning.", pt: "Isso é só o começo.", when: "Última frase do curso" },
    ],
    mission:
      "Avaliação final: 15 minutos de conversa livre com a tutora sobre sua vida, sua jornada e seus planos.",
    mindset:
      "Um ano atrás você não sabia dizer 'oi'. Hoje você conversa. A diferença entre você e quem desistiu foram 15 minutos por dia.",
    pitfall:
      "Buscar perfeição em vez de comunicação. Fluência é fluir — e você já flui.",
  },
];

// ===========================================================================
// Expansão em 728 dias
// ===========================================================================

export interface AuthenticInput {
  kind: "series" | "podcast" | "video" | "news" | "music" | "social";
  title: string;
  /** O que procurar — busca real, não link que pode quebrar. */
  search: string;
  why: string;
  minutes: number;
}

/**
 * Prescrição de input autêntico por nível.
 *
 * Não entregamos links: links quebram e material com direito autoral não é
 * nosso para distribuir. Entregamos o QUE procurar e POR QUE — que é a parte
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
        search: "Friends / Brooklyn Nine-Nine — 1 cena de 3 minutos",
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
        search: "CNN / BBC / NPR — reportagem de 3 a 5 minutos",
        why: "Vocabulário formal, dicção limpa, velocidade real. Bom degrau antes da conversa casual.",
        minutes: 10,
      },
      {
        kind: "social",
        title: "Comentários de nativos",
        search: `Reddit ou YouTube: comentários sobre ${topic}`,
        why: "Inglês escrito informal — gíria, abreviação, ironia. É a linguagem que não aparece em curso.",
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
        why: "Sem muleta. Você vai perder coisa — o objetivo é seguir mesmo perdendo.",
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
    `Stay in character. Start the conversation naturally — do not explain the exercise.`,
    `Use the target chunks when they fit, so the student hears them in context:`,
    ...circuit.chunks.slice(0, 5).map((c) => `  - "${c.en}"`),
    "",
    "Speak at natural speed. Do not slow down unless the student asks.",
    "If the student gets stuck for more than a few seconds, help with a short prompt.",
    "After about 8 exchanges, let the conversation drift to a related topic —",
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

/** Revisão intercalada: circuitos aleatórios porém determinísticos. */
function interleavedReview(circuit: number): number[] {
  const pool = Array.from({ length: circuit }, (_, i) => i + 1);
  // Passo primo sobre o histórico — espalha sem depender de aleatoriedade.
  const picks = new Set<number>();
  for (let i = 0; i < Math.min(5, pool.length); i++) {
    picks.add(pool[(i * 7 + circuit * 3) % pool.length]);
  }
  return [...picks].sort((a, b) => a - b);
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
        title: `Revisão espaçada — circuito ${circuit.number}`,
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
        objective: `Consumir material real do mundo sobre a situação — não material de curso.`,
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
        title: `Revisão intercalada — circuito ${circuit.number}`,
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
 * devendo — e quem se sente devendo abandona.
 */
