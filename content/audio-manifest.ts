/**
 * Tudo que o curso precisa ter em áudio, enumerado de forma determinística.
 *
 * ===========================================================================
 * O QUE ENTRA AQUI
 * ===========================================================================
 * O conjunto é FECHADO e pequeno, e é isso que torna a pré-geração viável numa
 * chave gratuita:
 *
 *   104 diálogos: 52 de imersão (dia 1, 7, 9) + 52 de escuta (dia 4, 12)
 *   364 blocos: os 7 chunks de cada um dos 52 circuitos
 *   ---
 *   468 chamadas de TTS no total
 *
 * Diálogo inteiro sai numa ÚNICA chamada, porque o Gemini fala com dois
 * locutores de uma vez (`multiSpeakerVoiceConfig`). Gerar fala a fala custaria
 * 865 chamadas em vez de 104: oito vezes mais cota para o mesmo áudio.
 *
 * ===========================================================================
 * O QUE NÃO ENTRA
 * ===========================================================================
 * Os drills do dia 3 (molde + peça) e as frases de expansão do dia 10 são
 * combinações geradas na hora e mudam por aluno. Continuam na voz do
 * navegador, que é justamente o caso em que ela serve bem: frase solta, curta,
 * sem duas pessoas conversando.
 */

import { CIRCUIT_CONTENT } from "./circuits";
import { AUTHENTIC_PIECES } from "./circuits/authentic";
import { scriptOf } from "./compose-lesson";
import { CIRCUITS } from "./curriculum";

import { audioId } from "@/lib/audio-id";

export interface AudioJob {
  /** Nome do arquivo, sem extensão. Derivado do texto: ver audio-id.ts. */
  id: string;
  kind: "dialogue" | "chunk";
  /** O texto exato que o player vai procurar. Não normalize aqui. */
  text: string;
  /** Vazio em bloco; os dois interlocutores, na ordem, em diálogo. */
  speakers: string[];
  circuit: number;
  /** Só para o log do gerador. */
  label: string;
}

export type Engine = "gemini" | "piper" | "google";

/**
 * ===========================================================================
 * O ELENCO
 * ===========================================================================
 * Antes a voz de cada personagem era um hash do nome sobre uma lista única de
 * vozes. Isso produziu dois defeitos que só aparecem ouvindo:
 *
 *   - GÊNERO TROCADO. O hash não sabe quem é quem: a Sarah do circuito 1 saiu
 *     com voz masculina, o Mike com voz feminina, a Kate e a Elena com voz de
 *     homem. Treze dos trinta e seis personagens estavam errados, e os quatro
 *     protagonistas recorrentes do curso (Bruno, Mike, Kate, Sarah) estavam
 *     entre eles: ou seja, quase todo diálogo do curso.
 *
 *   - VOZ INSTÁVEL. Quando dois nomes caíam no mesmo índice, o desempate
 *     empurrava o segundo para a voz seguinte. Resultado: o Bruno falava com
 *     `lessac` num diálogo e `joe` em outro, dependendo de com quem estava
 *     conversando. O aluno não consegue reconhecer um personagem que muda de
 *     voz: que era exatamente o que este arquivo dizia querer garantir.
 *
 * A correção é uma tabela explícita. São 36 personagens: cabe inteira na tela,
 * dá para revisar lendo, e não há hash que possa surpreender. Cada um declara
 * o gênero e um NAIPE (0, 1 ou 2) dentro do próprio gênero. O naipe é que vira
 * voz, e vira voz diferente em cada motor: assim a mesma tabela serve para o
 * Piper e para o Gemini sem duplicar decisão.
 *
 * `verify:content` confere duas invariantes que a tabela precisa manter:
 * nenhum personagem falando sem elenco, e nenhum diálogo com dois personagens
 * na mesma voz.
 */
type Gender = "f" | "m";

/** [gênero, naipe dentro do gênero] */
type CastEntry = [Gender, 0 | 1 | 2];

const CAST: Record<string, CastEntry> = {
  // --- protagonistas recorrentes -------------------------------------------
  Ana: ["f", 1],
  Bruno: ["m", 1],
  Mike: ["m", 0],
  Kate: ["f", 0],
  Sarah: ["f", 2],

  // --- personagens das escutas estendidas do dia 8 -------------------------
  Jake: ["m", 0],
  Elena: ["f", 2],
  Dana: ["f", 0],
  Rafa: ["m", 1],
  // "Tech" se apresenta como Marcus na fala; "Lu" é a cliente do outro lado.
  Tech: ["m", 0],
  Lu: ["f", 1],
  Ines: ["f", 1],
  Tom: ["m", 2],
  Bia: ["f", 0],
  Priya: ["f", 2],
  Caio: ["m", 0],
  Jo: ["f", 0],
  Vini: ["m", 1],
  Mark: ["m", 2],
  Liam: ["m", 0],

  /**
   * Nomes que as escutas estendidas inventaram e ficaram sem elenco.
   *
   * `verify:content` vinha reclamando dos onze há tempo, e o efeito era o
   * defeito que esta tabela existe para não ter: caíam em `fallbackEntry`, que
   * sorteia o gênero pelo hash do nome. A Jenna e a Rachel falavam com voz de
   * homem, e no circuito 22 a "Jenna" e o "Leo" dividiam a MESMA voz — dois
   * personagens indistinguíveis na mesma cena.
   *
   * Entram aqui antes de regravar o curso: gerar 482 arquivos com voz sorteada
   * seria assar o erro em disco.
   */
  Amanda: ["f", 1],
  Carla: ["f", 2],
  Dave: ["m", 2],
  Ethan: ["m", 1],
  Jenna: ["f", 0],
  Jessica: ["f", 1],
  Leo: ["m", 2],
  Lucas: ["m", 0],
  Marcus: ["m", 1],
  Maya: ["f", 2],
  Rachel: ["f", 0],

  /**
   * Os quatro que ainda faltavam, achados por `verify:content` já com o lote
   * do Gemini rodando. Mesma história dos de cima: sem entrada aqui, caíam no
   * sorteio por hash e dividiam a voz com o par de cena — nos circuitos 31,
   * 34, 41 e 43 os DOIS personagens saíam com o mesmo timbre, na escuta
   * estendida, que é justamente o exercício de acompanhar quem fala o quê.
   *
   * Todos os quatro contracenam com alguém do outro gênero, então declarar o
   * gênero certo já desfaz a colisão: os pools são separados.
   */
  Chloe: ["f", 0],
  David: ["m", 2],
  Diego: ["m", 1],
  Karen: ["f", 1],

  // --- papéis ---------------------------------------------------------------
  // Papel não tem gênero embutido: a escolha aqui é para o curso ter homens e
  // mulheres nos dois lados do balcão, e não médico-homem / recepcionista-mulher
  // em toda cena.
  Agent: ["m", 2],
  Barista: ["f", 0],
  Cashier: ["m", 1],
  Clerk: ["m", 2],
  Client: ["m", 1],
  Doctor: ["m", 0],
  Host: ["f", 2],
  Interviewer: ["f", 0],
  Man: ["m", 2],
  Manager: ["f", 2],
  Officer: ["f", 2],
  Pharmacist: ["f", 0],
  Receptionist: ["f", 0],
  Vendor: ["f", 2],
  Waiter: ["m", 2],
  Woman: ["f", 2],
};

/**
 * Nomes de PESSOA do elenco, separados por gênero.
 *
 * As escutas estendidas do dia 8 são redigidas pelo Gemini, que inventa os
 * nomes dos dois personagens. Nome inventado cai no fallback e sai com gênero
 * sorteado: o defeito que esta tabela existe para não ter. Então o gerador
 * escolhe daqui, e `verify:content` reclama de qualquer estranho que apareça.
 *
 * Só nomes de pessoa: um papel ("Barista", "Manager") como locutor de uma
 * conversa de copa ou de festa não faz sentido.
 */
export const CAST_PEOPLE: Record<Gender, string[]> = {
  f: [
    "Ana",
    "Kate",
    "Sarah",
    "Elena",
    "Dana",
    "Ines",
    "Bia",
    "Priya",
    "Jo",
    "Lu",
    "Chloe",
    "Karen",
  ],
  m: ["Bruno", "Mike", "Jake", "Rafa", "Tom", "Caio", "Vini", "Mark", "Liam", "David", "Diego"],
};

/**
 * Vozes pré-definidas do Gemini, separadas por gênero.
 * Kore/Aoede/Leda/Zephyr são femininas; Puck/Charon/Fenrir/Orus, masculinas.
 */
const GEMINI_VOICES: Record<Gender, readonly string[]> = {
  f: ["Kore", "Aoede", "Leda"],
  m: ["Puck", "Charon", "Fenrir"],
};

/** Vozes do Piper: TTS neural local, sem chave e sem cota. */
const PIPER_VOICES: Record<Gender, readonly string[]> = {
  f: ["en_US-amy-medium", "en_US-lessac-medium", "en_US-kristin-medium"],
  m: ["en_US-ryan-medium", "en_US-joe-medium", "en_US-hfc_male-medium"],
};

/**
 * Google Cloud TTS — Neural2.
 *
 * ===========================================================================
 * POR QUE NEURAL2 E NÃO JOURNEY
 * ===========================================================================
 * A tabela de elenco acima precisa de TRÊS naipes por gênero para que dois
 * personagens de uma mesma cena nunca caiam na mesma voz — é o defeito que ela
 * foi escrita para corrigir.
 *
 * A família Journey tem apenas três vozes en-US no total (D masculina, F e O
 * femininas). Um único naipe masculino significa que todo diálogo entre dois
 * homens sairia com a MESMA voz, e o aluno perderia a separação dos turnos: é
 * trocar um problema por outro pior.
 *
 * Neural2 tem nove vozes en-US (A, D, I, J masculinas; C, E, F, G, H
 * femininas), o que cobre o elenco inteiro com folga. `--engine google` valida
 * contra a lista real da API antes de gerar, então se alguma destas sair do ar
 * o lote falha na primeira linha, em vez de gravar 482 arquivos errados.
 */
const GOOGLE_VOICES: Record<Gender, readonly string[]> = {
  f: ["en-US-Neural2-F", "en-US-Neural2-C", "en-US-Neural2-H"],
  m: ["en-US-Neural2-D", "en-US-Neural2-A", "en-US-Neural2-J"],
};

function poolFor(engine: Engine, gender: Gender): readonly string[] {
  if (engine === "piper") return PIPER_VOICES[gender];
  if (engine === "google") return GOOGLE_VOICES[gender];
  return GEMINI_VOICES[gender];
}

/** Todas as vozes que o motor Google usa: `--engine google` confere na API. */
export function googleVoiceNames(): string[] {
  return [...GOOGLE_VOICES.f, ...GOOGLE_VOICES.m];
}

/**
 * Elenco de quem não está na tabela.
 *
 * Acontece quando uma escuta estendida nova inventa um nome. O gerador é
 * instruído a usar só nomes de `CAST_NAMES` e `verify:content` reclama de
 * qualquer estranho, então isto aqui é rede de segurança e não caminho normal:
 * mantém o áudio saindo, com voz estável para aquele nome, em vez de derrubar
 * o lote inteiro por um personagem.
 */
function fallbackEntry(speaker: string): CastEntry {
  let sum = 0;
  for (let i = 0; i < speaker.length; i++)
    sum = (sum * 31 + speaker.charCodeAt(i)) >>> 0;
  return [sum % 2 === 0 ? "f" : "m", (sum % 3) as 0 | 1 | 2];
}

function entryFor(speaker: string): CastEntry {
  return CAST[speaker] ?? fallbackEntry(speaker);
}

/** True quando o personagem tem elenco declarado: usado por `verify:content`. */
export function isCast(speaker: string): boolean {
  return speaker in CAST;
}

/**
 * A voz de um personagem. Depende SÓ do nome e do motor: nunca de com quem
 * ele está conversando. É isso que faz a Ana soar igual no circuito 1 e no 40.
 */
export function voiceFor(speaker: string, engine: Engine = "gemini"): string {
  const [gender, slot] = entryFor(speaker);
  const pool = poolFor(engine, gender);
  return pool[slot % pool.length];
}

/**
 * A voz "professor" dos blocos soltos.
 *
 * Um bloco repetido entre circuitos vira UM arquivo só (o nome sai do texto),
 * então ele não pode herdar a voz do personagem que o diz: seria voz
 * diferente para o mesmo arquivo. Narrador fixo é a escolha certa aqui, e
 * ouvir o bloco numa segunda voz ainda ajuda: o aluno aprende a reconhecer a
 * frase, não o timbre de quem a disse.
 */
export function narratorVoice(engine: Engine): string {
  return poolFor(engine, "f")[0];
}

/**
 * As duas vozes de um diálogo, garantidamente DIFERENTES.
 *
 * Com a tabela explícita as colisões já não deveriam existir: `verify:content`
 * falha se existirem. O desempate continua aqui porque o modo multi-locutor do
 * Gemini RECUSA o pedido com duas vozes iguais, e um personagem novo caído no
 * fallback ainda pode colidir. Ele anda dentro do MESMO gênero, para não
 * consertar a colisão criando o defeito que esta tabela veio corrigir.
 */
export function voicePairFor(
  a: string,
  b: string,
  engine: Engine = "gemini",
): [string, string] {
  const first = voiceFor(a, engine);
  const second = voiceFor(b, engine);
  if (first !== second) return [first, second];

  const [gender, slot] = entryFor(b);
  const pool = poolFor(engine, gender);
  return [first, pool[(slot + 1) % pool.length]];
}

/**
 * As falas de um item, já com a voz de cada uma resolvida.
 *
 * O Piper sintetiza fala a fala, então não tem o limite de dois locutores do
 * modo multi-locutor do Gemini: os 6 diálogos de três pessoas do curso saem
 * naturalmente aqui, cada personagem na sua voz.
 */
export function spokenLines(
  job: AudioJob,
  engine: Engine,
): { voice: string; text: string }[] {
  if (job.kind !== "dialogue") {
    return [{ voice: narratorVoice(engine), text: job.text }];
  }

  // Com exatamente dois, respeita o par desempatado: assim o áudio do Piper e
  // o do Gemini distribuem as vozes do mesmo jeito.
  const pair =
    job.speakers.length === 2
      ? voicePairFor(job.speakers[0], job.speakers[1], engine)
      : null;

  return job.text.split(/\s*\/\s*/).map((line) => {
    const match = /^([^:]{1,24}):\s*(.+)$/.exec(line);
    const who = match?.[1]?.trim() ?? job.speakers[0] ?? "";
    const said = match?.[2]?.trim() ?? line;

    if (pair)
      return { voice: who === job.speakers[0] ? pair[0] : pair[1], text: said };
    return { voice: voiceFor(who, engine), text: said };
  });
}

export function audioJobs(): AudioJob[] {
  const jobs: AudioJob[] = [];
  const seen = new Set<string>();

  const push = (job: AudioJob) => {
    // Blocos repetidos entre circuitos ("See you later!") viram um arquivo só.
    if (!job.id || seen.has(job.id)) return;
    seen.add(job.id);
    jobs.push(job);
  };

  for (const material of CIRCUIT_CONTENT) {
    const spec = CIRCUITS[material.n - 1];

    for (const [kindLabel, lines] of [
      ["imersão", material.immersion],
      ["escuta", material.listening],
    ] as const) {
      const text = scriptOf(lines);
      const speakers = [...new Set(lines.map(([who]) => who))];
      push({
        id: audioId(text),
        kind: "dialogue",
        text,
        speakers,
        circuit: material.n,
        label: `c${material.n} ${kindLabel}: ${speakers.join(" / ")}`,
      });
    }

    for (const chunk of spec?.chunks ?? []) {
      push({
        id: audioId(chunk.en),
        kind: "chunk",
        text: chunk.en,
        speakers: [],
        circuit: material.n,
        label: `c${material.n} bloco: ${chunk.en}`,
      });
    }
  }

  // Escuta estendida do dia 8. Entram só as peças já redigidas: a biblioteca
  // é preenchida aos poucos por `scripts/generate-listening.ts`, e cada rodada
  // de áudio pega o que apareceu desde a anterior.
  for (const piece of AUTHENTIC_PIECES) {
    const text = scriptOf(piece.lines);
    const speakers = [...new Set(piece.lines.map(([who]) => who))];
    push({
      id: audioId(text),
      kind: "dialogue",
      text,
      speakers,
      circuit: piece.n,
      label: `c${piece.n} escuta estendida: ${piece.title}`,
    });
  }

  return jobs;
}
