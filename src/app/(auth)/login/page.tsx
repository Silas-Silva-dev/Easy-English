import type { Metadata } from "next";
import Link from "next/link";

import { SignInForm } from "../_components/auth-forms";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const { next, erro } = await searchParams;

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Bem-vindo de volta</h1>
        <p className="text-muted-foreground text-sm">
          Entre para continuar seu cronograma de estudo.
        </p>
      </header>

      {erro === "link-invalido" ? (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">
          O link expirou ou já foi usado. Faça login ou solicite um novo.
        </p>
      ) : null}

      <SignInForm next={next} />

      <p className="text-muted-foreground text-center text-sm">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="text-primary font-medium hover:underline">
          Criar conta grátis
        </Link>
      </p>
    </div>
  );
}
