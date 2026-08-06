import { CheckCircle2, Lock, Search, ShieldAlert, ShieldCheck, Waves } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CertificateActions } from "@/components/certificate/certificate-actions";
import { CertificateFrame } from "@/components/certificate/certificate-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCertificateByCode } from "@/lib/certificate";
import { serverEnv } from "@/lib/env";

interface VerifyPageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: VerifyPageProps): Promise<Metadata> {
  const { code } = await params;
  const { certificate, isValid } = await getCertificateByCode(code);

  if (!certificate || !isValid) {
    return { title: "Verificação de Certificado — Easy English" };
  }

  return {
    title: `Certificado de ${certificate.student_name} — Easy English`,
    description: `Validação oficial do certificado de conclusão de curso para ${certificate.student_name}. Carga horária: ${certificate.workload_hours} horas.`,
  };
}

export default async function PublicVerifyCertificatePage({ params }: VerifyPageProps) {
  const { code } = await params;
  const { certificate, isValid, error } = await getCertificateByCode(code);

  const verificationUrl = `${serverEnv.certificateBaseUrl}/verificar-certificado/${code}`;

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Cabeçalho da Marca com Logomarca Oficial (Oculto na impressão/PDF) */}
        <div className="no-print text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
              <Waves className="size-6" />
            </span>
            <span className="text-2xl font-bold tracking-tight text-foreground">
              Easy <span className="text-primary">English</span>
            </span>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Portal Oficial de Verificação de Autenticidade de Certificados
          </p>
        </div>

        {certificate && isValid ? (
          <div className="space-y-8">
            {/* Banner de Validade Confirmada (Oculto na impressão/PDF) */}
            <Card className="no-print border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100">
              <CardHeader className="py-4">
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <div className="flex items-center gap-3 text-center sm:text-left">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="size-7" />
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-2 sm:justify-start">
                        <Badge variant="success" className="bg-emerald-600 text-white">
                          AUTÊNTICO E VÁLIDO
                        </Badge>
                        <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">{certificate.code}</span>
                      </div>
                      <h2 className="mt-1 text-lg font-bold text-foreground">
                        Certificado Verificado com Sucesso
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Emitido para <strong className="text-foreground">{certificate.student_name}</strong> em{" "}
                        {new Date(certificate.completed_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>

                  <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
                    <Link href="/verificar-certificado">
                      <Search className="size-3.5" /> Verificar Outro Código
                    </Link>
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Ações e Certificado Visual */}
            <CertificateActions certificate={certificate} verificationUrl={verificationUrl} />
            <CertificateFrame certificate={certificate} verificationUrl={verificationUrl} />
          </div>
        ) : (
          /* Banner de Erro / Inválido */
          <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/5">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <ShieldAlert className="size-7" />
              </div>
              <CardTitle className="text-xl font-bold text-destructive">
                Certificado Não Encontrado ou Inválido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                O código informado <code className="font-mono font-bold text-foreground">{code}</code> não foi localizado no registro oficial ou sua assinatura criptográfica não confere.
              </p>
              {error && <p className="text-xs font-semibold text-destructive">{error}</p>}

              <div className="pt-4">
                <Button asChild className="gap-2">
                  <Link href="/verificar-certificado">
                    <Search className="size-4" /> Buscar Outro Código
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
