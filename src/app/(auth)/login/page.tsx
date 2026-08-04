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
          Entre e retome seu cronograma exatamente de onde parou.
        </p>
      </header>

      {erro === "link-invalido" ? (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">
          O link expirou ou já foi usado. Faça login ou solicite um novo.
        </p>
      ) : null}

      <SignInForm next={next} />

      {/*
        Dizia "Criar conta grátis" — uma promessa que o checkout desmente três
        telas depois. Descobrir o preço só no fim do cadastro é o caminho mais
        curto para o aluno fechar a aba se sentindo enganado. O preço em si
        aparece logo no topo de /cadastro, antes do formulário.
      */}
      <p className="text-muted-foreground text-center text-sm">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="text-primary font-medium hover:underline">
          Criar minha conta
        </Link>
      </p>
    </div>
  );
}
