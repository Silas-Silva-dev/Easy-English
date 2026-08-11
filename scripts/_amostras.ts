/**
 * Amostras lado a lado dos tres modelos de TTS, para escolher de ouvido.
 * Sai em WAV para nao depender do ffmpeg.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { genaiTts } from "./_shared";
import { voicePairFor, voiceFor } from "../content/audio-manifest";

const OUT = join(process.cwd(), ".audio-log", "amostras");

function wav(pcm: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const DIALOGO =
  "Read the following conversation the way two Americans would actually say it: " +
  "natural conversational pace, contractions, linked words, real intonation. Do not enunciate word by word.\n\n" +
  "Sarah: Hi, I'm Sarah. Nice to meet you.\nAna: Nice to meet you too. I'm Ana.";
const BLOCO =
  "Say the following phrase the way an American says it in normal conversation: " +
  "natural speed, natural linking. Say it once.\n\nSorry, what's your name again?";

async function fala(model: string, texto: string, speechConfig: object, nome: string) {
  const r = await genaiTts().models.generateContent({
    model, contents: [{ role: "user", parts: [{ text: texto }] }],
    config: { responseModalities: ["AUDIO"], speechConfig },
  });
  const inline = r.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inline?.data) throw new Error("sem audio");
  const pcm = Buffer.from(inline.data, "base64");
  const rate = Number(/rate=(\d+)/.exec(inline.mimeType ?? "")?.[1] ?? 24000);
  writeFileSync(join(OUT, nome), wav(pcm, rate));
  return (pcm.length / (rate * 2)).toFixed(1);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const [vA, vB] = voicePairFor("Sarah", "Ana", "gemini");
  const multi = {
    multiSpeakerVoiceConfig: {
      speakerVoiceConfigs: [
        { speaker: "Sarah", voiceConfig: { prebuiltVoiceConfig: { voiceName: vA } } },
        { speaker: "Ana", voiceConfig: { prebuiltVoiceConfig: { voiceName: vB } } },
      ],
    },
  };
  const uma = { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceFor("Kate", "gemini") } } };

  for (const model of ["gemini-2.5-pro-preview-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"]) {
    const curto = model.replace("gemini-", "").replace("-preview", "").replace("-tts", "");
    const d = await fala(model, DIALOGO, multi, `dialogo__${curto}.wav`);
    const b = await fala(model, BLOCO, uma, `bloco__${curto}.wav`);
    console.log(`  ${model.padEnd(30)} dialogo ${d}s  ·  bloco ${b}s`);
  }
  console.log(`\n  Amostras em: ${OUT}`);
}
main();
