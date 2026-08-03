import {
  BookOpen,
  FileEdit,
  GraduationCap,
  Mic,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { GrowthAreaChart } from "@/components/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { StatCard } from "@/components/ui/stat-card";
import { requireStaff, ROLE_LABEL } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatRelative, pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Visão geral" };

export default async function AdminDashboard() {
  await requireStaff("/admin");
  const supabase = await createServerSupabase();

  const [{ data: overview }, { data: recentUsers }, { data: recentSessions }, { data: signupSeries }] =
    await Promise.all([
      supabase.from("admin_overview").select("*").maybeSingle(),
      supabase
        .from("profiles")
        .select("id, full_name, email, role, status, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("speaking_sessions")
        .select("id, prompt, created_at, status, profiles(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
        .order("created_at"),
    ]);

  // Cadastros acumulados nos últimos 30 dias
  const byDay = new Map<string, number>();
  for (const row of signupSeries ?? []) {
    const key = row.created_at.slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  let running = 0;
  const growth = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    const key = date.toISOString().slice(0, 10);
    running += byDay.get(key) ?? 0;
    return {
      date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      value: running,
    };
  });

  const draftLessons = (overview?.total_lessons ?? 0) - (overview?.published_lessons ?? 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Administração"
        title="Visão geral"
        description="Estado da plataforma: contas, conteúdo e uso da tutora de IA."
      />

      {/* -------------------------------------------------------- Alertas */}
      {(overview?.pending_users ?? 0) > 0 || draftLessons > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(overview?.pending_users ?? 0) > 0 ? (
            <Link
              href="/admin/usuarios?status=pending_verification"
              className="border-warning/30 bg-warning/8 card-hover flex items-center gap-3 rounded-xl border p-4"
            >
              <ShieldAlert className="text-warning size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {overview!.pending_users} conta(s) aguardando verificação de e-mail
                </p>
                <p className="text-muted-foreground text-xs">
                  Você pode confirmar manualmente pelo painel de usuários.
                </p>
              </div>
            </Link>
          ) : null}

          {draftLessons > 0 ? (
            <Link
              href="/admin/licoes?status=rascunho"
              className="border-primary/25 bg-primary/6 card-hover flex items-center gap-3 rounded-xl border p-4"
            >
              <FileEdit className="text-primary size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{draftLessons} lições despublicadas</p>
                <p className="text-muted-foreground text-xs">
                  O curso vem inteiro publicado pelo seed. Estas foram despublicadas manualmente.
                </p>
              </div>
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* -------------------------------------------------------- Métricas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Usuários"
          value={overview?.total_users ?? 0}
          hint={`${overview?.new_users_30d ?? 0} novos em 30 dias`}
          icon={<Users />}
        />
        <StatCard
          label="Contas ativas"
          value={overview?.active_users ?? 0}
          hint={`${overview?.pending_users ?? 0} pendentes · ${overview?.blocked_users ?? 0} bloqueadas`}
          icon={<UserCheck />}
          tone="success"
        />
        <StatCard
          label="Lições publicadas"
          value={`${overview?.published_lessons ?? 0}`}
          hint={`${pct(overview?.published_lessons ?? 0, overview?.total_lessons ?? 1)}% de ${overview?.total_lessons ?? 0}`}
          icon={<BookOpen />}
          tone={draftLessons > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Práticas de fala"
          value={overview?.speaking_sessions ?? 0}
          hint={`${overview?.speaking_sessions_7d ?? 0} nos últimos 7 dias · nota média ${Number(overview?.avg_speaking_score ?? 0).toFixed(1)}`}
          icon={<Mic />}
          tone="streak"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="size-4" /> Crescimento de contas
            </CardTitle>
            <CardDescription>Total acumulado nos últimos 30 dias.</CardDescription>
          </CardHeader>
          <CardContent>
            <GrowthAreaChart data={growth} label="usuários" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">Últimos cadastros</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/usuarios">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(recentUsers ?? []).map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-3 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.full_name ?? "—"}</p>
                  <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge
                    variant={
                      user.status === "active"
                        ? "success"
                        : user.status === "pending_verification"
                          ? "warning"
                          : "destructive"
                    }
                    className="text-[10px]"
                  >
                    {ROLE_LABEL[user.role]}
                  </Badge>
                  <span className="text-muted-foreground text-[10px]">
                    {formatRelative(user.created_at)}
                  </span>
                </div>
              </div>
            ))}
            {!recentUsers?.length ? (
              <p className="text-muted-foreground py-6 text-center text-sm">Nenhum usuário ainda.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <GraduationCap className="size-4" /> Práticas recentes com a tutora
            </CardTitle>
            <CardDescription>Últimas gravações enviadas para correção.</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/conversacao">Ver todas</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(recentSessions ?? []).map((session) => {
            const profile = Array.isArray(session.profiles) ? session.profiles[0] : session.profiles;
            return (
              <div
                key={session.id}
                className="flex flex-col items-start gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                {/* w-full no celular: sem largura definida o `truncate` não
                    tem onde cortar e o texto vaza em vez de reticenciar. */}
                <div className="w-full min-w-0 sm:w-auto">
                  <p className="truncate text-sm">{session.prompt}</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {profile?.full_name ?? profile?.email ?? "—"} · {formatRelative(session.created_at)}
                  </p>
                </div>
                <Badge
                  variant={
                    session.status === "completed"
                      ? "success"
                      : session.status === "failed"
                        ? "destructive"
                        : "neutral"
                  }
                  className="shrink-0"
                >
                  {session.status}
                </Badge>
              </div>
            );
          })}
          {!recentSessions?.length ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Nenhuma prática de fala registrada ainda.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
