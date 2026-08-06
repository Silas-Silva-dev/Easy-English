"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/guards";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/database";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/** Todo endpoint administrativo passa por aqui antes de tocar no banco. */
async function assertAdmin() {
  const session = await getSessionContext();
  if (!session) throw new Error("Não autenticado");
  if (session.profile.role !== "admin") throw new Error("Acesso restrito a administradores");
  if (session.profile.status !== "active") throw new Error("Conta inativa");
  return session;
}

async function assertStaff() {
  const session = await getSessionContext();
  if (!session) throw new Error("Não autenticado");
  if (session.profile.role !== "admin" && session.profile.role !== "instructor") {
    throw new Error("Acesso restrito à equipe");
  }
  if (session.profile.status !== "active") throw new Error("Conta inativa");
  return session;
}

async function audit(
  actor: { userId: string; email: string },
  action: string,
  entity: string,
  entityId: string,
  meta: Record<string, unknown> = {},
) {
  const supabase = createAdminSupabase();
  await supabase.from("audit_log").insert({
    actor_id: actor.userId,
    actor_email: actor.email,
    action,
    entity,
    entity_id: entityId,
    meta: meta as never,
  });
}

// ---------------------------------------------------------------- usuários
const roleSchema = z.enum(["student", "instructor", "admin"]);
const statusSchema = z.enum(["pending_verification", "active", "suspended", "banned"]);

export async function updateUserRoleAction(
  userId: string,
  role: UserRole,
): Promise<ActionResult> {
  try {
    const actor = await assertAdmin();
    const parsed = roleSchema.safeParse(role);
    if (!parsed.success) return { ok: false, error: "Papel inválido" };

    // Um admin não pode rebaixar a si mesmo: evita deixar o sistema sem admin.
    if (userId === actor.userId && parsed.data !== "admin") {
      return { ok: false, error: "Você não pode remover seu próprio acesso de administrador." };
    }

    const supabase = createAdminSupabase();
    const { error } = await supabase.from("profiles").update({ role: parsed.data }).eq("id", userId);
    if (error) return { ok: false, error: error.message };

    await audit(actor, "user.role_changed", "profiles", userId, { role: parsed.data });
    revalidatePath("/admin/usuarios");
    return { ok: true, message: `Papel alterado para ${parsed.data}.` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado" };
  }
}

export async function updateUserStatusAction(
  userId: string,
  status: z.infer<typeof statusSchema>,
  reason?: string,
): Promise<ActionResult> {
  try {
    const actor = await assertAdmin();
    const parsed = statusSchema.safeParse(status);
    if (!parsed.success) return { ok: false, error: "Status inválido" };

    if (userId === actor.userId && parsed.data !== "active") {
      return { ok: false, error: "Você não pode bloquear a própria conta." };
    }

    const supabase = createAdminSupabase();
    const { error } = await supabase
      .from("profiles")
      .update({
        status: parsed.data,
        suspended_reason: parsed.data === "active" ? null : (reason?.trim() || null),
      })
      .eq("id", userId);

    if (error) return { ok: false, error: error.message };

    await audit(actor, `user.${parsed.data}`, "profiles", userId, { reason });
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Status atualizado." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado" };
  }
}

/** Confirma o e-mail manualmente: útil quando o e-mail não chega ao aluno. */
export async function verifyUserEmailAction(userId: string): Promise<ActionResult> {
  try {
    const actor = await assertAdmin();
    const supabase = createAdminSupabase();

    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
    if (authError) return { ok: false, error: authError.message };

    await supabase
      .from("profiles")
      .update({ status: "active", email_verified_at: new Date().toISOString() })
      .eq("id", userId);

    await audit(actor, "user.email_verified_manually", "profiles", userId);
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "E-mail confirmado e conta ativada." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado" };
  }
}

export async function deleteUserAction(userId: string): Promise<ActionResult> {
  try {
    const actor = await assertAdmin();
    if (userId === actor.userId) return { ok: false, error: "Você não pode excluir a própria conta." };

    const supabase = createAdminSupabase();
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) return { ok: false, error: error.message };

    await audit(actor, "user.deleted", "profiles", userId);
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Usuário excluído." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado" };
  }
}

// ------------------------------------------------------------------ conteúdo
export async function toggleLessonPublishAction(
  lessonId: string,
  publish: boolean,
): Promise<ActionResult> {
  try {
    const actor = await assertStaff();
    const supabase = await createServerSupabase();

    const { error } = await supabase
      .from("lessons")
      .update({
        is_published: publish,
        reviewed_by: actor.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", lessonId);

    if (error) return { ok: false, error: error.message };

    await audit(actor, publish ? "lesson.published" : "lesson.unpublished", "lessons", lessonId);
    revalidatePath("/admin/licoes");
    return { ok: true, message: publish ? "Lição publicada." : "Lição despublicada." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado" };
  }
}

export async function bulkPublishLessonsAction(lessonIds: string[]): Promise<ActionResult> {
  try {
    const actor = await assertStaff();
    if (!lessonIds.length) return { ok: false, error: "Nenhuma lição selecionada" };

    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from("lessons")
      .update({
        is_published: true,
        reviewed_by: actor.userId,
        reviewed_at: new Date().toISOString(),
      })
      .in("id", lessonIds);

    if (error) return { ok: false, error: error.message };

    await audit(actor, "lesson.bulk_published", "lessons", `${lessonIds.length} lições`, {
      count: lessonIds.length,
    });
    revalidatePath("/admin/licoes");
    return { ok: true, message: `${lessonIds.length} lições publicadas.` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado" };
  }
}

const lessonEditSchema = z.object({
  title: z.string().trim().min(3).max(200),
  subtitle: z.string().trim().max(200).optional().nullable(),
  objective: z.string().trim().max(1000).optional().nullable(),
  grammar_focus: z.string().trim().max(300).optional().nullable(),
  grammar_explanation: z.string().trim().max(20000).optional().nullable(),
  speaking_prompt: z.string().trim().max(2000).optional().nullable(),
  listening_script: z.string().trim().max(10000).optional().nullable(),
  estimated_minutes: z.coerce.number().int().min(1).max(180),
});

export async function updateLessonAction(
  lessonId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await assertStaff();

    const parsed = lessonEditSchema.safeParse({
      title: formData.get("title"),
      subtitle: formData.get("subtitle"),
      objective: formData.get("objective"),
      grammar_focus: formData.get("grammar_focus"),
      grammar_explanation: formData.get("grammar_explanation"),
      speaking_prompt: formData.get("speaking_prompt"),
      listening_script: formData.get("listening_script"),
      estimated_minutes: formData.get("estimated_minutes"),
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from("lessons")
      .update({
        ...parsed.data,
        subtitle: parsed.data.subtitle || null,
        objective: parsed.data.objective || null,
        grammar_focus: parsed.data.grammar_focus || null,
        grammar_explanation: parsed.data.grammar_explanation || null,
        speaking_prompt: parsed.data.speaking_prompt || null,
        listening_script: parsed.data.listening_script || null,
        reviewed_by: actor.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", lessonId);

    if (error) return { ok: false, error: error.message };

    await audit(actor, "lesson.updated", "lessons", lessonId);
    revalidatePath("/admin/licoes");
    revalidatePath(`/admin/licoes/${lessonId}`);
    return { ok: true, message: "Lição salva." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado" };
  }
}

export async function toggleCoursePublishAction(
  courseId: string,
  publish: boolean,
): Promise<ActionResult> {
  try {
    const actor = await assertStaff();
    const supabase = await createServerSupabase();

    const { error } = await supabase
      .from("courses")
      .update({ is_published: publish, published_at: publish ? new Date().toISOString() : null })
      .eq("id", courseId);

    if (error) return { ok: false, error: error.message };

    await audit(actor, publish ? "course.published" : "course.unpublished", "courses", courseId);
    revalidatePath("/admin/cursos");
    revalidatePath("/");
    return { ok: true, message: publish ? "Curso publicado." : "Curso despublicado." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado" };
  }
}

// ---------------------------------------------------------------- certificados
export async function generateTestCertificateAction(params: {
  studentName?: string;
  workloadHours?: number;
  averageScore?: number;
}): Promise<ActionResult & { certificateCode?: string }> {
  try {
    const session = await assertAdmin();

    // Buscar curso padrão
    const supabase = await createServerSupabase();
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("slug", "ingles-para-conversacao")
      .maybeSingle();

    if (!course) return { ok: false, error: "Curso principal não encontrado." };

    const cert = await import("@/lib/certificate").then((m) =>
      m.issueAdminTestCertificate({
        userId: session.userId,
        studentName: params.studentName || session.profile.full_name || "Aluno de Teste Easy English",
        courseId: course.id,
        workloadHours: params.workloadHours || 180,
        averageScore: params.averageScore || 9.8,
      }),
    );

    if (!cert) return { ok: false, error: "Falha ao gerar certificado de teste." };

    await audit(session, "certificate.test_generated", "certificates", cert.id, {
      code: cert.code,
      studentName: cert.student_name,
    });

    revalidatePath("/admin/certificados");
    revalidatePath("/app/certificado");
    revalidatePath("/verificar-certificado");
    revalidatePath(`/verificar-certificado/${cert.code}`);

    return {
      ok: true,
      message: `Certificado de teste emitido com sucesso! Código: ${cert.code}`,
      certificateCode: cert.code,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado" };
  }
}

export async function deleteCertificateAction(certificateId: string): Promise<ActionResult> {
  try {
    const session = await assertAdmin();
    const adminSupabase = createAdminSupabase();

    // Buscar código antes de deletar para revalidar rotas públicas
    const { data: cert } = await adminSupabase
      .from("certificates")
      .select("code")
      .eq("id", certificateId)
      .maybeSingle();

    const { deleteCertificateById } = await import("@/lib/certificate");
    const success = await deleteCertificateById(certificateId);
    if (!success) return { ok: false, error: "Erro ao excluir certificado do banco de dados." };

    await audit(session, "certificate.deleted", "certificates", certificateId);

    revalidatePath("/admin/certificados");
    revalidatePath("/app/certificado");
    revalidatePath("/verificar-certificado");
    if (cert?.code) {
      revalidatePath(`/verificar-certificado/${cert.code}`);
    }

    return { ok: true, message: "Certificado excluído do banco de dados com sucesso. Não é mais possível verificá-lo." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado" };
  }
}

