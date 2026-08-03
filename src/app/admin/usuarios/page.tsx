import { Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin, ROLE_LABEL, STATUS_LABEL } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AccountStatus, UserRole } from "@/lib/types/database";
import { cn, formatDate, formatRelative, initials } from "@/lib/utils";

import { UserRowActions } from "./user-actions";

export const metadata: Metadata = { title: "Usuários" };

const PAGE_SIZE = 25;

const STATUS_VARIANT: Record<AccountStatus, "success" | "warning" | "destructive" | "neutral"> = {
  active: "success",
  pending_verification: "warning",
  suspended: "destructive",
  banned: "destructive",
};

const ROLE_VARIANT: Record<UserRole, "default" | "neutral" | "warning"> = {
  admin: "warning",
  instructor: "default",
  student: "neutral",
};

const FILTERS = [
  { key: "", label: "Todos" },
  { key: "active", label: "Ativos" },
  { key: "pending_verification", label: "Pendentes" },
  { key: "suspended", label: "Suspensos" },
  { key: "banned", label: "Banidos" },
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; papel?: string; p?: string }>;
}) {
  const { status, q, papel, p } = await searchParams;
  const session = await requireAdmin("/admin/usuarios");

  const page = Math.max(1, Number(p) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createServerSupabase();

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status) query = query.eq("status", status as AccountStatus);
  if (papel) query = query.eq("role", papel as UserRole);
  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`email.ilike.${term},full_name.ilike.${term}`);
  }

  const { data: users, count } = await query;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { status, q, papel, p: String(page), ...patch };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return `/admin/usuarios${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <PageHeader
        eyebrow="Administração"
        title="Usuários"
        description={`${total} conta(s) cadastrada(s). Gerencie papéis, verificação de e-mail e bloqueios.`}
      />

      {/* --------------------------------------------------------- Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <Link
              key={filter.key || "all"}
              href={buildHref({ status: filter.key || undefined, p: undefined })}
              className={cn(
                "inline-flex min-h-10 items-center rounded-full px-4 text-xs font-medium transition-colors",
                (status ?? "") === filter.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent",
              )}
            >
              {filter.label}
            </Link>
          ))}
        </div>

        <form className="relative sm:w-72">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {papel ? <input type="hidden" name="papel" value={papel} /> : null}
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome ou e-mail…"
            className="pl-9"
          />
        </form>
      </div>

      {/* ---------------------------------------------------------- Tabela */}
      {users?.length ? (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead>Última atividade</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        {user.avatar_url ? <AvatarImage src={user.avatar_url} alt="" /> : null}
                        <AvatarFallback>{initials(user.full_name ?? user.email)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {user.full_name ?? "—"}
                          {user.id === session.userId ? (
                            <span className="text-muted-foreground ml-1.5 text-xs">(você)</span>
                          ) : null}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant={ROLE_VARIANT[user.role]}>{ROLE_LABEL[user.role]}</Badge>
                  </TableCell>

                  <TableCell>
                    <Badge variant={STATUS_VARIANT[user.status]}>{STATUS_LABEL[user.status]}</Badge>
                    {user.suspended_reason ? (
                      <p className="text-muted-foreground mt-1 max-w-40 truncate text-[11px]">
                        {user.suspended_reason}
                      </p>
                    ) : null}
                  </TableCell>

                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDate(user.created_at)}
                  </TableCell>

                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatRelative(user.last_seen_at ?? user.updated_at)}
                  </TableCell>

                  <TableCell>
                    <UserRowActions user={user} isSelf={user.id === session.userId} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={<Users />}
          title="Nenhum usuário encontrado"
          description="Ajuste os filtros ou a busca para ver outros resultados."
        />
      )}

      {/* -------------------------------------------------------- Paginação */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={buildHref({ p: String(page - 1) })}
                className="hover:bg-accent inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm transition-colors"
              >
                Anterior
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={buildHref({ p: String(page + 1) })}
                className="hover:bg-accent inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm transition-colors"
              >
                Próxima
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
