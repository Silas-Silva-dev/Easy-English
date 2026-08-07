import "server-only";

import { createHmac } from "node:crypto";
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

/** Corte usado apenas se o curso ainda não tiver a nota mínima cadastrada. */
const DEFAULT_MIN_CERTIFICATE_SCORE = 7.0;

/**
 * Verifica a elegibilidade do aluno para obtenção do certificado.
 * Requisitos estritos:
 * 1. Conclusão de 100% das lições publicadas do curso.
 * 2. Pelo menos uma aula com a fala avaliada — sem gravação não há média.
 * 3. Média >= a nota mínima cadastrada no curso.
 *
 * A média é sobre a ÚLTIMA gravação de cada aula, e só das aulas deste curso.
 * A prática livre de "Praticar Fala" não entra, e regravar substitui a nota
 * anterior em vez de somar mais uma tentativa.
 */
export const checkCertificateEligibility = cache(
  async (userId: string, courseId: string): Promise<CertificateEligibility> => {
    const supabase = await createServerSupabase();

    // 1. Buscar estatísticas das lições do curso
    const [{ data: publishedLessons }, { data: enrollment }, { data: course }] = await Promise.all([
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
      supabase
        .from("courses")
        .select("min_certificate_score")
        .eq("id", courseId)
        .maybeSingle(),
    ]);

    // A nota de corte é cadastrada no curso, pelo painel administrativo.
    const minScoreRequired = Number(course?.min_certificate_score ?? DEFAULT_MIN_CERTIFICATE_SCORE);

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
        speakingEvaluations: 0,
        minScoreRequired,
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

    /**
     * 3. Média das avaliações de fala DAS AULAS DESTE CURSO.
     *
     * A consulta passa por `speaking_sessions` de propósito. Ler
     * `speaking_feedback` direto por `user_id` — que era o que estava aqui —
     * somava tudo que o aluno já gravou, inclusive a prática livre da tela
     * "Praticar Fala": ela chama o mesmo `PracticeStation` sem `lessonId`
     * (`src/app/app/conversacao/page.tsx`), e a nota daquele treino entrava na
     * média que decide o certificado. Treino solto vira nota de prova.
     *
     * O filtro é `course_id`, e não `lesson_id is not null`, porque ele resolve
     * dois problemas de uma vez: a rota de análise só preenche `course_id`
     * quando veio de uma lição (deriva dele — `api/speaking/analyze`), então
     * ele já exclui a prática livre, e ainda impede que a nota de outro curso
     * conte para o certificado deste.
     *
     * `status = completed` fecha a última porta: sessão com áudio inaudível é
     * marcada como `failed` e não pode pesar na média.
     */
    const { data: sessionRows } = await supabase
      .from("speaking_sessions")
      .select("lesson_id, created_at, speaking_feedback(overall_score)")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("status", "completed")
      .not("lesson_id", "is", null)
      .order("created_at", { ascending: false });

    /**
     * Uma nota por aula: a da ÚLTIMA gravação.
     *
     * A tela de fala oferece "Regravar fala", então regravar é o caminho
     * esperado — o aluno ouve a correção e tenta de novo. Media-las todas
     * punia exatamente esse comportamento: uma aula com 9.2 ← 8.5 ← 9.2 ←
     * 9.2 ← 6 carregava para sempre o 6 da primeira tentativa, e quanto mais
     * o aluno treinasse, mais tentativas ruins ele acumulava.
     *
     * A lista vem ordenada por data decrescente, então a primeira de cada
     * lição é a mais recente. Sessões sem feedback não entram: uma gravação
     * ainda em processamento não pode apagar a nota válida anterior.
     */
    const porLicao = new Map<string, { overall_score: number | string }>();
    for (const row of sessionRows ?? []) {
      if (!row.lesson_id || porLicao.has(row.lesson_id)) continue;
      const fb = row.speaking_feedback;
      const nota = Array.isArray(fb) ? fb[0] : fb;
      if (nota) porLicao.set(row.lesson_id, nota);
    }

    // Sem nenhuma gravação não existe média: antes o valor caía num 10.0 fixo e
    // liberava o certificado para quem nunca foi avaliado.
    const evaluations = [...porLicao.values()];
    const speakingEvaluations = evaluations.length;
    let averageScore = 0;
    if (speakingEvaluations > 0) {
      /**
       * Soma em décimos inteiros, não em ponto flutuante.
       *
       * `overall_score` é `numeric(4,1)`, então um décimo é a menor unidade
       * que existe e cabe em inteiro sem perda. Somando em float, o resultado
       * dependia da ORDEM das linhas: as notas 9.5, 7.6, 6.8 e 8.0 dão 7.975,
       * e a mesma média saía 7.97 ou 7.98 conforme a ordem que o banco
       * devolvia — porque soma de float não é associativa e 7.975 cai bem em
       * cima da fronteira de arredondamento.
       *
       * Numa média que decide certificado, isso é passar ou não passar por
       * causa da ordenação de uma consulta.
       */
      const totalTenths = evaluations.reduce(
        (acc, row) => acc + Math.round(Number(row.overall_score || 0) * 10),
        0,
      );
      averageScore = Math.round((totalTenths * 10) / speakingEvaluations) / 100;
    }

    const reasons: string[] = [];

    if (totalPublished === 0 || completed < totalPublished) {
      reasons.push(
        `Você precisa concluir todas as lições do curso (Progresso atual: ${completed}/${totalPublished} lições - ${progressPct}%).`,
      );
    }

    // As mensagens dizem "dentro das aulas" porque a prática livre da tela
    // "Praticar Fala" não entra nesta conta. Mandar "gravar as práticas de
    // conversação", como estava, empurrava o aluno justamente para a tela cuja
    // nota é descartada.
    if (speakingEvaluations === 0) {
      reasons.push(
        "Você ainda não tem nenhuma avaliação de fala registrada. Grave as práticas de fala dentro das aulas para que sua média seja calculada.",
      );
    } else if (averageScore < minScoreRequired) {
      reasons.push(
        `Sua média atual nas práticas de fala das aulas é ${averageScore.toFixed(1)}. É necessário atingir média mínima de ${minScoreRequired.toFixed(1)}.`,
      );
    }

    const isEligible = reasons.length === 0;

    return {
      isEligible,
      publishedLessons: totalPublished,
      completedLessons: completed,
      lessonsProgressPct: progressPct,
      averageScore,
      speakingEvaluations,
      minScoreRequired,
      calculatedWorkloadHours,
      reasons,
    };
  },
);

/** Marca gravada por `issueAdminTestCertificate` nas emissoes de homologacao. */
function isTestCertificate(certificate: Certificate): boolean {
  const metadata = certificate.metadata as { is_test_certificate?: boolean } | null;
  return metadata?.is_test_certificate === true;
}

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

  // Certificado de teste, emitido pelo painel para homologar o visual e o QR,
  // nao e conquista de aluno nenhum: para ele esse registro nao existe, e a
  // tela segue mostrando o progresso do curso. O codigo continua verificavel
  // no portal publico, que e para o que ele foi criado.
  if (existing && !isTestCertificate(existing as Certificate)) {
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

  // `upsert` e nao `insert`: a tabela tem unique (user_id, course_id) e pode
  // haver uma linha de teste ocupando o lugar. Aluno elegivel recebe o
  // certificado de verdade por cima dela.
  const { data: created, error } = await adminSupabase
    .from("certificates")
    .upsert(
      {
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
      },
      { onConflict: "user_id,course_id" },
    )
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

