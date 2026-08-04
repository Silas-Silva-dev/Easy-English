import { AlertTriangle, CreditCard, Gift, Receipt, Search, TrendingUp, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACCESS_SOURCE_LABEL,
  formatBRL,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_VARIANT,
} from "@/lib/billing";
import { requireAdmin } from "@/lib/auth/guards";
import { checkoutEnv, mercadoPagoEnv } from "@/lib/env";
import { paymentTypeLabel } from "@/lib/mercadopago/payments";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AccessGrant, PaymentStatus } from "@/lib/types/database";
import { cn, formatDateTime } from "@/lib/utils";

import { NewFreeStudentDialog, OrderRowActions } from "./billing-actions";

export const metadata: Metadata = { title: "Pagamentos" };

const PAGE_SIZE = 25;

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Todos" },
  { key: "approved", label: "Pagos" },
  { key: "pending", label: "Aguardando" },
  { key: "in_process", label: "Em análise" },
  { key: "rejected", label: "Recusados" },
  { key: "refunded", label: "Estornados" },
];

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; p?: string }>;
}) {
  const { status, q, p } = await searchParams;
  await requireAdmin("/admin/pagamentos");

  const page = Math.max(1, Number(p) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createServerSupabase();

  let ordersQuery = supabase
    .from("orders")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status) ordersQuery = ordersQuery.eq("status", status as PaymentStatus);
  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    ordersQuery = ordersQuery.or(`email.ilike.${term},full_name.ilike.${term}`);
  }

  const [{ data: overview }, { data: orders, count }, { data: grants }] = await Promise.all([
    supabase.from("admin_billing_overview").select("*").maybeSingle(),
    ordersQuery,
    supabase.from("access_grants").select("*").is("revoked_at", null),
  ]);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Quem tem acesso vivo, para a tabela saber se oferece "liberar" ou "revogar".
  const accessByUser = new Map<string, AccessGrant>(
    (grants ?? []).map((grant) => [grant.user_id, grant]),
  );

  const buildHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { status, q, p: String(page), ...patch };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return `/admin/pagamentos${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <PageHeader
        eyebrow="Administração"
        title="Pagamentos e acessos"
        description={`Acesso ao curso a ${formatBRL(checkoutEnv.priceCents)}, em até ${checkoutEnv.maxInstallments}x no cartão com juros por conta do aluno.`}
        action={<NewFreeStudentDialog />}
      />

      {/* -------------------------------------------------------- Avisos */}
      {!mercadoPagoEnv.configured ? (
        <div className="border-destructive/30 bg-destructive/10 flex items-start gap-3 rounded-xl border p-4">
          <AlertTriangle className="text-destructive mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Mercado Pago não configurado</p>
            <p className="text-muted-foreground mt-1">
              Defina <code className="bg-muted rounded px-1 py-0.5 text-xs">MERCADOPAGO_ACCESS_TOKEN</code>{" "}
              no ambiente. Enquanto isso, o checkout não abre para nenhum aluno.
            </p>
          </div>
        </div>
      ) : !mercadoPagoEnv.webhookSecret && !mercadoPagoEnv.isSandbox ? (
        <div className="border-warning/30 bg-warning/10 flex items-start gap-3 rounded-xl border p-4">
          <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Webhook sem assinatura secreta</p>
            <p className="text-muted-foreground mt-1">
              Sem{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">
                MERCADOPAGO_WEBHOOK_SECRET
              </code>{" "}
              as notificações são recusadas e nenhum pagamento libera acesso sozinho. Pegue a
              assinatura no painel do Mercado Pago em Webhooks.
            </p>
          </div>
        </div>
      ) : null}

      {/* --------------------------------------------------------- Métricas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Receita aprovada"
          value={formatBRL(overview?.gross_cents ?? 0)}
          hint={`${overview?.paid_orders ?? 0} pedido(s) pago(s)`}
          icon={<TrendingUp />}
          tone="success"
        />
        <StatCard
          label="Últimos 30 dias"
          value={formatBRL(overview?.gross_cents_30d ?? 0)}
          hint={`${overview?.paid_orders_30d ?? 0} venda(s) no período`}
          icon={<Receipt />}
        />
        <StatCard
          label="Líquido creditado"
          value={formatBRL(overview?.net_cents ?? 0)}
          hint="Já descontada a taxa do Mercado Pago"
          icon={<CreditCard />}
          tone="neutral"
        />
        <StatCard
          label="Acessos ativos"
          value={overview?.active_grants ?? 0}
          hint={`${overview?.courtesy_grants ?? 0} liberado(s) sem custo`}
          icon={<Users />}
          tone="primary"
        />
      </div>

      {(overview?.pending_orders ?? 0) > 0 || (overview?.refunded_orders ?? 0) > 0 ? (
        <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span>
            <strong className="text-foreground">{overview?.pending_orders ?? 0}</strong> aguardando
            pagamento
          </span>
          <span>
            <strong className="text-foreground">{overview?.rejected_orders ?? 0}</strong> recusado(s)
          </span>
          <span>
            <strong className="text-foreground">{overview?.refunded_orders ?? 0}</strong> estornado(s)
            ou contestado(s)
          </span>
        </div>
      ) : null}

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
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail…" className="pl-9" />
        </form>
      </div>

      {/* ---------------------------------------------------------- Tabela */}
      {orders?.length ? (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const grant = accessByUser.get(order.user_id);

                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <p className="truncate text-sm font-medium">{order.full_name ?? "—"}</p>
                      <p className="text-muted-foreground truncate text-xs">{order.email}</p>
                    </TableCell>

                    <TableCell>
                      <Badge variant={PAYMENT_STATUS_VARIANT[order.status]}>
                        {PAYMENT_STATUS_LABEL[order.status]}
                      </Badge>
                      {order.status_detail && order.status !== "approved" ? (
                        <p className="text-muted-foreground mt-1 max-w-40 truncate text-[11px]">
                          {order.status_detail}
                        </p>
                      ) : null}
                    </TableCell>

                    <TableCell className="whitespace-nowrap">
                      <p className="text-sm font-medium tabular-nums">
                        {formatBRL(order.total_paid_cents ?? order.amount_cents)}
                      </p>
                      {order.installments && order.installments > 1 ? (
                        <p className="text-muted-foreground text-xs tabular-nums">
                          {order.installments}x {formatBRL(order.installment_amount_cents)}
                        </p>
                      ) : null}
                    </TableCell>

                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {order.payment_type ? paymentTypeLabel(order.payment_type) : "—"}
                    </TableCell>

                    <TableCell>
                      {grant ? (
                        <Badge variant={grant.source === "courtesy" ? "warning" : "success"}>
                          {grant.source === "courtesy" ? <Gift /> : null}
                          {ACCESS_SOURCE_LABEL[grant.source]}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">Sem acesso</Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDateTime(order.paid_at ?? order.created_at)}
                    </TableCell>

                    <TableCell>
                      <OrderRowActions order={order} hasAccess={Boolean(grant)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={<Receipt />}
          title="Nenhum pedido por aqui"
          description={
            status || q
              ? "Ajuste os filtros ou a busca para ver outros resultados."
              : "Assim que o primeiro aluno passar pelo checkout, o pedido aparece nesta lista."
          }
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
