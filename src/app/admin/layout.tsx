import { AppShell, type NavItem } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/guards";

import { signOutAction } from "../(auth)/actions";

const NAV: NavItem[] = [
  { href: "/admin", label: "Visão geral", icon: "dashboard", exact: true },
  { href: "/admin/usuarios", label: "Usuários", icon: "shield" },
  { href: "/admin/cursos", label: "Cursos", icon: "dashboard" },
  { href: "/admin/licoes", label: "Lições", icon: "dashboard" },
  { href: "/admin/conversacao", label: "Práticas de fala", icon: "mic" },
  { href: "/admin/auditoria", label: "Auditoria", icon: "settings" },
  { href: "/app", label: "Voltar ao curso", icon: "progress" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff("/admin");

  // Instrutor não gerencia usuários nem vê a auditoria.
  const nav = profile.role === "admin" ? NAV : NAV.filter((n) => !["/admin/usuarios", "/admin/auditoria"].includes(n.href));

  return (
    <AppShell
      profile={profile}
      nav={nav}
      brandHref="/admin"
      brandLabel="Admin"
      signOut={signOutAction}
    >
      {children}
    </AppShell>
  );
}
