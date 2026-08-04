import "server-only";

import { checkoutEnv, mercadoPagoEnv, serverEnv } from "@/lib/env";

import { centsToAmount, mpFetch } from "./client";

export interface CreatePreferenceInput {
  orderId: string;
  externalReference: string;
  amountCents: number;
  title: string;
  description?: string;
  payer: { name?: string | null; email: string };
  expiresAt: Date;
}

export interface PreferenceResult {
  id: string;
  /** URL de produção do checkout. */
  init_point: string;
  /** URL do sandbox — só existe quando o token é de teste. */
  sandbox_init_point?: string;
}

/**
 * Cria a preferência do Checkout Pro: o "pedido" do lado do Mercado Pago.
 *
 * Sobre o parcelamento: NÃO declaramos nada de juros aqui. O padrão do
 * Mercado Pago é o comprador pagar os juros do parcelamento, e o vendedor
 * receber o valor cheio. Só existe "sem juros" se o vendedor contratar isso no
 * painel — e aí o custo sai do repasse dele. Ou seja: o comportamento pedido
 * (aluno paga os juros) é o que se obtém deixando o campo em paz.
 */
export async function createPreference(input: CreatePreferenceInput): Promise<PreferenceResult> {
  const { orderId, externalReference, amountCents, title, description, payer, expiresAt } = input;

  const [firstName, ...restName] = (payer.name ?? "").trim().split(/\s+/).filter(Boolean);

  /**
   * Em `localhost` o Mercado Pago recusa a preferência inteira: ele valida
   * `auto_return` contra a `back_urls` e exige um destino público. Sem esta
   * checagem, rodar o checkout em desenvolvimento devolve 400
   * "invalid_auto_return" e não dá para testar o fluxo. O `notification_url`
   * cai junto porque um webhook para localhost nunca seria entregue.
   */
  const isPublicSite = /^https:\/\//i.test(serverEnv.siteUrl);

  const preference = await mpFetch<PreferenceResult>("/checkout/preferences", {
    method: "POST",
    // Duas submissões do mesmo pedido devolvem a MESMA preferência em vez de
    // abrirem duas cobranças para o mesmo aluno.
    idempotencyKey: `pref-${orderId}`,
    body: {
      items: [
        {
          id: orderId,
          title,
          description: description ?? title,
          category_id: "learnings",
          quantity: 1,
          currency_id: "BRL",
          unit_price: centsToAmount(amountCents),
        },
      ],
      payer: {
        email: payer.email,
        ...(firstName ? { name: firstName } : {}),
        ...(restName.length ? { surname: restName.join(" ") } : {}),
      },
      external_reference: externalReference,
      metadata: { order_id: orderId },

      /**
       * Por onde a resposta do pagamento chega.
       *
       * `notification_url` é a fonte da verdade: o retorno do navegador é uma
       * conveniência de UX e some se o aluno fechar a aba logo após pagar.
       * Sem webhook, quem paga no PIX e fecha o navegador nunca é liberado.
       */
      ...(isPublicSite
        ? { notification_url: `${serverEnv.siteUrl}/api/pagamentos/webhook`, auto_return: "approved" }
        : {}),
      back_urls: {
        success: `${serverEnv.siteUrl}/checkout/retorno`,
        pending: `${serverEnv.siteUrl}/checkout/retorno`,
        failure: `${serverEnv.siteUrl}/checkout/retorno`,
      },

      payment_methods: {
        installments: checkoutEnv.maxInstallments,
        /**
         * Fora: boleto (`ticket`) e pagamento em lotérica/caixa (`atm`).
         * Ambos compensam em dias úteis; o aluno acha que comprou, não entra,
         * e abre chamado. Ficam cartão de crédito, cartão de débito, PIX
         * (`bank_transfer`) e saldo em conta Mercado Pago.
         */
        excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
      },

      statement_descriptor: checkoutEnv.statementDescriptor,
      expires: true,
      expiration_date_to: expiresAt.toISOString(),
      binary_mode: false,
    },
  });

  return preference;
}

/**
 * URL para onde o aluno é enviado.
 *
 * Com token de teste o `init_point` de produção existe mas recusa os cartões
 * de teste: quem estiver validando a integração precisa do sandbox.
 */
export function checkoutUrl(preference: PreferenceResult): string {
  if (mercadoPagoEnv.isSandbox && preference.sandbox_init_point) {
    return preference.sandbox_init_point;
  }
  return preference.init_point;
}
