import { Waves } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase/server";

import { NewPasswordForm } from "../(auth)/_components/auth-forms";

export const metadata: Metadata = { title: "Definir nova senha" };

export default async function NewPasswordPage() {
  // O link de recuperação já trocou o código por sessão em /auth/confirm.
  // Sem sessão aqui, o link expirou ou foi adulterado.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/recuperar-senha?erro=link-invalido");

  return (
    <div className="grid min-h-screen place-items-center px-5">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10" />

      <div className="animate-in-up w-full max-w-sm space-y-7">
        <Link href="/" className="flex items-center justify-center gap-2 font-semibold">
          <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg">
            <Waves className="size-4" />
          </span>
          InglishEasy
        </Link>

        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Defina sua nova senha</h1>
          <p className="text-muted-foreground text-sm">
            Escolha uma senha com pelo menos 8 caracteres.
          </p>
        </header>

        <NewPasswordForm />
      </div>
    </div>
  );
}
