"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/guards";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { TIMEZONE_VALUES } from "@/lib/timezones";

const completeSchema = z.object({
  lessonId: z.string().uuid(),
  minutes: z.number().int().min(0).max(240),
  score: z.number().min(0).max(100).nullable(),
  quizAnswers: z.array(z.number().int()).max(50),
});

export interface CompleteLessonResult {
  ok: boolean;
  error?: string;
  streak?: number;
  nextDay?: number | null;
}

/**
 * Marca a lição como concluída, contabiliza os minutos do dia e recalcula a
 * ofensiva. O avanço do `current_day` só acontece se o aluno estava justamente
 * naquele dia: refazer lição antiga não pula o cronograma.
 */
export async function completeLessonAction(input: {
  lessonId: string;
  minutes: number;
  score: number | null;
  quizAnswers: number[];
}): Promise<CompleteLessonResult> {
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const session = await getSessionContext();
  if (!session) return { ok: false, error: "Não autenticado" };
  if (session.profile.status !== "active") return { ok: false, error: "Conta não verificada" };

  const { lessonId, minutes, score, quizAnswers } = parsed.data;
  const supabase = await createServerSupabase();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, course_id, day_number, week_number, is_published")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson?.is_published) return { ok: false, error: "Lição indisponível" };

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("*")
    .eq("user_id", session.userId)
    .eq("course_id", lesson.course_id)
    .maybeSingle();

  if (!enrollment) return { ok: false, error: "Matrícula não encontrada" };

  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("id, status, attempts")
    .eq("enrollment_id", enrollment.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  const alreadyCompleted = existing?.status === "completed";
  const now = new Date().toISOString();

  const { error: progressError } = await supabase.from("lesson_progress").upsert(
    {
      ...(existing?.id ? { id: existing.id } : {}),
      enrollment_id: enrollment.id,
      user_id: session.userId,
      lesson_id: lessonId,
      status: "completed",
      score,
      quiz_answers: quizAnswers,
      minutes_spent: minutes,
      attempts: (existing?.attempts ?? 0) + 1,
      started_at: now,
      completed_at: now,
    },
    { onConflict: "enrollment_id,lesson_id" },
  );

  if (progressError) {
    console.error("[lesson] falha ao salvar progresso:", progressError.message);
    return { ok: false, error: "Não foi possível salvar seu progresso" };
  }

  // Contabiliza minutos e recalcula a ofensiva no banco.
  const admin = createAdminSupabase();
  const { data: updated, error: rpcError } = await admin.rpc("register_study_activity", {
    p_enrollment_id: enrollment.id,
    p_minutes: minutes,
    p_lessons_done: alreadyCompleted ? 0 : 1,
  });

  if (rpcError) console.error("[lesson] falha ao registrar atividade:", rpcError.message);

  /**
   * Coloca os blocos deste circuito na agenda individual de revisão.
   *
   * Sem isso a fila de repetição espaçada nunca enche e a aba Revisão fica
   * vazia para sempre. A RPC é idempotente (`on conflict do nothing`), então
   * chamar a cada lição concluída é barato e não zera o progresso de quem
   * já revisou aquele bloco. Usa o cliente do usuário porque a função depende
   * de `auth.uid()` para saber de quem é a agenda.
   */
  const { error: enrollChunksError } = await supabase.rpc("enroll_circuit_chunks", {
    p_course_id: lesson.course_id,
    p_circuit_number: lesson.week_number,
  });

  if (enrollChunksError) {
    console.error("[lesson] falha ao matricular blocos no SRS:", enrollChunksError.message);
  }

  // Avança o cronograma apenas quando o aluno concluiu o dia corrente.
  let nextDay: number | null = null;
  if (lesson.day_number >= enrollment.current_day) {
    nextDay = lesson.day_number + 1;
    await supabase.from("enrollments").update({ current_day: nextDay }).eq("id", enrollment.id);
  }

  revalidatePath("/app");
  revalidatePath("/app/cronograma");
  revalidatePath("/app/revisao");
  revalidatePath(`/app/licao/${lesson.day_number}`);

  return {
    ok: true,
    streak: updated?.streak_current ?? enrollment.streak_current,
    nextDay,
  };
}

/**
 * As mensagens são escritas à mão porque o texto do zod vai direto para a tela
 * do aluno — sem elas ele lê "Too small: expected string to have >=2 characters"
 * numa interface em português.
 *
 * `timezone` era `string().min(1).max(64)` e virou enum pelo mesmo motivo que a
 * migration 900 criou `safe_timezone()`: um fuso que o Postgres não reconhece
 * derruba `register_study_activity`, e como quem chama só loga o erro, o aluno
 * perderia minutos e ofensiva em silêncio, para sempre.
 */
const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Informe seu nome completo.")
    .max(120, "Nome muito longo (máximo 120 caracteres)."),
  dailyGoalMinutes: z.coerce
    .number("Informe a meta em minutos.")
    .int("A meta deve ser um número inteiro de minutos.")
    .min(5, "A meta mínima é de 5 minutos por dia.")
    .max(180, "A meta máxima é de 180 minutos por dia."),
  targetLevel: z.enum(["A1", "A2", "B1", "B2", "C1"], "Escolha um nível alvo válido."),
  timezone: z.enum(TIMEZONE_VALUES, "Escolha um fuso horário da lista."),
  track: z.enum(["essential", "complete", "intensive"], "Escolha uma trilha válida."),
});

export async function updateProfileAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const session = await getSessionContext();
  if (!session) return { error: "Não autenticado" };
  // A página está atrás de `requirePaidUser`, mas Server Action não passa por
  // layout nenhum: quem checa aqui é esta linha.
  if (session.profile.status !== "active") return { error: "Conta não verificada" };

  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    dailyGoalMinutes: formData.get("dailyGoalMinutes"),
    targetLevel: formData.get("targetLevel"),
    timezone: formData.get("timezone"),
    track: formData.get("track"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      daily_goal_minutes: parsed.data.dailyGoalMinutes,
      target_level: parsed.data.targetLevel,
      timezone: parsed.data.timezone,
      preferred_track: parsed.data.track,
      onboarded_at: session.profile.onboarded_at ?? new Date().toISOString(),
    })
    .eq("id", session.userId);

  if (error) return { error: error.message };

  // A trilha vive em dois lugares: a preferência no perfil e a trilha efetiva
  // da matrícula, que é quem define os blocos do dia e a meta prometida.
  const { error: trackError } = await supabase
    .from("enrollments")
    .update({ track: parsed.data.track })
    .eq("user_id", session.userId);

  if (trackError) console.error("[perfil] falha ao mudar a trilha:", trackError.message);

  revalidatePath("/app", "layout");
  revalidatePath("/app/revisao");
  return { success: "Perfil atualizado." };
}

/**
 * ---------------------------------------------------------------------------
 * Foto de perfil
 *
 * A versão anterior recebia o data URL base64 e gravava a imagem INTEIRA na
 * coluna `profiles.avatar_url`. Como `getSessionContext()` faz `select *` em
 * profiles a cada requisição autenticada, essa foto era relida em toda
 * navegação, e o `app-shell` ainda a reimprimia inline no HTML de cada página,
 * onde nenhum CDN consegue cachear.
 *
 * Agora o arquivo vai para o bucket `avatars` — que existia desde a migration
 * 200 e nunca tinha sido usado — e a coluna guarda só a URL pública, servida
 * pelo CDN do Supabase com cache de um ano (o nome tem UUID, então trocar a
 * foto gera outra URL e o cache nunca fica velho).
 * ---------------------------------------------------------------------------
 */
const MAX_AVATAR_BYTES = 512 * 1024;

/** O bucket aceita estes três (migration 200); a extensão sai daqui. */
const AVATAR_EXTENSION: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

/** Mantém uma foto por aluno: sem isto cada troca deixaria um órfão pago. */
async function removeStaleAvatars(
  supabase: ServerSupabase,
  userId: string,
  keepPath: string | null,
): Promise<void> {
  const { data } = await supabase.storage.from("avatars").list(userId);
  const stale = (data ?? [])
    .map((file) => `${userId}/${file.name}`)
    .filter((path) => path !== keepPath);

  if (stale.length > 0) await supabase.storage.from("avatars").remove(stale);
}

export async function uploadAvatarAction(
  formData: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { ok: false, error: "Não autenticado" };
  if (session.profile.status !== "active") return { ok: false, error: "Conta não verificada" };

  // Server Action é endpoint público: o recorte no navegador entrega ~40 KB,
  // mas nada impede uma chamada direta com o arquivo que o atacante quiser.
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Nenhuma imagem recebida." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: "Imagem muito grande. O limite é 512 KB." };
  }

  const extension = AVATAR_EXTENSION[file.type];
  if (!extension) {
    return { ok: false, error: "Formato não suportado. Use JPEG, PNG ou WebP." };
  }

  const supabase = await createServerSupabase();
  const path = `${session.userId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });

  if (uploadError) {
    console.error("[perfil] falha ao subir avatar:", uploadError.message);
    return { ok: false, error: "Não foi possível enviar a imagem." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", session.userId);

  if (error) {
    // Sem isto o arquivo ficaria no bucket sem ninguém apontando para ele.
    await supabase.storage.from("avatars").remove([path]);
    console.error("[perfil] falha ao gravar avatar_url:", error.message);
    return { ok: false, error: "Não foi possível salvar a foto." };
  }

  await removeStaleAvatars(supabase, session.userId, path);

  revalidatePath("/app", "layout");
  revalidatePath("/app/perfil");
  return { ok: true, url: publicUrl };
}

export async function removeAvatarAction(): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { ok: false, error: "Não autenticado" };

  const supabase = await createServerSupabase();
  // `null`, não string vazia: a coluna é nullable e a constraint da migration
  // 900 rejeita qualquer coisa que não seja nula ou uma URL https.
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", session.userId);

  if (error) return { ok: false, error: "Não foi possível remover a foto." };

  await removeStaleAvatars(supabase, session.userId, null);

  revalidatePath("/app", "layout");
  revalidatePath("/app/perfil");
  return { ok: true };
}
