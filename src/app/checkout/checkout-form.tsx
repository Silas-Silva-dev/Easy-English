"use client";

import { AlertCircle, Check, Lock, ShieldCheck } from "lucide-react";
import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/billing";
import type { InstallmentOption } from "@/lib/mercadopago/installments";
import { cn } from "@/lib/utils";

import { startCheckoutAction, type CheckoutState } from "./actions";

const INITIAL: CheckoutState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="xl"
      variant="gradient"
      loading={pending}
      className="w-full shadow-lg shadow-primary/20"
    >
      {pending ? "Abrindo pagamento seguro…" : "Ir para o pagamento"}
      {pending ? null : <Lock className="size-4" />}
    </Button>
  );
}

export function CheckoutForm({
  priceCents,
  options,
  estimated,
}: {
  priceCents: number;
  options: InstallmentOption[];
  /** Tabela de juros simulada localmente: o rodapé precisa dizer isso. */
  estimated: boolean;
}) {
  const [state, action] = useActionState(startCheckoutAction, INITIAL);

  // Começa no à vista: é o que o aluno paga sem juros e o que ele deve ver
  // primeiro. A escolha aqui é uma simulação — quem fecha a parcela é a tela
  // do Mercado Pago, e é lá que o valor vira contrato.
  const [selected, setSelected] = React.useState(1);
  const current = options.find((o) => o.installments === selected) ?? options[0];

  return (
    <form action={action} className="space-y-5">
      {state.error ? (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </p>
      ) : null}

      {/* ------------------------------------------------ Escolha da parcela */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Como você prefere pagar</legend>
        <p className="text-muted-foreground pb-1 text-xs">
          À vista no PIX ou no cartão, ou parcelado no cartão de crédito.
        </p>

        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {options.map((option) => {
            const isSelected = option.installments === selected;
            const hasInterest = option.interestCents > 0;

            return (
              <label
                key={option.installments}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 ring-primary/25 ring-2"
                    : "hover:bg-accent/50",
                )}
              >
                <input
                  type="radio"
                  name="installments"
                  value={option.installments}
                  checked={isSelected}
                  onChange={() => setSelected(option.installments)}
                  className="sr-only"
                />

                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                    isSelected ? "border-primary bg-primary" : "border-muted-foreground/40",
                  )}
                  aria-hidden
                >
                  {isSelected ? (
                    <Check className="text-primary-foreground size-3" strokeWidth={3} />
                  ) : null}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5 text-sm font-semibold">
                    {option.installments === 1 ? (
                      <>À vista {formatBRL(option.installmentCents)}</>
                    ) : (
                      <>
                        {option.installments}x de {formatBRL(option.installmentCents)}
                      </>
                    )}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {hasInterest
                      ? `Total ${formatBRL(option.totalCents)} · juros do cartão`
                      : "Sem juros"}
                  </span>
                </span>

                {!hasInterest ? (
                  <span className="bg-success/15 text-success rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                    Melhor preço
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* -------------------------------------------------------- Total */}
      <div className="space-y-2 border-t pt-4">
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>Acesso ao curso</span>
          <span className="tabular-nums">{formatBRL(priceCents)}</span>
        </div>

        {current && current.interestCents > 0 ? (
          <div className="text-muted-foreground flex items-center justify-between text-sm">
            <span>Juros do parcelamento</span>
            <span className="tabular-nums">+ {formatBRL(current.interestCents)}</span>
          </div>
        ) : null}

        <div className="flex items-baseline justify-between pt-1">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-bold tabular-nums">
            {formatBRL(current?.totalCents ?? priceCents)}
          </span>
        </div>

        {current && current.installments > 1 ? (
          <p className="text-muted-foreground text-right text-xs">
            em {current.installments}x de {formatBRL(current.installmentCents)}
          </p>
        ) : null}
      </div>

      <SubmitButton />

      <div className="space-y-2.5">
        <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
          <ShieldCheck className="text-success mt-0.5 size-4 shrink-0" />
          <span>
            Você é levado ao ambiente seguro do <strong>Mercado Pago</strong> para concluir. Os
            dados do seu cartão não passam pela nossa plataforma.
          </span>
        </p>

        <p className="text-muted-foreground text-xs leading-relaxed">
          {estimated
            ? "Os valores de parcela são uma simulação; o Mercado Pago confirma o valor exato antes de você autorizar a compra."
            : "Valores de parcela informados pelo Mercado Pago. A confirmação final aparece antes de você autorizar a compra."}
        </p>
      </div>
    </form>
  );
}
