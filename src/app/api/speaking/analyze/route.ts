import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_DENIAL_HTTP_STATUS,
  ACCESS_DENIAL_MESSAGE,
  getPaidSession,
} from "@/lib/auth/guards";
import { descreverErro, erroDeRede } from "@/lib/gemini/client";
import { analyzeSpeaking, normalizeAudioMime } from "@/lib/gemini/speaking";
import { syncEnrollmentStudyStats } from "@/lib/learning";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { chunksSpokenIn, gradeFromSpokenChunk } from "@/lib/srs";
import type { CefrLevel, Chunk } from "@/lib/types/database";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB ≈ 5 min de webm/opus
const ALLOWED_MIME = /^audio\/(webm|mp4|mpeg|mp3|wav|ogg|aac|x-m4a|m4a)\b/i;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
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
  const normalizedMime = normalizeAudioMime(file.type);
  const extension = normalizedMime.split("/")[1]?.replace("mpeg", "mp3") ?? "webm";
  const audioPath = `${session.userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const adminSupabase = createAdminSupabase();
  const { error: uploadError } = await adminSupabase.storage
    .from("speaking-audio")
    .upload(audioPath, bytes, { contentType: normalizedMime, upsert: false });

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

    // Áudio inaudível não é avaliação. Se ficasse "completed" com feedback, a
    // reidratação da lição o traria de volta como a última avaliação do aluno e
    // ainda liberaria concluir a lição com uma gravação que o próprio sistema
    // disse não ter ouvido. As notas 0 também sujariam o gráfico de evolução.
    if (!analysis.audible) {
      await supabase
        .from("speaking_sessions")
        .update({
          status: "failed",
          transcript: analysis.transcript,
          model,
          error_message: "Áudio inaudível",
        })
        .eq("id", sessionRow.id);

      return NextResponse.json({
        sessionId: sessionRow.id,
        audible: false,
        languageDetected: analysis.language_detected,
      });
    }

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

    /**
     * Blocos efetivamente pronunciados alimentam DUAS coisas: o contador de
     * produção e a agenda de repetição espaçada.
     *
     * Só o contador estava aqui. Faltava `review_chunk`, e a falta era invisível
     * porque nada quebrava: a correção aparecia na tela normalmente. O efeito
     * era que tirar 9 e tirar 3 tinham exatamente a mesma consequência na
     * agenda — nenhuma. `gradeFromScore` existia em `src/lib/srs.ts` sem
     * nenhum chamador fora da conversa ao vivo.
     *
     * Falar é a evidência mais forte que o curso coleta sobre um bloco. Se ela
     * não reagenda, a repetição espaçada está adivinhando.
     *
     * As duas RPCs resolvem a agenda por `auth.uid()`, então precisam do cliente
     * do aluno: com service_role o `auth.uid()` seria nulo e a função abortaria.
     */
    const spoken = chunksSpokenIn(analysis.transcript ?? "", lessonChunks);
    if (spoken.length) {
      const { error: spokenError } = await supabase.rpc("mark_chunks_spoken", {
        p_chunk_keys: spoken,
      });
      if (spokenError) {
        console.error("[speaking] falha ao marcar blocos falados:", spokenError.message);
      }

      const grade = gradeFromSpokenChunk(analysis.scores.overall);
      for (const key of spoken) {
        const { error: reviewError } = await supabase.rpc("review_chunk", {
          p_chunk_key: key,
          p_grade: grade,
        });
        // O bloco pode ainda não estar na agenda do aluno: não é motivo para falhar.
        if (reviewError && !/não está na sua agenda/i.test(reviewError.message)) {
          console.error("[speaking] review_chunk:", reviewError.message);
        }
      }
    }

    /**
     * Registra o tempo praticado nesta gravação.
     *
     * Com o cliente DO ALUNO, não com o de service role. `register_study_activity`
     * é `security definer` e confere a posse da matrícula por `auth.uid()`
     * (`where e.user_id = auth.uid() or is_admin()`) — service role não tem
     * `auth.uid()`, então ela levantava "Matricula nao encontrada ou acesso
     * negado" em TODA fala enviada, e o `catch` abaixo engolia.
     *
     * O mesmo defeito já tinha sido corrigido na conclusão de lição; aqui ele
     * tinha sobrado. O efeito era invisível do mesmo jeito: a correção
     * aparecia na tela, e os minutos da prática de fala não entravam no dia
     * nem na ofensiva.
     */
    try {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("id")
        .eq("user_id", session.userId)
        .maybeSingle();

      if (enrollment) {
        const mins = Math.max(1, Math.round((duration ?? 60) / 60));
        const { error: activityError } = await supabase.rpc("register_study_activity", {
          p_enrollment_id: enrollment.id,
          p_minutes: mins,
          p_lessons_done: 0,
        });

        // Falhar aqui não pode custar o dia de estudo: o recálculo refaz a
        // conta a partir das sessões já gravadas.
        if (activityError) {
          console.error("[speaking] falha ao registrar atividade:", activityError.message);
          await syncEnrollmentStudyStats(session.userId, enrollment.id);
        }
      }
    } catch (e) {
      console.warn("[speaking] falha ao registrar minutos praticados:", e);
    }

    return NextResponse.json({
      sessionId: sessionRow.id,
      feedbackId: feedback?.id ?? null,
      audioUrl: `/api/speaking/audio?sessionId=${sessionRow.id}`,
      // Mesmo shape que a reidratação devolve, para o painel não distinguir
      // avaliação recém-feita de avaliação lida do banco.
      recordedAt: sessionRow.created_at,
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
    // A cadeia inteira de causas, não só o topo: "fetch failed" sozinho não
    // diz nada, e é este texto que fica em `error_message` para a próxima
    // investigação. Foi o que permitiu achar esta falha.
    const message = descreverErro(error) || "Erro desconhecido";
    console.error("[speaking] análise falhou:", message);

    await supabase
      .from("speaking_sessions")
      .update({ status: "failed", error_message: message.slice(0, 500) })
      .eq("id", sessionRow.id);

    const quota = /quota|429|rate.?limit/i.test(message);
    return bad(
      quota
        ? "A tutora está sobrecarregada no momento. Tente novamente em alguns instantes."
        : erroDeRede(error)
          ? // "Grave de novo" seria conselho errado: o áudio está íntegro, foi
            // salvo e continua na tela. Quem caiu foi a conexão com o Google.
            "A conexão com a tutora caiu no meio do envio. Seu áudio continua aqui: toque em Enviar para correção."
          : "Não foi possível analisar seu áudio. Tente gravar novamente.",
      quota ? 429 : 502,
    );
  }
}
