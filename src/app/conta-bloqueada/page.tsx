import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getSessionContext } from "@/lib/auth/guards";
import { formatDate } from "@/lib/utils";

import { signOutAction } from "../(auth)/actions";

export const metadata: Metadata = { title: "Conta bloqueada" };

export default async function BlockedAccountPage() {
  const session = await getSessionContext();

  if (!session) redirect("/login");
  if (session.profile.status === "active") redirect("/app");
  if (session.profile.status === "pending_verification") redirect("/verificar-email");

  const banned = session.profile.status === "banned";

  return (
    <div className="grid min-h-screen place-items-center px-5">
      <div className="bg-card w-full max-w-md rounded-xl border p-8 text-center shadow-xs">
        <div className="bg-destructive/10 text-destructive mx-auto grid size-14 place-items-center rounded-full">
          <ShieldAlert className="size-6" />
        </div>

        <h1 className="mt-5 text-xl font-semibold">
          {banned ? "Conta banida" : "Conta suspensa"}
        </h1>

        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {banned
            ? "Sua conta foi banida e o acesso ao conteúdo foi removido permanentemente."
            : "Sua conta está temporariamente suspensa e o acesso ao conteúdo está bloqueado."}
        </p>

        {session.profile.suspended_reason ? (
          <div className="bg-muted mt-5 rounded-lg px-4 py-3 text-left">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Motivo informado
            </p>
            <p className="mt-1.5 text-sm">{session.profile.suspended_reason}</p>
          </div>
        ) : null}

        <p className="text-muted-foreground mt-5 text-xs break-words">
          Conta criada em {formatDate(session.profile.created_at)} ·{" "}
          <span className="break-all">{session.email}</span>
        </p>

        <p className="text-muted-foreground mt-5 text-sm">
          Se você acredita que houve um engano, entre em contato com o suporte.
        </p>

        <form action={signOutAction} className="mt-7">
          <Button type="submit" variant="outline" className="w-full">
            Sair
          </Button>
        </form>
      </div>
    </div>
  );
}
