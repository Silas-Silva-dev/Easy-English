import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Waves,
  XCircle,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { formatBRL, PAYMENT_STATUS_LABEL } from "@/lib/billing";
import { requireActiveUser } from "@/lib/auth/guards";
import { paymentTypeLabel } from "@/lib/mercadopago/payments";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Order } from "@/lib/types/database";

import { syncOrderFromPayment } from "../actions";
import { PendingRefresher } from "./pending-refresher";

export const metadata: Metadata = {
  title: "Pagamento",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * O Mercado Pago devolve o pagador com um punhado de parâmetros e o nome
 * deles muda conforme a versão do checkout: `payment_id` no fluxo novo,
 * `collection_id` no antigo. Aceitamos os dois — perder o id aqui significa
 * não conseguir reconciliar e mostrar "aguardando" para quem já pagou.
 */
interface ReturnParams {
  payment_id?: string;
  collection_id?: string;
  status?: string;
  collection_status?: string;
  external_reference?: string;
  preference_id?: string;
}

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<ReturnParams>;
}) {
  const params = await searchParams;
  const session = await requireActiveUser("/checkout/retorno");

  const paymentId = params.payment_id ?? params.collection_id ?? null;

  // Reconcilia na hora: o webhook pode não ter chegado ainda.
  if (paymentId && paymentId !== "null") {
    await syncOrderFromPayment(paymentId);
  }

  const supabase = await createServerSupabase();

  // Consulta direta, sem o helper memoizado: ele pode ter sido resolvido
  // ANTES do sync acima, e devolveria o estado anterior ao pagamento.
  const [{ data: grant }, { data: order }] = await Promise.all([
    supabase
      .from("access_grants")
      .select("id")
      .eq("user_id", session.userId)
      .is("revoked_at", null)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("*")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const released = Boolean(grant);
  const typed = order as Order | null;

  return (
    <div className="bg-muted/25 grid min-h-screen place-items-center px-4 py-10">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>

      <div className="animate-in-up w-full max-w-md space-y-6">
        <Link href="/" className="flex items-center justify-center gap-2 font-semibold">
          <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg">
            <Waves className="size-4" />
          </span>
          InglishEasy
        </Link>

        <div className="bg-card rounded-2xl border p-8 text-center shadow-lg">
          {released ? (
            <SuccessState order={typed} />
          ) : typed && (typed.status === "pending" || typed.status === "in_process") ? (
            <PendingState order={typed} />
          ) : typed && (typed.status === "rejected" || typed.status === "cancelled") ? (
            <RejectedState order={typed} />
          ) : (
            <UnknownState />
          )}
        </div>

        {typed ? (
          <p className="text-muted-foreground text-center text-xs">
            Pedido <span className="font-mono">{typed.external_reference.slice(0, 8)}</span>
            {typed.payment_id ? (
              <>
                {" · "}Pagamento <span className="font-mono">{typed.payment_id}</span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SuccessState({ order }: { order: Order | null }) {
  return (
    <>
      <div className="bg-success/12 text-success mx-auto grid size-14 place-items-center rounded-full">
        <CheckCircle2 className="size-7" />
      </div>

      <h1 className="mt-5 text-xl font-bold">Acesso liberado!</h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        Seu pagamento foi confirmado e o curso completo já está aberto na sua conta. Bons estudos —
        o Dia 1 espera por você.
      </p>

      {order?.status === "approved" ? (
        <dl className="bg-muted/50 mt-6 space-y-2 rounded-xl p-4 text-left text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Valor</dt>
            <dd className="font-medium tabular-nums">
              {formatBRL(order.total_paid_cents ?? order.amount_cents)}
            </dd>
          </div>
          {order.installments && order.installments > 1 ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Parcelamento</dt>
              <dd className="font-medium tabular-nums">
                {order.installments}x de {formatBRL(order.installment_amount_cents)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Forma de pagamento</dt>
            <dd className="font-medium">{paymentTypeLabel(order.payment_type)}</dd>
          </div>
        </dl>
      ) : null}

      <Button asChild size="xl" variant="gradient" className="mt-7 w-full">
        <Link href="/app">
          Começar o Dia 1 <ArrowRight className="size-4" />
        </Link>
      </Button>
    </>
  );
}

function PendingState({ order }: { order: Order }) {
  const isPix = order.payment_type === "bank_transfer";

  return (
    <>
      <div className="bg-warning/15 text-warning mx-auto grid size-14 place-items-center rounded-full">
        <Clock className="size-7" />
      </div>

      <h1 className="mt-5 text-xl font-bold">
        {isPix ? "Aguardando a confirmação do PIX" : "Pagamento em análise"}
      </h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        {isPix
          ? "Assim que o PIX for compensado, o acesso abre sozinho — normalmente em poucos segundos. Não é preciso pagar de novo."
          : "O Mercado Pago está analisando o pagamento. Isso costuma levar poucos minutos e o acesso abre automaticamente."}
      </p>

      <p className="text-muted-foreground mt-4 flex items-center justify-center gap-2 text-xs">
        <Loader2 className="size-3.5 animate-spin" />
        Verificando a cada 5 segundos · {PAYMENT_STATUS_LABEL[order.status]}
      </p>

      <PendingRefresher />

      <div className="mt-7 space-y-2">
        <Button asChild variant="outline" className="w-full">
          <Link href="/checkout/retorno">
            <RefreshCw className="size-4" /> Verificar agora
          </Link>
        </Button>
        <p className="text-muted-foreground text-xs">
          Você pode fechar esta página. Enviaremos o acesso assim que o pagamento for confirmado.
        </p>
      </div>
    </>
  );
}

function RejectedState({ order }: { order: Order }) {
  return (
    <>
      <div className="bg-destructive/12 text-destructive mx-auto grid size-14 place-items-center rounded-full">
        <XCircle className="size-7" />
      </div>

      <h1 className="mt-5 text-xl font-bold">
        {order.status === "cancelled" ? "Pagamento cancelado" : "Pagamento não aprovado"}
      </h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        {order.status === "cancelled"
          ? "O pagamento foi cancelado antes de ser concluído. Nenhum valor foi cobrado."
          : "O banco emissor recusou a cobrança e nada foi cobrado de você. Costuma resolver tentando outro cartão ou pagando no PIX."}
      </p>

      <Button asChild size="lg" variant="gradient" className="mt-7 w-full">
        <Link href="/checkout">Tentar novamente</Link>
      </Button>
    </>
  );
}

function UnknownState() {
  return (
    <>
      <div className="bg-muted text-muted-foreground mx-auto grid size-14 place-items-center rounded-full">
        <Clock className="size-7" />
      </div>

      <h1 className="mt-5 text-xl font-bold">Não encontramos este pagamento</h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        Se você acabou de pagar, aguarde alguns instantes e atualize. Se a cobrança aparecer no seu
        extrato e o acesso não abrir, fale com o suporte que liberamos manualmente.
      </p>

      <div className="mt-7 space-y-2">
        <Button asChild size="lg" className="w-full">
          <Link href="/checkout">Voltar ao checkout</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="w-full">
          <a href="mailto:suporte@inglisheasy.com">Falar com o suporte</a>
        </Button>
      </div>
    </>
  );
}
