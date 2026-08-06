import { AppShell, type NavItem } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/guards";

import { signOutAction } from "../(auth)/actions";

const NAV: NavItem[] = [
  { href: "/admin", label: "Visão geral", icon: "dashboard", exact: true },
  { href: "/admin/usuarios", label: "Usuários", icon: "shield" },
  { href: "/admin/pagamentos", label: "Pagamentos", icon: "progress" },
  { href: "/admin/cursos", label: "Cursos", icon: "dashboard" },
  { href: "/admin/licoes", label: "Lições", icon: "dashboard" },
  { href: "/admin/conversacao", label: "Práticas de fala", icon: "mic" },
  { href: "/admin/certificados", label: "Certificados", icon: "award" },
  { href: "/admin/auditoria", label: "Auditoria", icon: "settings" },
  { href: "/app", label: "Voltar ao curso", icon: "progress" },
];

/** Telas restritas ao admin: instrutor não mexe em gente, dinheiro nem log. */
const ADMIN_ONLY = ["/admin/usuarios", "/admin/pagamentos", "/admin/auditoria"];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff("/admin");

  const nav = profile.role === "admin" ? NAV : NAV.filter((n) => !ADMIN_ONLY.includes(n.href));

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
