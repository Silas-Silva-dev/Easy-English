import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "../_components/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  // /nova-senha manda para cá quando o link não trouxe sessão válida. Sem esta
  // mensagem, quem clica num link expirado volta para o formulário sem
  // entender por que não caiu na tela de trocar a senha.
  const { erro } = await searchParams;

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Recuperar acesso</h1>
        <p className="text-muted-foreground text-sm">
          Informe o e-mail da conta e enviaremos um link para você criar uma nova senha.
        </p>
      </header>

      {erro === "link-invalido" ? (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">
          O link expirou ou já foi usado. Peça um novo abaixo.
        </p>
      ) : null}

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
