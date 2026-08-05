import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type { CefrLevel } from "@/lib/types/database";

import type { SpeakingResult } from "@/components/speaking/feedback-panel";

/**
 * O `raw` guarda a análise crua devolvida pelo Gemini. Três campos exibidos na
 * tela só existem lá (as colunas dedicadas nunca foram criadas para eles), então
 * a reidratação precisa lê-los de volta daqui.
 */
interface RawAnalysis {
  audible?: boolean;
  language_detected?: SpeakingResult["languageDetected"];
  tutor_audio_script?: string;
}

/** PostgREST devolve `numeric` como número, mas nulo em coluna opcional. */
function score(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Última avaliação de fala concluída do aluno nesta lição.
 *
 * Sem isto o resultado vivia apenas no `useState` do PracticeStation: bastava
 * sair da lição para a plataforma agir como se o aluno nunca tivesse falado,
 * mesmo com o áudio e a correção já salvos no banco. A leitura reconstrói o
 * mesmo `SpeakingResult` que a rota de análise devolve, para que a tela de
 * feedback não precise saber de onde o resultado veio.
 */
export async function getLastSpeakingResult(
  userId: string,
  lessonId: string,
): Promise<SpeakingResult | null> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("speaking_sessions")
    .select(
      "id, transcript, level, created_at, speaking_feedback(overall_score, pronunciation_score, fluency_score, grammar_score, vocabulary_score, task_score, estimated_level, corrected_text, summary_pt, encouragement_pt, corrections, pronunciation_notes, suggested_phrases, next_steps, raw)",
    )
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // O join vem como array quando o PostgREST não consegue provar a cardinalidade.
  const feedback = Array.isArray(data.speaking_feedback)
    ? data.speaking_feedback[0]
    : data.speaking_feedback;

  // Sessão concluída sem feedback é lixo de uma falha parcial: não reidrata.
  if (!feedback) return null;

  const raw = (feedback.raw ?? {}) as RawAnalysis;

  // Cinto e suspensório: linhas gravadas antes de a rota passar a marcar áudio
  // inaudível como `failed` ainda podem estar "completed" com `audible: false`.
  if (raw.audible === false) return null;

  return {
    sessionId: data.id,
    // Só sessões audíveis geram feedback; o `raw` confirma quando disponível.
    audible: raw.audible ?? true,
    languageDetected: raw.language_detected ?? "en",
    transcript: data.transcript ?? "",
    correctedText: feedback.corrected_text ?? "",
    estimatedLevel: (feedback.estimated_level ?? data.level) as CefrLevel,
    scores: {
      overall: score(feedback.overall_score),
      pronunciation: score(feedback.pronunciation_score),
      fluency: score(feedback.fluency_score),
      grammar: score(feedback.grammar_score),
      vocabulary: score(feedback.vocabulary_score),
      task: score(feedback.task_score),
    },
    summary: feedback.summary_pt ?? "",
    encouragement: feedback.encouragement_pt ?? "",
    corrections: feedback.corrections ?? [],
    pronunciationNotes: feedback.pronunciation_notes ?? [],
    suggestedPhrases: feedback.suggested_phrases ?? [],
    nextSteps: feedback.next_steps ?? [],
    // O áudio continua no bucket privado: a rota resolve o caminho pelo dono.
    audioUrl: `/api/speaking/audio?sessionId=${data.id}`,
    recordedAt: data.created_at,
  };
}
