"use client";

import { Check, Copy, ExternalLink, Printer, Share2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Certificate } from "@/lib/types/database";

interface CertificateActionsProps {
  certificate: Certificate;
  verificationUrl: string;
}

export function CertificateActions({ certificate, verificationUrl }: CertificateActionsProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(verificationUrl);
      setCopied(true);
      toast.success("Link de verificação copiado para a área de transferência!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLinkedInShare = () => {
    // Gerar URL de adição direta de certificação no LinkedIn
    const issueDate = new Date(certificate.completed_at);
    const year = issueDate.getFullYear();
    const month = issueDate.getMonth() + 1;

    const linkedinUrl = new URL("https://www.linkedin.com/profile/add");
    linkedinUrl.searchParams.set("startTask", "CERTIFICATION_NAME");
    linkedinUrl.searchParams.set("name", certificate.course_title);
    linkedinUrl.searchParams.set("organizationName", "Easy English Language Academy");
    linkedinUrl.searchParams.set("issueYear", String(year));
    linkedinUrl.searchParams.set("issueMonth", String(month));
    linkedinUrl.searchParams.set("certUrl", verificationUrl);
    linkedinUrl.searchParams.set("certId", certificate.code);

    window.open(linkedinUrl.toString(), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="no-print flex flex-wrap items-center justify-center gap-3">
      <Button onClick={handlePrint} size="lg" className="gap-2 font-medium">
        <Printer className="size-4" />
        Imprimir / Salvar PDF
      </Button>

      <Button
        onClick={handleCopyLink}
        variant="outline"
        size="lg"
        className="gap-2 font-medium"
      >
        {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
        {copied ? "Link Copiado!" : "Copiar Link de Autenticidade"}
      </Button>

      <Button
        onClick={handleLinkedInShare}
        variant="secondary"
        size="lg"
        className="gap-2 bg-blue-600/10 font-medium text-blue-600 hover:bg-blue-600/20 dark:bg-blue-500/20 dark:text-blue-400"
      >
        <svg className="size-4 fill-current" viewBox="0 0 24 24">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
        </svg>
        Adicionar ao LinkedIn
      </Button>
    </div>
  );
}
