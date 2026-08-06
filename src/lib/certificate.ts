import "server-only";

import { createHash, createHmac } from "node:crypto";
import { cache } from "react";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Certificate, CertificateEligibility } from "@/lib/types/database";

const SECRET_KEY =
  process.env.CERTIFICATE_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "easy-english-secret-signature-key-2026";

/**
 * Gera um código de certificado único e formatado.
 * Exemplo: EE-2026-X8F9A4B2
 */
export function generateCertificateCode(year = 2026): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let randomHex = "";
  for (let i = 0; i < 8; i++) {
    randomHex += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `EE-${year}-${randomHex}`;
}

/**
 * Calcula a assinatura criptográfica HMAC-SHA256 para assegurar a autenticidade dos dados.
 */
export function computeCertificateSignature(data: {
  userId: string;
  courseId: string;
  code: string;
  completedAt: string;
  hours: number;
}): string {
  const timestampSec = Math.floor(new Date(data.completedAt).getTime() / 1000);
  const payload = `${data.userId}:${data.courseId}:${data.code}:${timestampSec}:${data.hours}`;
  return createHmac("sha256", SECRET_KEY).update(payload).digest("hex");
}

/**
 * Valida a assinatura criptográfica do certificado em tempo de execução.
 */
export function verifyCertificateSignature(cert: Certificate): boolean {
  if (!cert.hash_signature || !cert.code) return false;
  const expected = computeCertificateSignature({
    userId: cert.user_id,
    courseId: cert.course_id,
    code: cert.code,
    completedAt: cert.completed_at,
    hours: cert.workload_hours,
  });
  return cert.hash_signature === expected;
}

/**
 * Verifica a elegibilidade do aluno para obtenção do certificado.
 * Requisitos estritos:
 * 1. Conclusão de 100% das lições publicadas do curso.
 * 2. Média das avaliações de fala/prática >= 7.0 (ou nota 10 se ainda não houver gravações).
 */
export const checkCertificateEligibility = cache(
  async (userId: string, courseId: string): Promise<CertificateEligibility> => {
    const supabase = await createServerSupabase();

    // 1. Buscar estatísticas das lições do curso
    const [{ data: publishedLessons }, { data: enrollment }] = await Promise.all([
      supabase
        .from("lessons")
        .select("id, estimated_minutes")
        .eq("course_id", courseId)
        .eq("is_published", true),
      supabase
        .from("enrollments")
        .select("id")
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .maybeSingle(),
    ]);

    const totalPublished = publishedLessons?.length ?? 0;
    
    // Carga horária calculada a partir da soma dos minutos estimados das aulas
    const totalMinutes = (publishedLessons ?? []).reduce(
      (acc, l) => acc + (l.estimated_minutes || 15),
      0,
    );
    // Se a soma for menor que 180 horas (ex: curso em expansão), mantemos o piso da grade regular (180h)
    const calculatedWorkloadHours = Math.max(180, Math.round(totalMinutes / 60));

    if (!enrollment) {
      return {
        isEligible: false,
        publishedLessons: totalPublished,
        completedLessons: 0,
        lessonsProgressPct: 0,
        averageScore: 0,
        minScoreRequired: 7.0,
        calculatedWorkloadHours,
        reasons: ["Matrícula não encontrada no curso."],
      };
    }

    // 2. Lições concluídas pelo aluno
    const { count: completedCount } = await supabase
      .from("lesson_progress")
      .select("*", { count: "exact", head: true })
      .eq("enrollment_id", enrollment.id)
      .eq("status", "completed");

    const completed = completedCount ?? 0;
    const progressPct = totalPublished > 0 ? Math.round((completed / totalPublished) * 100) : 0;

    // 3. Média das avaliações de fala do aluno
    const { data: feedbackRows } = await supabase
      .from("speaking_feedback")
      .select("overall_score")
      .eq("user_id", userId);

    let averageScore = 10.0;
    if (feedbackRows && feedbackRows.length > 0) {
      const sum = feedbackRows.reduce((acc, row) => acc + Number(row.overall_score || 0), 0);
      averageScore = Number((sum / feedbackRows.length).toFixed(2));
    }

    const reasons: string[] = [];
    const minScoreRequired = 7.0;

    if (totalPublished === 0 || completed < totalPublished) {
      reasons.push(
        `Você precisa concluir todas as lições do curso (Progresso atual: ${completed}/${totalPublished} lições - ${progressPct}%).`,
      );
    }

    if (averageScore < minScoreRequired) {
      reasons.push(
        `Sua média atual nas avaliações de fala é ${averageScore.toFixed(1)}. É necessário atingir média mínima de ${minScoreRequired.toFixed(1)}.`,
      );
    }

    const isEligible = reasons.length === 0;

    return {
      isEligible,
      publishedLessons: totalPublished,
      completedLessons: completed,
      lessonsProgressPct: progressPct,
      averageScore,
      minScoreRequired,
      calculatedWorkloadHours,
      reasons,
    };
  },
);

/**
 * Emite ou busca o certificado existente do aluno.
 * Se o aluno não for elegível, o certificado NÃO é gerado nem retornado.
 */
export async function getOrCreateUserCertificate(
  userId: string,
  courseId: string,
): Promise<{ certificate: Certificate | null; eligibility: CertificateEligibility }> {
  const eligibility = await checkCertificateEligibility(userId, courseId);
  const supabase = await createServerSupabase();

  // Buscar certificado existente
  const { data: existing } = await supabase
    .from("certificates")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) {
    return { certificate: existing as Certificate, eligibility };
  }

  // Se não existir e o aluno NÃO for elegível, retorna nulo
  if (!eligibility.isEligible) {
    return { certificate: null, eligibility };
  }

  // Se o aluno for elegível e ainda não tiver certificado, emite agora
  const adminSupabase = createAdminSupabase();

  const [{ data: profile }, { data: course }, { data: enrollment }] = await Promise.all([
    adminSupabase.from("profiles").select("full_name").eq("id", userId).single(),
    adminSupabase.from("courses").select("title").eq("id", courseId).single(),
    adminSupabase
      .from("enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .single(),
  ]);

  const studentName = profile?.full_name?.trim() || "Aluno Easy English";
  const courseTitle = course?.title || "Easy English: Método 4 Cantos";
  const code = generateCertificateCode();
  const completedAt = new Date().toISOString();
  const hours = eligibility.calculatedWorkloadHours;

  const signature = computeCertificateSignature({
    userId,
    courseId,
    code,
    completedAt,
    hours,
  });

  const { data: created, error } = await adminSupabase
    .from("certificates")
    .insert({
      user_id: userId,
      course_id: courseId,
      enrollment_id: enrollment?.id || null,
      code,
      hash_signature: signature,
      student_name: studentName,
      course_title: courseTitle,
      workload_hours: hours,
      average_score: eligibility.averageScore,
      completed_at: completedAt,
      issued_at: completedAt,
      metadata: {
        total_lessons: eligibility.publishedLessons,
        cefr_level: "B2",
        platform: "Easy English Language Academy",
      },
    })
    .select("*")
    .single();

  if (error) {
    console.error("[certificate] Erro ao emitir certificado:", error.message);
    return { certificate: null, eligibility };
  }

  return { certificate: created as Certificate, eligibility };
}

/**
 * Consulta pública de verificação do certificado por código.
 * Acessível sem necessidade de autenticação prévia.
 */
export const getCertificateByCode = cache(
  async (
    code: string,
  ): Promise<{ certificate: Certificate | null; isValid: boolean; error?: string }> => {
    const cleanCode = code.trim().toUpperCase();
    const adminSupabase = createAdminSupabase();

    const { data: cert, error } = await adminSupabase
      .from("certificates")
      .select("*")
      .eq("code", cleanCode)
      .maybeSingle();

    if (error || !cert) {
      return { certificate: null, isValid: false, error: "Certificado não encontrado." };
    }

    const isValid = verifyCertificateSignature(cert as Certificate);

    return {
      certificate: cert as Certificate,
      isValid,
      error: isValid ? undefined : "Assinatura criptográfica inválida ou adulterada.",
    };
  },
);

/**
 * Lista todos os certificados emitidos para o painel de administração.
 */
export async function listAllCertificates(): Promise<Certificate[]> {
  const adminSupabase = createAdminSupabase();
  const { data } = await adminSupabase
    .from("certificates")
    .select("*")
    .order("issued_at", { ascending: false });
  return (data as Certificate[]) ?? [];
}

/**
 * Emissão de certificado de teste pelo administrador.
 * Permite ao admin gerar um certificado de teste para homologar a ferramenta de verificação.
 */
export async function issueAdminTestCertificate(params: {
  userId: string;
  studentName?: string;
  courseId: string;
  workloadHours?: number;
  averageScore?: number;
}): Promise<Certificate | null> {
  const adminSupabase = createAdminSupabase();

  const [{ data: profile }, { data: course }] = await Promise.all([
    adminSupabase.from("profiles").select("full_name").eq("id", params.userId).maybeSingle(),
    adminSupabase.from("courses").select("title").eq("id", params.courseId).maybeSingle(),
  ]);

  const studentName =
    params.studentName?.trim() || profile?.full_name?.trim() || "Aluno de Teste Easy English";
  const courseTitle = course?.title || "Easy English: Método 4 Cantos";
  const code = generateCertificateCode();
  const completedAt = new Date().toISOString();
  const hours = params.workloadHours || 180;
  const score = params.averageScore != null ? params.averageScore : 9.5;

  const signature = computeCertificateSignature({
    userId: params.userId,
    courseId: params.courseId,
    code,
    completedAt,
    hours,
  });

  const { data: created, error } = await adminSupabase
    .from("certificates")
    .upsert(
      {
        user_id: params.userId,
        course_id: params.courseId,
        code,
        hash_signature: signature,
        student_name: studentName,
        course_title: courseTitle,
        workload_hours: hours,
        average_score: score,
        completed_at: completedAt,
        issued_at: completedAt,
        metadata: {
          is_test_certificate: true,
          cefr_level: "B2",
          platform: "Easy English Language Academy",
        },
      },
      { onConflict: "user_id,course_id" },
    )
    .select("*")
    .single();

  if (error) {
    console.error("[certificate] Erro ao emitir certificado de teste:", error.message);
    return null;
  }

  return created as Certificate;
}

/**
 * Remove um certificado emitido pelo ID.
 */
export async function deleteCertificateById(certificateId: string): Promise<boolean> {
  const adminSupabase = createAdminSupabase();
  const { error } = await adminSupabase.from("certificates").delete().eq("id", certificateId);
  return !error;
}

