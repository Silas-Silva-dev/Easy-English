import { BadgeCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { formatBRL } from "@/lib/billing";
import { checkoutEnv } from "@/lib/env";
import { getInstallmentTable } from "@/lib/mercadopago/installments";

import { SignUpForm } from "../_components/auth-forms";

export const metadata: Metadata = { title: "Criar conta" };

/** Mesma regeneração horária da landing: o preço tem de bater nas duas telas. */
export const revalidate = 3600;

export default async function SignUpPage() {
  const priceCents = checkoutEnv.priceCents;
  const { options } = await getInstallmentTable(priceCents);
  const longest = options[options.length - 1];

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Comece hoje</h1>
        <p className="text-muted-foreground text-sm">
          Crie sua conta, confirme o e-mail e conclua o pagamento para liberar os 728 dias de curso.
        </p>
      </header>

      {/* O preço aparece ANTES do formulário: descobrir que é pago só no fim
          do cadastro é o tipo de surpresa que faz a pessoa fechar a aba. */}
      <div className="bg-muted/50 space-y-1.5 rounded-xl border p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <BadgeCheck className="text-success size-4" />
          Acesso completo por {formatBRL(priceCents)}
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Pagamento único, sem mensalidade.
          {longest && longest.installments > 1 ? (
            <>
              {" "}
              Parcele em até {longest.installments}x de {formatBRL(longest.installmentCents)} no
              cartão, ou pague à vista no PIX.
            </>
          ) : null}
        </p>
      </div>

      <SignUpForm />

      <p className="text-muted-foreground text-center text-sm">
        Já tem conta?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
