import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_DENIAL_HTTP_STATUS,
  ACCESS_DENIAL_MESSAGE,
  getPaidSession,
} from "@/lib/auth/guards";
import { analyzeSpeaking, normalizeAudioMime } from "@/lib/gemini/speaking";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { chunkKey } from "@/lib/srs";
import type { CefrLevel, Chunk } from "@/lib/types/database";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB ≈ 5 min de webm/opus
const ALLOWED_MIME = /^audio\/(webm|mp4|mpeg|mp3|wav|ogg|aac|x-m4a|m4a)\b/i;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Normaliza para comparar fala transcrita com o bloco escrito. */
function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Quais blocos do circuito o aluno REALMENTE falou nesta gravação.
 *
 * O SRS só promove um bloco a "dominado" depois de produzido em voz alta, e
 * essa é a única evidência honesta disso que temos: a transcrição do que saiu
 * da boca dele, não a de o que ele deveria ter dito. Por isso a comparação é
 * contra `transcript` e nunca contra `corrected_text`.
 */
function chunksSpokenIn(transcript: string, chunks: Chunk[]): string[] {
  const said = normalize(transcript);
  if (!said) return [];

  return chunks
    .filter((chunk) => {
      // A parte fixa do molde é o que importa; o "___" é a peça que varia.
      const core = normalize(chunk.en.replace(/_+/g, " "));
      if (core.length < 6) return false;
      return said.includes(core);
    })
    .map((chunk) => chunkKey(chunk.en));
}

export async function POST(request: NextRequest) {
  // ------------------------------------------------------------ autorização
  // A análise consome Gemini por áudio enviado: o paywall vale aqui também.
  const auth = await getPaidSession();
  if (!auth.ok) {
    return bad(ACCESS_DENIAL_MESSAGE[auth.reason], ACCESS_DENIAL_HTTP_STATUS[auth.reason]);
  }
  const session = auth.session;

  // ------------------------------------------------------------- validação
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return bad("Envio inválido");
  }

  const file = formData.get("audio");
  if (!(file instanceof File)) return bad("Nenhum áudio recebido");
  if (file.size === 0) return bad("O áudio está vazio. Grave novamente.");
  if (file.size > MAX_BYTES) return bad("Áudio muito longo. Grave no máximo 5 minutos.", 413);
  if (!ALLOWED_MIME.test(file.type)) return bad(`Formato de áudio não suportado: ${file.type}`);

  const lessonId = (formData.get("lessonId") as string | null) || null;
  const durationRaw = Number(formData.get("duration") ?? 0);
  const duration = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : null;

  const supabase = await createServerSupabase();

  // ------------------------------------ contexto pedagógico (lição ou livre)
  let prompt = (formData.get("prompt") as string | null)?.trim() || "";
  let level: CefrLevel = session.profile.target_level;
  let lessonTitle: string | null = null;
  let grammarFocus: string | null = null;
  let targetVocabulary: string[] = [];
  let courseId: string | null = null;
  let lessonChunks: Chunk[] = [];

  if (lessonId) {
    const { data: lesson } = await supabase
      .from("lessons")
      .select(
        "id, course_id, title, level, grammar_focus, speaking_prompt, vocabulary, chunks, is_published",
      )
      .eq("id", lessonId)
      .maybeSingle();

    if (!lesson?.is_published) return bad("Lição não encontrada ou indisponível", 404);

    courseId = lesson.course_id;
    lessonTitle = lesson.title;
    level = lesson.level;
    grammarFocus = lesson.grammar_focus;
    targetVocabulary = (lesson.vocabulary ?? []).map((v) => v.term).filter(Boolean);
    lessonChunks = lesson.chunks ?? [];
    prompt = prompt || lesson.speaking_prompt || "";
  }

  if (!prompt) {
    // Este texto é gravado em `speaking_sessions.prompt` e reaparece na lista
    // "Suas últimas práticas": por isso vai em português, como todo enunciado.
    prompt = "Prática livre: fale em inglês sobre o assunto que quiser, por cerca de um minuto.";
  }

  // ------------------------------------------------- upload no bucket privado
  const extension = normalizeAudioMime(file.type).split("/")[1]?.replace("mpeg", "mp3") ?? "webm";
  const audioPath = `${session.userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("speaking-audio")
    .upload(audioPath, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[speaking] upload falhou:", uploadError.message);
    return bad("Não foi possível salvar seu áudio. Tente novamente.", 500);
  }

  // ---------------------------------------------------- registra a sessão
  const { data: sessionRow, error: sessionError } = await supabase
    .from("speaking_sessions")
    .insert({
      user_id: session.userId,
      course_id: courseId,
      lesson_id: lessonId,
      prompt,
      level,
      audio_path: audioPath,
      audio_mime: file.type,
      duration_seconds: duration,
      status: "processing",
    })
    .select()
    .single();

  if (sessionError || !sessionRow) {
    console.error("[speaking] falha ao criar sessão:", sessionError?.message);
    return bad("Não foi possível registrar a prática. Tente novamente.", 500);
  }

  // ------------------------------------------------------ análise do Gemini
  try {
    const { analysis, model } = await analyzeSpeaking({
      audio: bytes,
      mimeType: file.type,
      prompt,
      level,
      lessonTitle,
      grammarFocus,
      targetVocabulary,
      courseId,
    });

    await supabase
      .from("speaking_sessions")
      .update({ status: "completed", transcript: analysis.transcript, model })
      .eq("id", sessionRow.id);

    // As notas são geradas pelo sistema, nunca pelo aluno: a RLS de
    // speaking_feedback bloqueia escrita por quem não é admin justamente para
    // que ninguém forje o próprio resultado. Por isso a gravação usa o cliente
    // de service_role: o dono da sessão já foi validado no topo da rota.
    const admin = createAdminSupabase();
    const { data: feedback, error: feedbackError } = await admin
      .from("speaking_feedback")
      .insert({
        session_id: sessionRow.id,
        user_id: session.userId,
        overall_score: analysis.scores.overall,
        pronunciation_score: analysis.scores.pronunciation,
        fluency_score: analysis.scores.fluency,
        grammar_score: analysis.scores.grammar,
        vocabulary_score: analysis.scores.vocabulary,
        task_score: analysis.scores.task,
        estimated_level: analysis.estimated_level,
        corrected_text: analysis.corrected_text,
        summary_pt: analysis.summary_pt,
        encouragement_pt: analysis.encouragement_pt,
        corrections: analysis.corrections,
        pronunciation_notes: analysis.pronunciation_notes,
        suggested_phrases: analysis.suggested_phrases,
        next_steps: analysis.next_steps,
        raw: analysis as never,
      })
      .select()
      .single();

    if (feedbackError) {
      console.error("[speaking] falha ao salvar feedback:", feedbackError.message);
    }

    // Blocos efetivamente pronunciados avançam o contador de produção do SRS.
    // Usa o cliente do aluno porque a RPC resolve a agenda por `auth.uid()`.
    const spoken = chunksSpokenIn(analysis.transcript ?? "", lessonChunks);
    if (spoken.length) {
      const { error: spokenError } = await supabase.rpc("mark_chunks_spoken", {
        p_chunk_keys: spoken,
      });
      if (spokenError) {
        console.error("[speaking] falha ao marcar blocos falados:", spokenError.message);
      }
    }

    return NextResponse.json({
      sessionId: sessionRow.id,
      feedbackId: feedback?.id ?? null,
      audioUrl: `/api/speaking/audio?sessionId=${sessionRow.id}`,
      audible: analysis.audible,
      languageDetected: analysis.language_detected,
      transcript: analysis.transcript,
      correctedText: analysis.corrected_text,
      estimatedLevel: analysis.estimated_level,
      scores: analysis.scores,
      summary: analysis.summary_pt,
      encouragement: analysis.encouragement_pt,
      tutorAudioScript: analysis.tutor_audio_script,
      corrections: analysis.corrections,
      pronunciationNotes: analysis.pronunciation_notes,
      suggestedPhrases: analysis.suggested_phrases,
      nextSteps: analysis.next_steps,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[speaking] análise falhou:", message);

    await supabase
      .from("speaking_sessions")
      .update({ status: "failed", error_message: message.slice(0, 500) })
      .eq("id", sessionRow.id);

    const quota = /quota|429|rate.?limit/i.test(message);
    return bad(
      quota
        ? "A tutora está sobrecarregada no momento. Tente novamente em alguns instantes."
        : "Não foi possível analisar seu áudio. Tente gravar novamente.",
      quota ? 429 : 502,
    );
  }
}
