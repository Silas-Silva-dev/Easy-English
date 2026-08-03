import { AppShell, type NavItem } from "@/components/app-shell";
import { requireActiveUser } from "@/lib/auth/guards";
import { getOrCreateEnrollment, getPrimaryCourse } from "@/lib/learning";

import { signOutAction } from "../(auth)/actions";

const NAV: NavItem[] = [
  { href: "/app", label: "Meu dia", icon: "dashboard", exact: true },
  { href: "/app/cronograma", label: "Cronograma", icon: "dashboard" },
  { href: "/app/revisao", label: "Revisão", icon: "brain" },
  { href: "/app/conversacao", label: "Praticar fala", icon: "mic" },
  { href: "/app/ao-vivo", label: "Conversa ao vivo", icon: "radio" },
  { href: "/app/progresso", label: "Meu progresso", icon: "progress" },
  { href: "/app/perfil", label: "Perfil", icon: "settings" },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { profile, userId } = await requireActiveUser("/app");

  const course = await getPrimaryCourse();
  const enrollment = course ? await getOrCreateEnrollment(userId, course) : null;

  return (
    <AppShell
      profile={profile}
      nav={NAV}
      brandHref="/app"
      brandLabel="InglishEasy"
      streak={enrollment?.streak_current ?? 0}
      signOut={signOutAction}
    >
      {children}
    </AppShell>
  );
}
