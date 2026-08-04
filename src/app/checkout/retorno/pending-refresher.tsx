"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

/**
 * Recarrega a tela enquanto o pagamento não conclui.
 *
 * Existe para o PIX: entre o "paguei" e a notificação do Mercado Pago passam
 * alguns segundos, e sem isto o aluno fica olhando uma tela de "aguardando"
 * que nunca muda sozinha — e volta a pagar achando que não deu certo.
 *
 * Para depois de `maxAttempts` para não deixar uma aba esquecida atualizando
 * a página para sempre.
 */
export function PendingRefresher({
  intervalMs = 5000,
  maxAttempts = 36,
}: {
  intervalMs?: number;
  maxAttempts?: number;
}) {
  const router = useRouter();
  const [attempts, setAttempts] = React.useState(0);

  React.useEffect(() => {
    if (attempts >= maxAttempts) return;

    const id = setTimeout(() => {
      setAttempts((n) => n + 1);
      router.refresh();
    }, intervalMs);

    return () => clearTimeout(id);
  }, [attempts, intervalMs, maxAttempts, router]);

  if (attempts < maxAttempts) return null;

  return (
    <p className="text-muted-foreground text-xs">
      Paramos de verificar automaticamente. Atualize a página para checar de novo.
    </p>
  );
}
