/**
 * Tudo que o curso precisa ter em áudio, enumerado de forma determinística.
 *
 * ===========================================================================
 * O QUE ENTRA AQUI
 * ===========================================================================
 * O conjunto é FECHADO e pequeno, e é isso que torna a pré-geração viável numa
 * chave gratuita:
 *
 *   104 diálogos  — 52 de imersão (dia 1, 7, 9) + 52 de escuta (dia 4, 12)
 *   364 blocos    — os 7 chunks de cada um dos 52 circuitos
 *   ---
 *   468 chamadas de TTS no total
 *
 * Diálogo inteiro sai numa ÚNICA chamada, porque o Gemini fala com dois
 * locutores de uma vez (`multiSpeakerVoiceConfig`). Gerar fala a fala custaria
 * 865 chamadas em vez de 104 — oito vezes mais cota para o mesmo áudio.
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
  /** Nome do arquivo, sem extensão. Derivado do texto — ver audio-id.ts. */
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

/**
 * Vozes do catálogo de pré-definidas do Gemini.
 *
 * O mapeamento é por NOME do personagem, não por posição: assim a Ana soa
 * igual no circuito 1 e no 40, e o aluno reconhece quem está falando. Um
 * elenco fixo também mantém a geração determinística — mesmo roteiro, mesmo
 * áudio, quantas vezes rodar.
 */
const GEMINI_CAST = [
  "Kore",
  "Puck",
  "Charon",
  "Aoede",
  "Fenrir",
  "Leda",
  "Orus",
  "Zephyr",
] as const;

/**
 * Elenco do Piper — TTS neural local, sem chave e sem cota.
 *
 * Alternado feminino/masculino de propósito: como o desempate de vozes iguais
 * anda para o índice seguinte, vizinhos de gêneros diferentes deixam o diálogo
 * mais fácil de acompanhar justamente quando houve colisão.
 */
const PIPER_CAST = [
  "en_US-amy-medium",
  "en_US-ryan-medium",
  "en_US-lessac-medium",
  "en_US-joe-medium",
  "en_US-kristin-medium",
  "en_US-hfc_male-medium",
] as const;

export type Engine = "gemini" | "piper";

function castFor(engine: Engine): readonly string[] {
  return engine === "piper" ? PIPER_CAST : GEMINI_CAST;
}

function voiceIndex(speaker: string, size: number): number {
  let sum = 0;
  for (let i = 0; i < speaker.length; i++) sum = (sum * 31 + speaker.charCodeAt(i)) >>> 0;
  return sum % size;
}

export function voiceFor(speaker: string, engine: Engine = "gemini"): string {
  const cast = castFor(engine);
  return cast[voiceIndex(speaker, cast.length)];
}

/** A voz "professor" dos blocos soltos — sempre a mesma, nos dois motores. */
export function narratorVoice(engine: Engine): string {
  return castFor(engine)[0];
}

/**
 * As duas vozes de um diálogo, garantidamente DIFERENTES.
 *
 * Dois nomes podem cair no mesmo índice do elenco — são 8 vozes para dezenas
 * de personagens. Se isso passasse, a API recusaria o pedido (ela exige duas
 * vozes distintas) ou, pior, os dois lados da conversa sairiam com a mesma
 * voz e o aluno não separaria os turnos — exatamente o problema que
 * `pickDialogueVoices` em `src/lib/speech.ts` já documenta.
 *
 * O desempate anda para a próxima voz do elenco, então continua determinístico.
 */
export function voicePairFor(a: string, b: string, engine: Engine = "gemini"): [string, string] {
  const cast = castFor(engine);
  const first = voiceIndex(a, cast.length);
  let second = voiceIndex(b, cast.length);
  if (second === first) second = (first + 1) % cast.length;
  return [cast[first], cast[second]];
}

/**
 * As falas de um item, já com a voz de cada uma resolvida.
 *
 * O Piper sintetiza fala a fala, então não tem o limite de dois locutores do
 * modo multi-locutor do Gemini: os 6 diálogos de três pessoas do curso saem
 * naturalmente aqui, cada personagem na sua voz.
 */
export function spokenLines(job: AudioJob, engine: Engine): { voice: string; text: string }[] {
  if (job.kind !== "dialogue") {
    return [{ voice: narratorVoice(engine), text: job.text }];
  }

  // Com exatamente dois, respeita o par desempatado — assim o áudio do Piper e
  // o do Gemini distribuem as vozes do mesmo jeito.
  const pair =
    job.speakers.length === 2 ? voicePairFor(job.speakers[0], job.speakers[1], engine) : null;

  return job.text.split(/\s*\/\s*/).map((line) => {
    const match = /^([^:]{1,24}):\s*(.+)$/.exec(line);
    const who = match?.[1]?.trim() ?? job.speakers[0] ?? "";
    const said = match?.[2]?.trim() ?? line;

    if (pair) return { voice: who === job.speakers[0] ? pair[0] : pair[1], text: said };
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
        label: `c${material.n} ${kindLabel} — ${speakers.join(" / ")}`,
      });
    }

    for (const chunk of spec?.chunks ?? []) {
      push({
        id: audioId(chunk.en),
        kind: "chunk",
        text: chunk.en,
        speakers: [],
        circuit: material.n,
        label: `c${material.n} bloco — ${chunk.en}`,
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
      label: `c${piece.n} escuta estendida — ${piece.title}`,
    });
  }

  return jobs;
}
