import type { Metadata } from "next";

import { CertificateActions } from "@/components/certificate/certificate-actions";
import { CertificateFrame } from "@/components/certificate/certificate-frame";
import { CertificateLocked } from "@/components/certificate/certificate-locked";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requirePaidUser } from "@/lib/auth/guards";
import { getOrCreateUserCertificate } from "@/lib/certificate";
import { serverEnv } from "@/lib/env";
import { getPrimaryCourse } from "@/lib/learning";

export const metadata: Metadata = { title: "Meu Certificado" };

export default async function CertificatePage() {
  const { userId } = await requirePaidUser("/app/certificado");
  const course = await getPrimaryCourse();

  if (!course) {
    return <EmptyState title="Nenhum curso ativo encontrado" />;
  }

  const { certificate, eligibility } = await getOrCreateUserCertificate(userId, course.id);

  // URL pública de verificação — é ela que vai dentro do QR Code, então
  // precisa ser a mesma origem do site (NEXT_PUBLIC_SITE_URL) e já carregar o
  // código do certificado.
  const verificationUrl = certificate
    ? `${serverEnv.certificateBaseUrl}/verificar-certificado/${certificate.code}`
    : `${serverEnv.certificateBaseUrl}/verificar-certificado`;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="no-print">
        <PageHeader
          eyebrow="Conquista Oficial"
          title="Meu Certificado"
          description="Seu certificado oficial de conclusão do curso Easy English, validado com criptografia SHA-256 e código de verificação."
        />
      </div>

      {certificate ? (
        <div className="space-y-8">
          <CertificateActions certificate={certificate} verificationUrl={verificationUrl} />
          <CertificateFrame certificate={certificate} verificationUrl={verificationUrl} />
        </div>
      ) : (
        <CertificateLocked eligibility={eligibility} courseTitle={course.title} />
      )}
    </div>
  );
}
