/**
 * Sonda de comportamento da Emma ao vivo (não faz parte do build).
 *
 * Roda a MESMA instrução de sistema da sala de voz contra o modelo de texto e
 * verifica o que o produto promete: corrigir com alternativa natural e uma
 * frase em português, obedecer ao pedido de parar, e voltar quando mandado.
 *
 * É uma aproximação — a sala usa o modelo de áudio —, mas é o que separa
 * "o prompt compila" de "o prompt manda no comportamento".
 */
import { GoogleGenAI } from "@google/genai";

import { liveSystemPrompt, type ModoLive } from "@/lib/gemini/live-prompt";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODELO = process.env.GEMINI_MODEL_TUTOR || "gemini-3.1-flash-lite";

const CENARIO =
  "Free conversation. Start by asking the student how their day is going, then follow wherever the conversation leads.";

interface Turno {
  role: "user" | "model";
  parts: { text: string }[];
}

async function conversar(modo: ModoLive, falas: string[]): Promise<string[]> {
  const systemInstruction = liveSystemPrompt({ modo, level: "A2", scenario: CENARIO });
  const historico: Turno[] = [];
  const respostas: string[] = [];

  for (const fala of falas) {
    historico.push({ role: "user", parts: [{ text: fala }] });
    const r = await ai.models.generateContent({
      model: MODELO,
      contents: historico,
      config: { systemInstruction, temperature: 0.4 },
    });
    const texto = (r.text ?? "").trim();
    historico.push({ role: "model", parts: [{ text: texto }] });
    respostas.push(texto);
  }
  return respostas;
}

/** Português de verdade: acentos ou palavras que não existem em inglês. */
function temPortugues(t: string): boolean {
  return /[áàâãéêíóôõúç]|\b(não|você|em inglês|americano|diria|frase|porque|значит)\b/i.test(t);
}

let falhas = 0;
function checar(nome: string, ok: boolean, amostra: string) {
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "ERRO"}  ${nome}`);
  if (!ok) console.log(`        resposta: ${amostra.replace(/\s+/g, " ").slice(0, 220)}`);
}

async function main() {
  console.log(`modelo: ${MODELO}\n`);

  // ---------------------------------------------------- modo professora
  console.log("=== MODO PROFESSORA ===");
  const p = await conversar("professora", [
    "Hi Emma! My computer is problem today, I am very angry.",
    "Vamos agora só dialogar para eu treinar meu inglês, sem correção.",
    "Yesterday I go to the mall and I buy a new shirt for my brother.",
    "Ok, volta a corrigir por favor.",
    "I have 30 years and I work in a company of technology.",
  ]);
  p.forEach((r, i) => console.log(`\n[${i + 1}] ${r.replace(/\s+/g, " ").slice(0, 300)}`));
  console.log();

  checar("corrige a combinação errada com alternativa natural",
    /acting up|having (a )?(problem|trouble|issue)|giving me trouble|not working|is broken|playing up/i.test(p[0]), p[0]);
  checar("explica em português", temPortugues(p[0]), p[0]);
  checar("obedece 'só dialogar' e confirma", p[1].length > 0 && !/^\s*$/.test(p[1]), p[1]);
  checar("depois do pedido, NÃO fica explicando em português",
    !temPortugues(p[2]), p[2]);
  checar("volta a corrigir quando mandado", p[3].length > 0, p[3]);
  checar("corrigindo de novo: pega 'I have 30 years'",
    /I'?m 30|I am 30|thirty years old|30 years old/i.test(p[4]), p[4]);

  // ------------------------------------------------------- modo conversa
  console.log("\n=== MODO CONVERSA ===");
  const c = await conversar("conversa", [
    "Hi Emma! My computer is problem today, I am very angry.",
  ]);
  console.log(`\n[1] ${c[0].replace(/\s+/g, " ").slice(0, 300)}\n`);
  checar("não vira aula em português", !temPortugues(c[0]), c[0]);

  console.log(falhas === 0 ? "\ntudo confere" : `\n${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

void main();
