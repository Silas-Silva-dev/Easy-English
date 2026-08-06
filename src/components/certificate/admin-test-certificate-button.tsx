"use client";

import { Award, ExternalLink, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { generateTestCertificateAction, deleteCertificateAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AdminTestCertificateButton() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [createdCode, setCreatedCode] = React.useState<string | null>(null);

  const [studentName, setStudentName] = React.useState("Aluno de Teste Easy English");
  const [workloadHours, setWorkloadHours] = React.useState("180");
  const [averageScore, setAverageScore] = React.useState("9.8");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await generateTestCertificateAction({
        studentName,
        workloadHours: Number(workloadHours) || 180,
        averageScore: Number(averageScore) || 9.8,
      });

      if (res.ok && res.certificateCode) {
        toast.success(res.message);
        setCreatedCode(res.certificateCode);
      } else {
        toast.error(res.error || "Falha ao emitir certificado de teste.");
      }
    } catch {
      toast.error("Erro ao emitir certificado.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setCreatedCode(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2 font-medium bg-amber-600 hover:bg-amber-700 text-white">
          <Sparkles className="size-4" /> Gerar Certificado de Teste
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="size-5 text-amber-500" /> Emissão de Certificado de Teste
          </DialogTitle>
          <DialogDescription>
            Crie instantaneamente um certificado de teste assinado criptograficamente para homologar a ferramenta visual e a verificação por QR Code / Link.
          </DialogDescription>
        </DialogHeader>

        {createdCode ? (
          <div className="space-y-4 py-4 text-center">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-950 dark:text-emerald-100">
              <p className="text-sm font-semibold">Certificado Emitido e Assinado!</p>
              <p className="mt-1 font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                {createdCode}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
              <Button asChild className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Link href={`/verificar-certificado/${createdCode}`} target="_blank">
                  <ExternalLink className="size-4" /> Visualizar Certificado
                </Link>
              </Button>
              <Button variant="outline" onClick={() => setCreatedCode(null)}>
                Gerar Outro
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Nome Completo no Certificado</label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="Ex: Silas de Oliveira Silva"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Carga Horária (Horas)</label>
                <input
                  type="number"
                  value={workloadHours}
                  onChange={(e) => setWorkloadHours(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  min={1}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Média Final (0 a 10)</label>
                <input
                  type="number"
                  step="0.1"
                  value={averageScore}
                  onChange={(e) => setAverageScore(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  min={0}
                  max={10}
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                {loading && <Loader2 className="size-4 animate-spin" />}
                Gerar Certificado
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AdminDeleteCertificateButton({ certificateId, code }: { certificateId: string; code: string }) {
  const [loading, setLoading] = React.useState(false);

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir permanentemente o certificado ${code} do banco de dados? Ele deixará de ser verificado.`)) return;
    setLoading(true);

    try {
      const res = await deleteCertificateAction(certificateId);
      if (res.ok) {
        toast.success(res.message);
      } else {
        toast.error(res.error || "Erro ao excluir.");
      }
    } catch {
      toast.error("Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDelete}
      disabled={loading}
      className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
      title="Excluir Certificado"
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </Button>
  );
}
