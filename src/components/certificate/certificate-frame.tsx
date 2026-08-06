"use client";

import { Lock, ShieldCheck, Waves } from "lucide-react";
import * as React from "react";

import { generateQRCodeSVG } from "@/lib/qr";
import type { Certificate } from "@/lib/types/database";

import { CertificateSeal } from "./certificate-seal";
import { CertificateSecurityPattern } from "./certificate-security-pattern";

interface CertificateFrameProps {
  certificate: Certificate;
  verificationUrl: string;
}

/**
 * Certificado visual.
 *
 * Toda a geometria — proporção da folha, tamanhos de fonte, espaçamentos —
 * mora em `globals.css`, no bloco `.certificate-sheet`, escrita em `cqw` sobre
 * um quadro na proporção de uma A4 paisagem. Por isso a prévia da tela e o PDF
 * impresso são o mesmo desenho, só que em escalas diferentes: aqui ficam
 * apenas a estrutura e as cores.
 */
export function CertificateFrame({ certificate, verificationUrl }: CertificateFrameProps) {
  const completedAt = new Date(certificate.completed_at);
  const formattedDate = completedAt.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const shortDate = completedAt.toLocaleDateString("pt-BR");

  // Preto puro sobre branco puro: é o contraste que os leitores de QR esperam,
  // tanto na tela quanto no papel.
  const qrSvg = React.useMemo(
    () =>
      generateQRCodeSVG(verificationUrl, {
        errorCorrectionLevel: "M",
        quietZone: 4,
        foreground: "#000000",
        background: "#ffffff",
        title: `Validar certificado ${certificate.code}`,
      }),
    [verificationUrl, certificate.code],
  );

  return (
    // Abaixo da largura mínima da folha a prévia rola na horizontal, em vez de
    // encolher a ponto de o texto ficar ilegível.
    <div className="cert-viewport">
      <div
        id="certificate-print-target"
        className="certificate-sheet border border-amber-500/30 bg-card shadow-2xl"
      >
        {/* Guilhoché, faixas e arabescos — a camada que dá cara de documento
            de segurança em vez de cara de modelo pronto. */}
        <div className="cert-security-layer text-amber-700 dark:text-amber-500">
          <CertificateSecurityPattern />
        </div>

        <div className="certificate-inner">
          {/* Brilho quente de fundo, sob a moldura */}
          <div className="cert-wash pointer-events-none bg-gradient-to-br from-amber-500/5 via-transparent to-primary/5" />

          {/* Moldura dupla */}
          <div className="cert-border-outer pointer-events-none border-amber-500/40" />
          <div className="cert-border-inner pointer-events-none border-amber-500/20" />

          {/* Cabeçalho oficial */}
          <header className="cert-header">
            <div className="cert-brand">
              <span className="cert-brand-mark bg-primary text-primary-foreground">
                <Waves className="cert-brand-icon" />
              </span>
              <span className="cert-brand-name font-black tracking-tight text-foreground">
                Easy <span className="text-primary">English</span>
              </span>
            </div>

            <div className="cert-eyebrow">
              <span className="cert-rule bg-amber-500/40" />
              <p className="cert-eyebrow-text font-semibold uppercase text-amber-700 dark:text-amber-400">
                Easy English Language Academy
              </p>
              <span className="cert-rule bg-amber-500/40" />
            </div>

            <h1 className="cert-title font-serif text-foreground">Certificado de Conclusão</h1>

            <p className="cert-lead text-muted-foreground">
              Certificamos para os devidos fins de direito e comprovação que
            </p>
          </header>

          {/* Nome do aluno — destaque principal */}
          <section className="cert-name">
            <h2 className="cert-name-text font-serif text-primary">{certificate.student_name}</h2>
            <div className="cert-name-rule">
              <span className="cert-name-rule-line bg-gradient-to-r from-transparent to-amber-500/70" />
              <span className="cert-name-rule-gem bg-amber-500" />
              <span className="cert-name-rule-line bg-gradient-to-l from-transparent to-amber-500/70" />
            </div>
          </section>

          {/* Descrição do curso e carga horária */}
          <section className="cert-body text-foreground/90">
            <p>
              concluiu com êxito e aprovação o curso intensivo{" "}
              <strong className="font-semibold text-foreground">{certificate.course_title}</strong>,
              com carga horária total de{" "}
              <strong className="font-bold text-amber-700 dark:text-amber-400">
                {certificate.workload_hours} Horas
              </strong>{" "}
              de estudos, práticas de conversação e missões de comunicação em inglês.
            </p>
          </section>

          {/* Métricas: três colunas separadas por filetes, sem caixa */}
          <section className="cert-metrics border-amber-500/25">
            <div className="cert-metric border-amber-500/25">
              <span className="cert-metric-label uppercase text-muted-foreground">
                Data de Conclusão
              </span>
              <p className="cert-metric-value font-serif text-foreground">{formattedDate}</p>
            </div>
            <div className="cert-metric border-amber-500/25">
              <span className="cert-metric-label uppercase text-muted-foreground">
                Média Final de Avaliação
              </span>
              <p className="cert-metric-value font-serif text-emerald-700 dark:text-emerald-400">
                {Number(certificate.average_score).toFixed(1)} / 10.0
              </p>
            </div>
            <div className="cert-metric border-amber-500/25">
              <span className="cert-metric-label uppercase text-muted-foreground">
                Nível Alcançado
              </span>
              <p className="cert-metric-value font-serif text-primary">CEFR B2 · Fluência Verbal</p>
            </div>
          </section>

          <footer className="cert-footer">
            {/* Bloco de validação: QR e os dados de autenticidade formam uma
                unidade só, lida da esquerda para a direita. */}
            <div className="cert-validation border-amber-500/30 bg-amber-500/[0.04]">
              <div
                className="cert-qr-code border-amber-500/25"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <div className="cert-validation-body">
                <p className="cert-validation-title font-semibold uppercase text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="cert-validation-icon" />
                  Documento autenticado e válido
                </p>
                <p className="cert-validation-code font-mono text-foreground">{certificate.code}</p>
                <p className="cert-validation-hint text-muted-foreground">
                  Escaneie o QR Code ou informe o código no portal oficial de verificação.
                </p>
              </div>
            </div>

            {/* Assinatura digital da plataforma */}
            <div className="cert-signature">
              <CertificateSeal className="cert-signature-seal text-amber-700 dark:text-amber-500" />
              <div className="cert-signature-body">
                <p className="cert-signature-name font-serif italic text-foreground">
                  Plataforma Easy English
                </p>
                <span className="cert-signature-rule bg-foreground/35" />
                <p className="cert-signature-role uppercase text-foreground/70">
                  Direção Acadêmica
                </p>
                <p className="cert-signature-meta text-muted-foreground">
                  <Lock className="cert-signature-icon" />
                  Assinado digitalmente em {shortDate}
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>

      <p className="no-print mt-3 text-center text-xs text-muted-foreground sm:hidden">
        Prévia reduzida do documento. Use <strong className="font-medium text-foreground">
        Imprimir / Salvar PDF</strong> para o arquivo em tamanho real.
      </p>
    </div>
  );
}
