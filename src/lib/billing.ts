import type { AccessSource, PaymentStatus } from "@/lib/types/database";

/**
 * Helpers de cobrança compartilhados entre servidor e cliente.
 *
 * Este arquivo NÃO é `server-only` de propósito: o formulário de checkout e o
 * painel usam as mesmas funções de formatação, e duplicá-las é o caminho mais
 * curto para a tela mostrar "R$ 297" e o recibo mostrar "R$ 297,00".
 */

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

/** Formata centavos como moeda: 29700 → "R$ 297,00". */
export function formatBRL(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  return BRL.format(cents / 100);
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Aguardando pagamento",
  in_process: "Em análise",
  approved: "Pago",
  rejected: "Recusado",
  cancelled: "Cancelado",
  refunded: "Estornado",
  charged_back: "Contestado",
};

export const PAYMENT_STATUS_VARIANT: Record<
  PaymentStatus,
  "success" | "warning" | "destructive" | "neutral"
> = {
  pending: "warning",
  in_process: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "neutral",
  refunded: "destructive",
  charged_back: "destructive",
};

/** Status em que o dinheiro ainda pode cair: o pedido continua vivo. */
export function isOpenOrder(status: PaymentStatus): boolean {
  return status === "pending" || status === "in_process";
}

export const ACCESS_SOURCE_LABEL: Record<AccessSource, string> = {
  payment: "Compra aprovada",
  courtesy: "Liberado sem custo",
};

/** "10x de R$ 33,04" — o rótulo que aparece em botão, card e recibo. */
export function installmentLabel(installments: number, installmentCents: number): string {
  if (installments <= 1) return `à vista ${formatBRL(installmentCents)}`;
  return `${installments}x de ${formatBRL(installmentCents)}`;
}
