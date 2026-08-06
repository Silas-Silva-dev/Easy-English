"use server";

import { Type, type Schema } from "@google/genai";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ACCESS_DENIAL_MESSAGE, getPaidSession } from "@/lib/auth/guards";
import { geminiModels } from "@/lib/env";
import { gemini, parseJsonResponse, withRetry } from "@/lib/gemini/client";
import { createServerSupabase } from "@/lib/supabase/server";
import { chunkKey, gradeFromScore } from "@/lib/srs";

const turnSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string().max(4000),
  at: z.number(),
});

const saveSchema = z.object({
  lessonId: z.string().uuid().nullable(),
  circuitNumber: z.number().int().min(1).max(52).nullable(),
  scenario: z.string().max(4000).nullable(),
  durationSeconds: z.number().int().min(0).max(7200),
  transcript: z.array(turnSchema).min(1).max(400),
});

const EVAL_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["scores", "summary_pt", "chunks_used", "highlights", "next_focus"],
  properties: {
    scores: {
      type: Type.OBJECT,
      required: ["overall", "fluency", "grammar", "vocabulary", "interaction"],
      properties: {
        overall: { type: Type.NUMBER },
        fluency: { type: Type.NUMBER },
        grammar: { type: Type.NUMBER },
        vocabulary: { type: Type.NUMBER },
        // Específico de conversa: manter o turno, reagir, devolver a bola.
        interaction: { type: Type.NUMBER },
      },
    },
    summary_pt: { type: Type.STRING },
    chunks_used: {
      type: Type.ARRAY,
      description: "Blocos-alvo que o aluno realmente produziu, em inglês",
      items: { type: Type.STRING },
    },
    highlights: {
      type: Type.ARRAY,
      description: "2 a 4 momentos concretos, bons ou ruins",
      items: {
        type: Type.OBJECT,
        required: ["quote", "comment_pt", "good"],
        properties: {
          quote: { type: Type.STRING },
          comment_pt: { type: Type.STRING },
          good: { type: Type.BOOLEAN },
        },
      },
    },
    next_focus: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
};

interface LiveEvaluation {
  scores: {
    overall: number;
    fluency: number;
    grammar: number;
    vocabulary: number;
    interaction: number;
  };
  summary_pt: string;
  chunks_used: string[];
  highlights: { quote: string; comment_pt: string; good: boolean }[];
  next_focus: string[];
}

const clamp = (n: unknown) => {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.min(10, Math.max(0, Math.round(v * 10) / 10)) : 0;
};

/**
 * Salva a conversa ao vivo e a avalia.
 *
 * A avaliação roda sobre a TRANSCRIÇÃO, não sobre o áudio: a Live API já
 * transcreveu os dois lados, e reprocessar áudio custaria caro sem ganho.
 * Por isso a nota aqui não inclui pronúncia: para pronúncia existe a
 * gravação assíncrona, que ouve o áudio de fato.
 */
export async function saveLiveSessionAction(input: {
  lessonId: string | null;
  circuitNumber: number | null;
  scenario: string | null;
  durationSeconds: number;
  transcript: { role: "user" | "model"; text: string; at: number }[];
}): Promise<{ ok: boolean; error?: string; sessionId?: string }> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  // A avaliação da conversa passa pelo Gemini: uma Server Action é chamável
  // sem renderizar a página, então o paywall precisa estar aqui dentro.
  const auth = await getPaidSession();
  if (!auth.ok) return { ok: false, error: ACCESS_DENIAL_MESSAGE[auth.reason] };
  const session = auth.session;

  const { lessonId, circuitNumber, scenario, durationSeconds, transcript } = parsed.data;
  const supabase = await createServerSupabase();

  const userTurns = transcript.filter((t) => t.role === "user");
  if (!userTurns.length) return { ok: false, error: "Nenhuma fala sua foi captada" };

  // Blocos-alvo do circuito, para medir se o aluno realmente os usou.
  let targetChunks: { en: string; pt: string }[] = [];
  let courseId: string | null = null;

  if (circuitNumber) {
    const { data: circuit } = await supabase
      .from("circuits")
      .select("course_id, chunks")
      .eq("number", circuitNumber)
      .maybeSingle();
    targetChunks = (circuit?.chunks ?? []).slice(0, 10);
    courseId = circuit?.course_id ?? null;
  }

  const dialogue = transcript
    .map((t) => `${t.role === "user" ? "STUDENT" : "EMMA"}: ${t.text}`)
    .join("\n");

  let evaluation: LiveEvaluation | null = null;

  try {
    const response = await withRetry(() =>
      gemini().models.generateContent({
        model: geminiModels.tutor,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  `Avalie esta conversa ao vivo de ${Math.round(durationSeconds / 60)} minutos.`,
                  scenario ? `\nCENÁRIO: ${scenario}` : "",
                  targetChunks.length
                    ? `\nBLOCOS-ALVO DO CIRCUITO:\n${targetChunks.map((c) => `  - "${c.en}"`).join("\n")}`
                    : "",
                  `\nTRANSCRIÇÃO:\n${dialogue}`,
                ].join("\n"),
              },
            ],
          },
        ],
        config: {
          systemInstruction: `
Você é Emma, professora de inglês especialista em brasileiros, avaliando uma
conversa ao vivo que acabou de acontecer.

Avalie APENAS a fala do STUDENT. Ignore as falas de EMMA.

CRITÉRIOS (0 a 10, com decimais)
- fluency: fluidez, ritmo, quanto ele conseguiu manter o turno sem travar
- grammar: precisão estrutural adequada ao nível
- vocabulary: variedade e adequação das escolhas
- interaction: manteve a conversa viva? devolveu perguntas? reagiu?
  Este é o critério mais importante numa conversa: mais que precisão.
- overall: visão geral, ponderando interaction e fluency acima dos outros

NÃO avalie pronúncia: você está lendo uma transcrição, não ouvindo o áudio.
Inventar nota de pronúncia a partir de texto seria desonesto.

Em chunks_used, liste apenas os blocos-alvo que o aluno REALMENTE produziu.
Se não usou nenhum, devolva lista vazia. Nunca invente.

Escreva summary_pt e os comentários em português do Brasil, direto e adulto.
Comece pelo que funcionou antes de apontar o que falta.
`.trim(),
          temperature: 0.3,
          responseMimeType: "application/json",
          responseSchema: EVAL_SCHEMA,
        },
      }),
    );

    evaluation = parseJsonResponse<LiveEvaluation>(response.text);
  } catch (error) {
    // Falha na avaliação não pode perder a conversa do aluno.
    console.error("[live] avaliação falhou:", error instanceof Error ? error.message : error);
  }

  const scores = evaluation
    ? {
        overall: clamp(evaluation.scores?.overall),
        fluency: clamp(evaluation.scores?.fluency),
        grammar: clamp(evaluation.scores?.grammar),
        vocabulary: clamp(evaluation.scores?.vocabulary),
        interaction: clamp(evaluation.scores?.interaction),
      }
    : null;

  const usedKeys = (evaluation?.chunks_used ?? [])
    .map((en) => chunkKey(en))
    .filter(Boolean);

  const { data: saved, error: saveError } = await supabase
    .from("live_sessions")
    .insert({
      user_id: session.userId,
      course_id: courseId,
      lesson_id: lessonId,
      circuit_number: circuitNumber,
      scenario,
      model: geminiModels.live,
      ended_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      turns: userTurns.length,
      transcript: transcript as never,
      summary_pt: evaluation?.summary_pt ?? null,
      scores: (evaluation ? { ...scores, highlights: evaluation.highlights, next_focus: evaluation.next_focus } : null) as never,
      chunks_used: usedKeys,
    })
    .select("id")
    .single();

  if (saveError) {
    console.error("[live] falha ao salvar:", saveError.message);
    return { ok: false, error: "Não foi possível salvar a conversa" };
  }

  // Blocos efetivamente FALADOS valem mais que blocos revisados: alimentam
  // tanto o contador de produção quanto a agenda de repetição espaçada.
  //
  // As duas RPCs usam auth.uid() internamente, então precisam do cliente do
  // usuário: com service_role o auth.uid() seria nulo e a função abortaria.
  if (usedKeys.length && scores) {
    const { error: spokenError } = await supabase.rpc("mark_chunks_spoken", {
      p_chunk_keys: usedKeys,
    });
    if (spokenError) console.error("[live] mark_chunks_spoken:", spokenError.message);

    const grade = gradeFromScore(scores.overall);
    for (const key of usedKeys) {
      const { error } = await supabase.rpc("review_chunk", { p_chunk_key: key, p_grade: grade });
      // O bloco pode não estar na agenda ainda: não é motivo para falhar.
      if (error && !/não está na sua agenda/i.test(error.message)) {
        console.error("[live] review_chunk:", error.message);
      }
    }
  }

  // Conta como atividade do dia: a conversa ao vivo é estudo de verdade.
  if (courseId) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", session.userId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (enrollment) {
      await supabase.rpc("register_study_activity", {
        p_enrollment_id: enrollment.id,
        p_minutes: Math.max(1, Math.round(durationSeconds / 60)),
        p_lessons_done: 0,
      });
    }
  }

  revalidatePath("/app/ao-vivo");
  revalidatePath("/app");

  return { ok: true, sessionId: saved.id };
}
