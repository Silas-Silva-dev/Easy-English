import { MailCheck, Waves } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { getSessionContext } from "@/lib/auth/guards";

import { signOutAction } from "../(auth)/actions";
import { ResendVerificationForm } from "../(auth)/_components/auth-forms";

export const metadata: Metadata = { title: "Verifique seu e-mail" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const session = await getSessionContext();

  // Conta já verificada não tem o que fazer aqui.
  if (session?.profile.status === "active") redirect("/app");

  const address = session?.email ?? email;

  return (
    <div className="relative grid min-h-screen place-items-center px-5">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10" />

      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>

      <div className="animate-in-up w-full max-w-md space-y-8">
        <Link href="/" className="flex items-center justify-center gap-2 font-semibold">
          <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg">
            <Waves className="size-4" />
          </span>
          InglishEasy
        </Link>

        <div className="bg-card rounded-xl border p-8 text-center shadow-xs">
          <div className="bg-primary/10 text-primary mx-auto grid size-14 place-items-center rounded-full">
            <MailCheck className="size-6" />
          </div>

          <h1 className="mt-5 text-xl font-semibold">Confirme seu e-mail</h1>

          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            Enviamos um link de verificação
            {address ? (
              <>
                {" "}
                para <strong className="text-foreground">{address}</strong>
              </>
            ) : null}
            . Clique nele para ativar sua conta e liberar o acesso ao curso.
          </p>

          <p className="text-muted-foreground mt-4 text-xs">
            Não chegou? Verifique a caixa de spam ou peça o reenvio abaixo.
          </p>

          <div className="mt-7 text-left">
            <ResendVerificationForm email={address} />
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 text-sm">
          {session ? (
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sair desta conta
              </Button>
            </form>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Voltar ao login</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
