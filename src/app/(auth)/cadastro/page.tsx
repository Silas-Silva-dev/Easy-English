import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "../_components/auth-forms";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Comece hoje</h1>
        <p className="text-muted-foreground text-sm">
          Crie sua conta e receba o cronograma de 728 dias.
        </p>
      </header>

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
