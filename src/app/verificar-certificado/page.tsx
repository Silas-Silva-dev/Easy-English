"use client";

import { Award, Search, ShieldCheck, Waves } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CertificateSearchPage() {
  const [code, setCode] = React.useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean) {
      router.push(`/verificar-certificado/${encodeURIComponent(clean)}`);
    }
  };

  return (
    <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl space-y-8">
        {/* Cabeçalho com Logomarca Oficial */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
              <Waves className="size-6" />
            </span>
            <span className="text-2xl font-bold tracking-tight text-foreground">
              Easy <span className="text-primary">English</span>
            </span>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Validação Autêntica de Certificados de Conclusão
          </p>
        </div>

        <Card className="border-amber-500/30 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="size-7" />
            </div>
            <CardTitle className="text-2xl font-bold">Verificar Certificado</CardTitle>
            <CardDescription>
              Digite o código de verificação impresso no certificado (exemplo: EE-2026-X8F9A4B2) para consultar sua autenticidade e registro no sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ex: EE-2026-7A9F3C1B"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-4 py-3 text-center text-lg font-mono tracking-widest uppercase text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  required
                />
              </div>

              <Button type="submit" size="lg" className="w-full gap-2 text-base font-medium">
                <Search className="size-5" />
                Verificar Autenticidade
              </Button>
            </form>

            <div className="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
              <p>
                Todos os certificados emitidos pela Easy English possuem hash de segurança criptográfico HMAC-SHA256 à prova de falsificação.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
