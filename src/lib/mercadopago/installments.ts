import "server-only";

import { checkoutEnv } from "@/lib/env";

import { amountToCents, centsToAmount, mpFetch } from "./client";

export interface InstallmentOption {
  installments: number;
  /** Valor de cada parcela, em centavos. */
  installmentCents: number;
  /** Total pago ao final, em centavos. Maior que o preço quando há juros. */
  totalCents: number;
  /** Juros embutidos (total − preço), em centavos. */
  interestCents: number;
  rate: number;
}

export interface InstallmentTable {
  options: InstallmentOption[];
  /**
   * `mercadopago` = tabela real da bandeira, consultada agora.
   * `estimate`    = simulação local, usada quando a consulta falha.
   * A tela precisa dizer ao aluno qual das duas está vendo.
   */
  source: "mercadopago" | "estimate";
}

/** Taxa mensal usada só no fallback. Ordem de grandeza da tabela do mercado. */
const FALLBACK_MONTHLY_RATE = 0.0299;

interface MpInstallmentsResponse {
  payment_method_id: string;
  payment_type_id: string;
  payer_costs?: {
    installments: number;
    installment_rate: number;
    installment_amount: number;
    total_amount: number;
  }[];
}

/**
 * Cache em memória do processo.
 *
 * A tabela de parcelamento muda em escala de semanas, e a tela de checkout é
 * renderizada a cada visita: sem cache, cada aluno que abre a página dispara
 * uma chamada externa que atrasa o primeiro byte por causa de um número que
 * não mudou.
 */
const CACHE_TTL_MS = 60 * 60 * 1000;
let cache: { key: string; at: number; value: InstallmentTable } | null = null;

/**
 * Simulação local pela Tabela Price. Só entra em cena se o Mercado Pago não
 * responder — é melhor mostrar uma faixa aproximada e dizer que é aproximada
 * do que deixar a tela de preço vazia.
 */
function estimate(amountCents: number, maxInstallments: number): InstallmentTable {
  const options: InstallmentOption[] = [];

  for (let n = 1; n <= maxInstallments; n++) {
    if (n === 1) {
      options.push({
        installments: 1,
        installmentCents: amountCents,
        totalCents: amountCents,
        interestCents: 0,
        rate: 0,
      });
      continue;
    }

    const i = FALLBACK_MONTHLY_RATE;
    const factor = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
    const installmentCents = Math.round(amountCents * factor);
    const totalCents = installmentCents * n;

    options.push({
      installments: n,
      installmentCents,
      totalCents,
      interestCents: totalCents - amountCents,
      rate: i * 100,
    });
  }

  return { options, source: "estimate" };
}

/**
 * Tabela de parcelamento real do Mercado Pago para o valor do curso.
 *
 * Consultada com a bandeira Visa por ser a de maior circulação no Brasil; as
 * demais variam pouco, e o valor definitivo aparece para o aluno na tela do
 * próprio Mercado Pago antes de ele confirmar.
 */
export async function getInstallmentTable(
  amountCents: number = checkoutEnv.priceCents,
  maxInstallments: number = checkoutEnv.maxInstallments,
): Promise<InstallmentTable> {
  const key = `${amountCents}:${maxInstallments}`;
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  try {
    const response = await mpFetch<MpInstallmentsResponse[]>(
      `/v1/payment_methods/installments?amount=${centsToAmount(amountCents)}&payment_method_id=visa`,
      // Dado público e estável. Sem este revalidate a chamada sai como
      // `no-store` e arrasta a landing e o /cadastro para renderização
      // dinâmica — exatamente o que os cabeçalhos de cache do next.config
      // não suportam nesta hospedagem.
      { revalidate: 3600 },
    );

    const costs = response?.[0]?.payer_costs ?? [];
    const options: InstallmentOption[] = costs
      .filter((c) => c.installments <= maxInstallments)
      .map((c) => {
        const installmentCents = amountToCents(c.installment_amount) ?? amountCents;
        const totalCents = amountToCents(c.total_amount) ?? installmentCents * c.installments;
        return {
          installments: c.installments,
          installmentCents,
          totalCents,
          interestCents: Math.max(0, totalCents - amountCents),
          rate: c.installment_rate,
        };
      })
      .sort((a, b) => a.installments - b.installments);

    if (!options.length) throw new Error("payer_costs vazio");

    const table: InstallmentTable = { options, source: "mercadopago" };
    cache = { key, at: Date.now(), value: table };
    return table;
  } catch (error) {
    console.error(
      "[mercadopago] falha ao consultar parcelamento, usando simulacao local:",
      error instanceof Error ? error.message : error,
    );
    const table = estimate(amountCents, maxInstallments);
    // Cache curto no fallback: a próxima visita tenta a API de novo em 5 min.
    cache = { key, at: Date.now() - (CACHE_TTL_MS - 5 * 60 * 1000), value: table };
    return table;
  }
}
