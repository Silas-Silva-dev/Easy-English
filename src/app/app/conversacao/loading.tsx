import { Loader2, Mic } from "lucide-react";

export default function SpeakingLoading() {
  return (
    <div className="flex min-h-[65vh] w-full flex-col items-center justify-center gap-5 py-12 animate-in fade-in duration-150">
      <div className="relative grid place-items-center">
        <div className="bg-primary/20 absolute size-20 animate-ping rounded-full opacity-60" />
        <div className="bg-primary text-primary-foreground relative grid size-16 place-items-center rounded-2xl shadow-xl shadow-primary/30">
          <Mic className="size-8 animate-pulse" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 text-center">
        <div className="flex items-center gap-2">
          <Loader2 className="text-primary size-4.5 animate-spin" />
          <h3 className="text-base font-semibold tracking-tight">Carregando Praticar Fala…</h3>
        </div>
        <p className="text-muted-foreground text-xs">
          Preparando os cenários e a tutora de IA
        </p>
      </div>

      <div className="bg-muted/80 h-1.5 w-52 overflow-hidden rounded-full border">
        <div className="bg-primary animate-progress-indeterminate h-full w-full" />
      </div>
    </div>
  );
}
