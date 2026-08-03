"use client";

import {
  Brain,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  Radio,
  Settings,
  Shield,
  TrendingUp,
  Waves,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { ThemeToggle } from "@/components/theme-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, initials } from "@/lib/utils";
import type { Profile } from "@/lib/types/database";

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  exact?: boolean;
  badge?: string;
}

const ICONS = {
  dashboard: LayoutDashboard,
  mic: Mic,
  radio: Radio,
  brain: Brain,
  progress: TrendingUp,
  settings: Settings,
  shield: Shield,
} as const;

const ROLE_LABEL: Record<Profile["role"], string> = {
  student: "Aluno",
  instructor: "Instrutor",
  admin: "Admin",
};

const ROLE_TONE: Record<Profile["role"], "neutral" | "success" | "streak"> = {
  student: "neutral",
  instructor: "success",
  admin: "streak",
};

export function AppShell({
  profile,
  nav,
  brandHref,
  brandLabel,
  streak,
  signOut,
  children,
}: {
  profile: Profile;
  nav: NavItem[];
  brandHref: string;
  brandLabel: string;
  streak?: number;
  signOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => setOpen(false), [pathname]);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const navList = (
    <nav className="space-y-1">
      {nav.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              // min-h-11 garante alvo de toque confortável no celular.
              "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge ? (
              <Badge variant="neutral" className="text-[10px]">
                {item.badge}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  /** Quem está logado, no pé do menu — some a dúvida de "qual conta é esta?". */
  const identity = (
    <div className="border-sidebar-border border-t p-3">
      <Link
        href="/app/perfil"
        className="hover:bg-accent flex items-center gap-3 rounded-lg p-2 transition-colors"
      >
        <Avatar className="size-9 shrink-0">
          {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
          <AvatarFallback>{initials(profile.full_name ?? profile.email)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{profile.full_name ?? "Aluno"}</p>
          <p className="text-muted-foreground truncate text-xs">{profile.email}</p>
        </div>

        <Badge variant={ROLE_TONE[profile.role]} className="shrink-0 text-[10px]">
          {ROLE_LABEL[profile.role]}
        </Badge>
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      {/* ------------------------------------------------- Sidebar (desktop)
          `sticky top-0 h-screen` mantém o menu parado enquanto a página rola.
          Só funciona porque o aside é filho direto do grid e tem altura menor
          que a linha — trocar isso por `fixed` exigiria compensar a margem da
          coluna de conteúdo à mão. */}
      <aside className="bg-sidebar border-sidebar-border hidden border-r lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Link href={brandHref} className="flex items-center gap-2.5 font-semibold">
            <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg">
              <Waves className="size-4" />
            </span>
            <span className="tracking-tight">{brandLabel}</span>
          </Link>
        </div>

        {/* Só a lista rola, quando a navegação for maior que a tela. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">{navList}</div>

        {typeof streak === "number" ? (
          <div className="shrink-0 px-3 pb-3">
            <div className="bg-streak/10 text-streak flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm">
              <span className="text-lg leading-none">🔥</span>
              <div className="min-w-0">
                <p className="leading-tight font-semibold tabular-nums">{streak} dias</p>
                <p className="text-[11px] opacity-80">de ofensiva</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="shrink-0">{identity}</div>
      </aside>

      {/* -------------------------------------------------- Sidebar (mobile) */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          />
          {/* max-w-[85vw] evita o menu encostar na borda em telas de 320px. */}
          <div className="bg-sidebar animate-in-up absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r">
            <div className="flex h-16 shrink-0 items-center justify-between px-5">
              <Link href={brandHref} className="flex min-w-0 items-center gap-2.5 font-semibold">
                <span className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-lg">
                  <Waves className="size-4" />
                </span>
                <span className="truncate">{brandLabel}</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">{navList}</div>

            <div className="shrink-0">{identity}</div>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------------ Coluna */}
      <div className="flex min-w-0 flex-col">
        <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 sm:px-6">
          {/* size="icon" (40px): é o ÚNICO acesso à navegação no celular e fica
              encostado na borda, onde o polegar erra mais. */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="size-4" />
          </Button>

          <div className="flex-1" />

          {typeof streak === "number" && streak > 0 ? (
            <Badge variant="streak" className="hidden sm:inline-flex">
              🔥 {streak} dias
            </Badge>
          ) : null}

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hover:bg-accent flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 transition-colors">
                <Avatar className="size-8">
                  {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
                  <AvatarFallback>{initials(profile.full_name ?? profile.email)}</AvatarFallback>
                </Avatar>
                <ChevronDown className="text-muted-foreground size-3.5" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="text-foreground">
                <div className="truncate font-medium">{profile.full_name ?? "Aluno"}</div>
                <div className="text-muted-foreground truncate text-xs font-normal">
                  {profile.email}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link href="/app/perfil">
                  <Settings /> Meu perfil
                </Link>
              </DropdownMenuItem>

              {profile.role === "admin" || profile.role === "instructor" ? (
                <DropdownMenuItem asChild>
                  <Link href="/admin">
                    <Shield /> Painel administrativo
                  </Link>
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuSeparator />

              <form action={signOut}>
                <button type="submit" className="w-full">
                  <DropdownMenuItem variant="destructive" asChild>
                    <span>
                      <LogOut /> Sair
                    </span>
                  </DropdownMenuItem>
                </button>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
