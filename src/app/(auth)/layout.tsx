import { Mic, ShieldCheck, Sparkles, Waves } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-provider";

const HIGHLIGHTS = [
  { icon: Mic, text: "Tutora de IA que ouve e corrige sua pronúncia" },
  { icon: Sparkles, text: "728 lições prontas, do A1 ao B2" },
  { icon: ShieldCheck, text: "Seus dados isolados e protegidos no banco" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Painel de marca — some no mobile para não roubar a dobra */}
      <aside className="bg-primary text-primary-foreground relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_0%,rgba(255,255,255,0.22),transparent)]" />
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-white/10 blur-3xl" />

        <Link href="/" className="relative flex items-center gap-2.5 text-lg font-semibold">
          <span className="grid size-9 place-items-center rounded-lg bg-white/15">
            <Waves className="size-5" />
          </span>
          InglishEasy
        </Link>

        <div className="relative max-w-md">
          <h2 className="font-display text-3xl leading-tight font-bold">
            Um ano. Quinze minutos por dia. Uma conversa que você finalmente sustenta.
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="flex items-start gap-3 text-sm text-white/85">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-white/15">
                  <h.icon className="size-3.5" />
                </span>
                {h.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/55">
          © {new Date().getFullYear()} InglishEasy
        </p>
      </aside>

      {/* Formulário */}
      <main className="relative flex flex-col">
        <div className="bg-grid pointer-events-none absolute inset-0 -z-10 lg:hidden" />

        {/* Reserva a barra de status do iOS — ver --safe-top em globals.css. */}
        <div className="flex items-center justify-between p-5 pt-[calc(1.25rem+var(--safe-top))]">
          <Link href="/" className="flex items-center gap-2 font-semibold lg:invisible">
            <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md">
              <Waves className="size-3.5" />
            </span>
            InglishEasy
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-[calc(4rem+var(--safe-bottom))]">
          <div className="animate-in-up w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
