import "server-only";

import { Type, type Schema } from "@google/genai";

import { geminiModels } from "@/lib/env";
import { gemini, parseJsonResponse, withRetry } from "@/lib/gemini/client";
import { speakingCoachSystemPrompt } from "@/lib/gemini/prompts";
import type { CefrLevel } from "@/lib/types/database";

export interface SpeakingAnalysis {
  audible: boolean;
  transcript: string;
  language_detected: "en" | "pt" | "mixed" | "unknown";
  corrected_text: string;
  estimated_level: CefrLevel;
  scores: {
    overall: number;
    pronunciation: number;
    fluency: number;
    grammar: number;
    vocabulary: number;
    task: number;
  };
  summary_pt: string;
  encouragement_pt: string;
  corrections: {
    original: string;
    corrected: string;
    explanation_pt: string;
    category: "pronunciation" | "grammar" | "vocabulary" | "fluency" | "naturalness";
    severity: "low" | "medium" | "high";
  }[];
  pronunciation_notes: {
    word: string;
    ipa: string;
    heard: string;
    tip_pt: string;
  }[];
  suggested_phrases: { en: string; pt: string; context?: string }[];
  next_steps: string[];
}

const SPEAKING_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: [
    "audible",
    "transcript",
    "language_detected",
    "corrected_text",
    "estimated_level",
    "scores",
    "summary_pt",
    "encouragement_pt",
    "corrections",
    "pronunciation_notes",
    "suggested_phrases",
    "next_steps",
  ],
  properties: {
    audible: {
      type: Type.BOOLEAN,
      description: "false se o audio estiver vazio, mudo ou totalmente ininteligivel",
    },
    transcript: {
      type: Type.STRING,
      description: "Transcricao literal do que foi falado, preservando erros e hesitacoes",
    },
    language_detected: { type: Type.STRING, enum: ["en", "pt", "mixed", "unknown"] },
    corrected_text: {
      type: Type.STRING,
      description: "A mesma fala reescrita em ingles correto e natural para o nivel do aluno",
    },
    estimated_level: { type: Type.STRING, enum: ["A1", "A2", "B1", "B2", "C1"] },
    scores: {
      type: Type.OBJECT,
      required: ["overall", "pronunciation", "fluency", "grammar", "vocabulary", "task"],
      properties: {
        overall: { type: Type.NUMBER },
        pronunciation: { type: Type.NUMBER },
        fluency: { type: Type.NUMBER },
        grammar: { type: Type.NUMBER },
        vocabulary: { type: Type.NUMBER },
        task: { type: Type.NUMBER },
      },
    },
    summary_pt: {
      type: Type.STRING,
      description: "2 a 4 frases em portugues resumindo o desempenho e o que priorizar",
    },
    encouragement_pt: {
      type: Type.STRING,
      description: "Uma frase curta e sincera reconhecendo um acerto concreto do aluno",
    },
    corrections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["original", "corrected", "explanation_pt", "category", "severity"],
        properties: {
          original: { type: Type.STRING },
          corrected: { type: Type.STRING },
          explanation_pt: { type: Type.STRING },
          category: {
            type: Type.STRING,
            enum: ["pronunciation", "grammar", "vocabulary", "fluency", "naturalness"],
          },
          severity: { type: Type.STRING, enum: ["low", "medium", "high"] },
        },
      },
    },
    pronunciation_notes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["word", "ipa", "heard", "tip_pt"],
        properties: {
          word: { type: Type.STRING },
          ipa: { type: Type.STRING, description: "Pronuncia alvo em IPA" },
          heard: { type: Type.STRING, description: "Aproximacao do que o aluno de fato falou" },
          tip_pt: { type: Type.STRING, description: "Instrucao articulatoria pratica em portugues" },
        },
      },
    },
    suggested_phrases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["en", "pt"],
        properties: {
          en: { type: Type.STRING },
          pt: { type: Type.STRING },
          context: { type: Type.STRING },
        },
      },
    },
    next_steps: {
      type: Type.ARRAY,
      description: "2 a 3 acoes concretas para a proxima pratica",
      items: { type: Type.STRING },
    },
  },
};

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(10, Math.max(0, Math.round(n * 10) / 10));
}

/**
 * Envia o audio do aluno ao Gemini e devolve a analise pedagogica estruturada.
 *
 * @param audio  bytes do audio gravado no navegador
 * @param mime   mime type original (audio/webm, audio/mp4, ...)
 */
export async function analyzeSpeaking(params: {
  audio: Uint8Array | ArrayBuffer;
  mimeType: string;
  prompt: string;
  level: CefrLevel;
  lessonTitle?: string | null;
  grammarFocus?: string | null;
  targetVocabulary?: string[];
}): Promise<{ analysis: SpeakingAnalysis; model: string }> {
  const { audio, mimeType, prompt, level, lessonTitle, grammarFocus, targetVocabulary } = params;

  const bytes = audio instanceof Uint8Array ? audio : new Uint8Array(audio);
  const base64 = Buffer.from(bytes).toString("base64");
  const model = geminiModels.speaking;

  const response = await withRetry(() =>
    gemini().models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: normalizeAudioMime(mimeType), data: base64 } },
            {
              text: [
                "Analise o audio acima.",
                "",
                `EXERCICIO PROPOSTO AO ALUNO: "${prompt}"`,
                "",
                // O enunciado passou a ser escrito em portugues (o aluno e
                // brasileiro e precisa entender a tarefa). Sem esta linha o
                // modelo pode ler o idioma do enunciado como idioma esperado
                // da resposta e deixar de penalizar quem gravou em portugues.
                "O enunciado esta em portugues porque o aluno e brasileiro. A resposta gravada,",
                "essa sim, deveria estar em INGLES — avalie por esse criterio.",
                "",
                "Avalie se o aluno cumpriu o exercicio e devolva o JSON no formato definido.",
                "Lembre-se: transcricao literal, explicacoes em portugues, exemplos em ingles.",
              ].join("\n"),
            },
          ],
        },
      ],
      config: {
        systemInstruction: speakingCoachSystemPrompt({
          level,
          lessonTitle,
          grammarFocus,
          targetVocabulary,
        }),
        temperature: 0.35,
        responseMimeType: "application/json",
        responseSchema: SPEAKING_SCHEMA,
      },
    }),
  );

  const analysis = parseJsonResponse<SpeakingAnalysis>(response.text);

  // Normaliza as notas: o modelo ocasionalmente devolve escala 0-100 ou nulos.
  analysis.scores = {
    overall: clampScore(analysis.scores?.overall),
    pronunciation: clampScore(analysis.scores?.pronunciation),
    fluency: clampScore(analysis.scores?.fluency),
    grammar: clampScore(analysis.scores?.grammar),
    vocabulary: clampScore(analysis.scores?.vocabulary),
    task: clampScore(analysis.scores?.task),
  };

  analysis.corrections ??= [];
  analysis.pronunciation_notes ??= [];
  analysis.suggested_phrases ??= [];
  analysis.next_steps ??= [];

  return { analysis, model };
}

/**
 * O MediaRecorder do navegador manda coisas como "audio/webm;codecs=opus".
 * A API do Gemini espera o mime base.
 */
export function normalizeAudioMime(mime: string): string {
  const base = mime.split(";")[0]?.trim().toLowerCase() || "audio/webm";
  const supported = new Set([
    "audio/wav",
    "audio/mp3",
    "audio/mpeg",
    "audio/aiff",
    "audio/aac",
    "audio/ogg",
    "audio/flac",
    "audio/webm",
    "audio/mp4",
  ]);
  if (supported.has(base)) return base === "audio/mp3" ? "audio/mpeg" : base;
  if (base === "audio/x-m4a" || base === "audio/m4a") return "audio/mp4";
  return "audio/webm";
}
