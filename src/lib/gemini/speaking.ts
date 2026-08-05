import "server-only";

import { FinishReason, ThinkingLevel, Type, type Schema } from "@google/genai";

import { geminiModels } from "@/lib/env";
import { gemini, parseJsonResponse, withRetry } from "@/lib/gemini/client";
import { speakingCoachSystemPrompt } from "@/lib/gemini/prompts";
import { buildContextBlock } from "@/lib/gemini/rag";
import { retrieveContext } from "@/lib/gemini/tutor";
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
  tutor_audio_script?: string;
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
    tutor_audio_script: {
      type: Type.STRING,
      description: "Texto fluido para ser lido em voz alta pela tutora Emma sintetizando o elogio, o resumo e as principais correcoes para o aluno.",
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

/**
 * Motivos de parada em que insistir nao adianta: o modelo nao ficou sem texto
 * por acaso, ele recusou o conteudo. Retentar so queimaria quota e atrasaria o
 * erro na tela do aluno.
 */
const BLOQUEIOS_DEFINITIVOS = new Set<FinishReason>([
  FinishReason.SAFETY,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
  FinishReason.RECITATION,
]);

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
  courseId?: string | null;
}): Promise<{ analysis: SpeakingAnalysis; model: string }> {
  const { audio, mimeType, prompt, level, lessonTitle, grammarFocus, targetVocabulary, courseId } = params;

  const bytes = audio instanceof Uint8Array ? audio : new Uint8Array(audio);
  const base64 = Buffer.from(bytes).toString("base64");
  const fallbackModels = geminiModels.speakingFallbacks;

  // Recupera o contexto indexado do curso para ancorar a avaliação no material oficial
  let context = "";
  try {
    const chunks = await retrieveContext(prompt, courseId, 4);
    if (chunks.length) {
      context = buildContextBlock(chunks);
    }
  } catch (e) {
    console.warn("[speaking] Falha ao recuperar RAG contexto:", e);
  }

  let lastError: unknown;

  for (const model of fallbackModels) {
    // `thinkingLevel` so existe na familia Gemini 3. Se o modelo configurado por
    // env ou fallback for de outra geracao, a API responde 400 e NENHUMA analise funcionaria:
    // por isso o campo e degradavel em vez de obrigatorio.
    let comThinking = true;

    const requestOnce = () =>
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
                  "essa sim, deveria estar em INGLES: avalie por esse criterio.",
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
            context,
          }),
          temperature: 0.35,
          responseMimeType: "application/json",
          responseSchema: SPEAKING_SCHEMA,
          // Corrigir uma gravacao e tarefa de julgamento curto. Sem teto de
          // raciocinio o modelo as vezes gasta o turno inteiro pensando e fecha
          // sem nenhuma parte de texto. Nao ha `maxOutputTokens` de proposito: a
          // saida e um JSON grande e um teto so trocaria "resposta vazia" por
          // "JSON truncado".
          ...(comThinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
        },
      });

    try {
      const analysis = await withRetry(
        async () => {
          let response;
          try {
            response = await requestOnce();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            // Modelo que nao conhece o campo: repete sem ele e segue a vida.
            if (!comThinking || !/thinking/i.test(message)) throw error;
            console.warn(`[speaking] modelo ${model} rejeitou thinkingConfig, repetindo sem ele`);
            comThinking = false;
            response = await requestOnce();
          }

          const finishReason = response.candidates?.[0]?.finishReason;
          const text = response.text?.trim();

          if (!text) {
            // Bloqueio de conteudo sai com uma mensagem que o withRetry NAO
            // reconhece como retriavel, para falhar de imediato.
            if (finishReason && BLOQUEIOS_DEFINITIVOS.has(finishReason)) {
              throw new Error(`O Gemini bloqueou a analise do audio (${finishReason})`);
            }
            // Esta string vai para `speaking_sessions.error_message`: com os dois
            // motivos da para distinguir corte por tokens de bloqueio de prompt.
            throw new Error(
              `Resposta vazia do Gemini (finishReason=${finishReason ?? "?"}, ` +
                `blockReason=${response.promptFeedback?.blockReason ?? "-"})`,
            );
          }

          return parseJsonResponse<SpeakingAnalysis>(text);
        },
        // Duas tentativas por modelo: evita estourar maxDuration se ambos falharem.
        { attempts: 2, baseDelayMs: 500 },
      );

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
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isQuotaError = /\b(429)\b|quota|rate.?limit|resource_exhausted/i.test(message);

      if (isQuotaError) {
        console.warn(
          `[speaking] Cota excedida/Rate limit no modelo "${model}". Alternando para o próximo modelo de fallback na fila...`,
        );
        continue;
      }

      // Se não for erro de cota (ex: conteúdo bloqueado), aborta de imediato.
      throw error;
    }
  }

  throw lastError;
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
