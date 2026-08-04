import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "../_components/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Recuperar acesso</h1>
        <p className="text-muted-foreground text-sm">
          Informe o e-mail da conta e enviaremos um link para você criar uma nova senha.
        </p>
      </header>

      <ForgotPasswordForm />

      <p className="text-muted-foreground text-center text-sm">
        Lembrou a senha?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}
