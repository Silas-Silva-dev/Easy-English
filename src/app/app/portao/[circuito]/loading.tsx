import { Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/misc";

/**
 * A avaliação do portão conta dias, lições e blocos no banco: são meia dúzia
 * de agregações, e sem este esqueleto a rota fica em branco enquanto elas
 * rodam. O desenho imita o painel para a página não pular quando ele chega.
 */
export default function PortaoLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-2">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>

      <div className="bg-card shadow-xs space-y-3 rounded-xl border p-5">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="text-primary size-4 animate-spin" />
          Conferindo o que a quinzena pede…
        </div>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
