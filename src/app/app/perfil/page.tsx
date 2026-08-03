import { Mail, ShieldCheck, User } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireActiveUser, ROLE_LABEL, STATUS_LABEL } from "@/lib/auth/guards";
import { getOrCreateEnrollment, getPrimaryCourse } from "@/lib/learning";
import { formatDate } from "@/lib/utils";

import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const { userId, profile, email } = await requireActiveUser("/app/perfil");

  // A trilha efetiva mora na matrícula; o perfil guarda só a preferência.
  const course = await getPrimaryCourse();
  const enrollment = course ? await getOrCreateEnrollment(userId, course) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Conta"
        title="Meu perfil"
        description="Ajuste seus dados e a meta diária de estudo."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4" /> Situação da conta
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">E-mail</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm break-all">
              <Mail className="size-3.5 shrink-0" />
              {email}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">Papel</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm">
              <User className="size-3.5" />
              {ROLE_LABEL[profile.role]}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">Status</p>
            <Badge variant="success" className="mt-1.5">
              {STATUS_LABEL[profile.status]}
            </Badge>
          </div>
          <div className="sm:col-span-3">
            <p className="text-muted-foreground text-xs">
              Conta criada em {formatDate(profile.created_at)}
              {profile.email_verified_at
                ? ` · e-mail verificado em ${formatDate(profile.email_verified_at)}`
                : null}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preferências de estudo</CardTitle>
          <CardDescription>
            O ritmo define o que o curso promete a você — e o que ele não promete. A meta diária
            define quando o dia conta para a sua ofensiva.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} track={enrollment?.track ?? "complete"} />
        </CardContent>
      </Card>
    </div>
  );
}
