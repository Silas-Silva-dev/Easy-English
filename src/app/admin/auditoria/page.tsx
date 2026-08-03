import { ScrollText } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Auditoria" };

const PAGE_SIZE = 50;

/** Ações destrutivas ficam em vermelho para saltarem aos olhos na revisão. */
function actionVariant(action: string) {
  if (/deleted|banned|suspended/.test(action)) return "destructive" as const;
  if (/published|verified|active/.test(action)) return "success" as const;
  if (/role_changed/.test(action)) return "warning" as const;
  return "neutral" as const;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;
  await requireAdmin("/admin/auditoria");

  const page = Math.max(1, Number(p) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createServerSupabase();
  const { data: entries, count } = await supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <PageHeader
        eyebrow="Segurança"
        title="Auditoria"
        description="Registro imutável de toda ação administrativa: mudanças de papel, bloqueios, exclusões e publicação de conteúdo."
      />

      {entries?.length ? (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Quem</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatDateTime(entry.created_at)}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-sm">
                    {entry.actor_email ?? "sistema"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={actionVariant(entry.action)} className="font-mono text-[10px]">
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {entry.entity}
                    {entry.entity_id ? (
                      <span className="block max-w-40 truncate opacity-70">{entry.entity_id}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-64 truncate text-xs">
                    {entry.meta && Object.keys(entry.meta).length
                      ? JSON.stringify(entry.meta)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={<ScrollText />}
          title="Nenhuma ação registrada"
          description="As ações administrativas passam a aparecer aqui automaticamente."
        />
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Página {page} de {totalPages} · {total} registros
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <a
                href={`/admin/auditoria?p=${page - 1}`}
                className="hover:bg-accent inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm transition-colors"
              >
                Anterior
              </a>
            ) : null}
            {page < totalPages ? (
              <a
                href={`/admin/auditoria?p=${page + 1}`}
                className="hover:bg-accent inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm transition-colors"
              >
                Próxima
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
