import "server-only";

import type { PaymentStatus } from "@/lib/types/database";

import { amountToCents, mpFetch } from "./client";

/** Recorte dos campos do pagamento que a aplicação realmente usa. */
export interface MpPayment {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  payment_type_id?: string | null;
  payment_method_id?: string | null;
  transaction_amount?: number | null;
  installments?: number | null;
  date_approved?: string | null;
  date_created?: string | null;
  payer?: { email?: string | null } | null;
  metadata?: Record<string, unknown> | null;
  transaction_details?: {
    total_paid_amount?: number | null;
    installment_amount?: number | null;
    net_received_amount?: number | null;
  } | null;
}

export async function getPayment(paymentId: string): Promise<MpPayment> {
  return mpFetch<MpPayment>(`/v1/payments/${encodeURIComponent(paymentId)}`);
}

/**
 * Traduz o status do Mercado Pago para o enum do banco.
 *
 * `authorized` entra como aprovado: o valor já está reservado no cartão e a
 * captura é automática no fluxo do Checkout Pro. `in_mediation` (disputa
 * aberta) fica como `in_process` — não é recusa, é análise.
 */
export function mapPaymentStatus(status: string): PaymentStatus {
  switch (status) {
    case "approved":
    case "authorized":
      return "approved";
    case "in_process":
    case "in_mediation":
      return "in_process";
    case "rejected":
      return "rejected";
    case "cancelled":
      return "cancelled";
    case "refunded":
      return "refunded";
    case "charged_back":
      return "charged_back";
    case "pending":
    default:
      return "pending";
  }
}

export interface NormalizedPayment {
  paymentId: string;
  status: PaymentStatus;
  statusDetail: string | null;
  externalReference: string | null;
  paymentType: string | null;
  paymentMethod: string | null;
  installments: number | null;
  installmentAmountCents: number | null;
  totalPaidCents: number | null;
  netReceivedCents: number | null;
  /**
   * Preço do produto, SEM os juros do parcelamento.
   *
   * Separado de `totalPaidCents` porque só ele é comparável com
   * `orders.amount_cents`: num parcelamento em 10x o aluno paga R$ 358,30, mas
   * `transaction_amount` continua R$ 297,00. Confundir os dois faria a
   * conferência de valor recusar toda compra parcelada.
   */
  transactionAmountCents: number | null;
  paidAt: string | null;
}

export function normalizePayment(payment: MpPayment): NormalizedPayment {
  const details = payment.transaction_details ?? {};

  return {
    paymentId: String(payment.id),
    status: mapPaymentStatus(payment.status),
    statusDetail: payment.status_detail ?? null,
    externalReference: payment.external_reference ?? null,
    paymentType: payment.payment_type_id ?? null,
    paymentMethod: payment.payment_method_id ?? null,
    installments: payment.installments ?? null,
    installmentAmountCents: amountToCents(details.installment_amount),
    // Com juros do comprador, `total_paid_amount` é maior que o preço do
    // curso. É esse valor que aparece na fatura do aluno.
    totalPaidCents:
      amountToCents(details.total_paid_amount) ?? amountToCents(payment.transaction_amount),
    netReceivedCents: amountToCents(details.net_received_amount),
    transactionAmountCents: amountToCents(payment.transaction_amount),
    paidAt: payment.date_approved ?? null,
  };
}

/** Rótulo do meio de pagamento para o painel e para a tela de retorno. */
export function paymentTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case "credit_card":
      return "Cartão de crédito";
    case "debit_card":
      return "Cartão de débito";
    case "bank_transfer":
      return "PIX";
    case "account_money":
      return "Saldo Mercado Pago";
    case "ticket":
      return "Boleto";
    default:
      return type ?? "—";
  }
}
