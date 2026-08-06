import { Award, ExternalLink, Eye, Search, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  AdminDeleteCertificateButton,
  AdminTestCertificateButton,
} from "@/components/certificate/admin-test-certificate-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { StatCard } from "@/components/ui/stat-card";
import { requireStaff } from "@/lib/auth/guards";
import { listAllCertificates } from "@/lib/certificate";

export const metadata: Metadata = { title: "Gestão de Certificados — Admin" };

export default async function AdminCertificatesPage() {
  await requireStaff("/admin/certificados");
  const certificates = await listAllCertificates();

  const totalCertificates = certificates.length;
  const avgScore =
    totalCertificates > 0
      ? (
          certificates.reduce((acc, c) => acc + Number(c.average_score || 10), 0) /
          totalCertificates
        ).toFixed(1)
      : "10.0";

  const totalHoursCert = certificates.reduce((acc, c) => acc + (c.workload_hours || 180), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <PageHeader
          eyebrow="Administração"
          title="Gestão de Certificados"
          description="Auditoria, acompanhamento e registro de todos os certificados de conclusão de curso emitidos pela plataforma."
        />
        <AdminTestCertificateButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Certificados Emitidos"
          value={totalCertificates}
          hint="alunos graduados"
          icon={<Award />}
          tone="success"
        />
        <StatCard
          label="Média dos Formandos"
          value={`${avgScore} / 10`}
          hint="nas avaliações de fala"
          icon={<ShieldCheck />}
        />
        <StatCard
          label="Carga Horária Total"
          value={`${totalHoursCert}h`}
          hint="de aprendizado certificado"
          icon={<Users />}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold">Registro Geral de Emissões</CardTitle>
            <CardDescription>
              Relação completa de todos os alunos com certificados válidos e registrados com hash SHA-256.
            </CardDescription>
          </div>
          <AdminTestCertificateButton />
        </CardHeader>
        <CardContent>
          {certificates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Aluno</th>
                    <th className="py-3 px-4">Curso</th>
                    <th className="py-3 px-4">Carga Horária</th>
                    <th className="py-3 px-4">Média</th>
                    <th className="py-3 px-4">Emissão</th>
                    <th className="py-3 px-4 text-right">Ações / Verificação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {certificates.map((cert) => (
                    <tr key={cert.id} className="hover:bg-muted/30">
                      <td className="py-3.5 px-4 font-mono font-semibold text-primary">
                        <div className="flex items-center gap-2">
                          <span>{cert.code}</span>
                          {cert.metadata?.is_test_certificate && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
                              Teste
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        {cert.student_name}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">{cert.course_title}</td>
                      <td className="py-3.5 px-4 font-semibold text-amber-600 dark:text-amber-400">
                        {cert.workload_hours}h
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="success">
                          {Number(cert.average_score).toFixed(1)}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        {new Date(cert.issued_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs font-medium border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">
                            <Link href={`/verificar-certificado/${cert.code}`} target="_blank">
                              <Eye className="size-3.5" /> Visualizar & Validar
                            </Link>
                          </Button>
                          <AdminDeleteCertificateButton certificateId={cert.id} code={cert.code} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Award className="mx-auto size-10 text-muted-foreground/50 mb-2" />
              <p>Nenhum certificado emitido ainda.</p>
              <p className="mt-1 text-xs">
                Clique no botão <strong>"Gerar Certificado de Teste"</strong> acima para criar um certificado de teste e homologar a ferramenta de verificação.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
