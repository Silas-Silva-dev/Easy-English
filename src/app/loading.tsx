import { Loader2 } from "lucide-react";

export default function RootLoading() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-background animate-in fade-in duration-200">
      <div className="bg-primary/10 text-primary grid size-12 place-items-center rounded-full shadow-sm">
        <Loader2 className="size-6 animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold">Carregando…</p>
        <p className="text-muted-foreground mt-0.5 text-xs">Preparando o aplicativo</p>
      </div>
    </div>
  );
}
