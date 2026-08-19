import { AppShell, type NavGroup, type NavItem } from "@/components/app-shell";
import { requirePaidUser } from "@/lib/auth/guards";
import { getOrCreateEnrollment, getPrimaryCourse } from "@/lib/learning";
import { createServerSupabase } from "@/lib/supabase/server";
import { pct } from "@/lib/utils";

import { signOutAction } from "../(auth)/actions";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, userId } = await requirePaidUser("/app");

  const course = await getPrimaryCourse();
  const enrollment = course
    ? await getOrCreateEnrollment(userId, course)
    : null;
  const supabase = await createServerSupabase();

  // Buscar progresso dos 4 cantos
  let cantoStats: Record<string, { done: number; total: number; pct: number }> =
    {
      C1: { done: 0, total: 182, pct: 0 },
      C2: { done: 0, total: 182, pct: 0 },
      C3: { done: 0, total: 182, pct: 0 },
      C4: { done: 0, total: 182, pct: 0 },
    };

  if (course) {
    const [{ data: modules }, { data: allLessons }, { data: completedRows }] =
      await Promise.all([
        supabase
          .from("modules")
          .select("id, code, title, position")
          .eq("course_id", course.id)
          .order("position"),
        supabase
          .from("lessons")
          .select("id, module_id")
          .eq("course_id", course.id),
        enrollment
          ? supabase
              .from("lesson_progress")
              .select("lesson_id")
              .eq("enrollment_id", enrollment.id)
              .eq("status", "completed")
          : Promise.resolve({ data: [] as { lesson_id: string }[] }),
      ]);

    const completedIds = new Set((completedRows ?? []).map((r) => r.lesson_id));
    const moduleMap = new Map((modules ?? []).map((m) => [m.id, m.code]));

    const perModule = new Map<string, { total: number; done: number }>();
    for (const lesson of allLessons ?? []) {
      const code = moduleMap.get(lesson.module_id);
      if (!code) continue;
      const bucket = perModule.get(code) ?? { total: 0, done: 0 };
      bucket.total++;
      if (completedIds.has(lesson.id)) bucket.done++;
      perModule.set(code, bucket);
    }

    for (const [code, data] of perModule.entries()) {
      cantoStats[code] = {
        done: data.done,
        total: data.total,
        pct: pct(data.done, data.total),
      };
    }
  }

  const nav: NavItem[] = [
    // Primeiro da lista, e em destaque: é a única tela do produto em que o
    // aluno FALA com alguém, e a que ele mais evita. Estava em quarto lugar,
    // entre "Praticar fala" e "Tradutor", com o mesmo peso visual de tudo.
    {
      href: "/app/ao-vivo",
      label: "Conversa ao vivo",
      sublabel: "Fale com a Emma agora",
      icon: "radio",
      // Sem `exact`: a subtela do histórico (/app/ao-vivo/historico) mantém a
      // entrada acesa, senão o aluno perde a referência de onde está.
      highlight: true,
    },
    { href: "/app", label: "Meu Painel", icon: "dashboard", exact: true },
    {
      href: "/app/curso",
      label: "Curso 4 Cantos",
      sublabel: "Inglês focado na fala",
      icon: "book",
    },
    { href: "/app/revisao", label: "Revisão", icon: "brain" },
    { href: "/app/conversacao", label: "Praticar fala", icon: "mic" },
    { href: "/app/tradutor", label: "Tradutor", icon: "translate" },
    { href: "/app/progresso", label: "Meu progresso", icon: "progress" },
    { href: "/app/certificado", label: "Meu certificado", icon: "award" },
    { href: "/app/perfil", label: "Perfil", icon: "settings" },
  ];

  return (
    <AppShell
      profile={profile}
      nav={nav}
      brandHref="/app"
      brandLabel="Easy English"
      streak={enrollment?.streak_current ?? 0}
      signOut={signOutAction}
    >
      {children}
    </AppShell>
  );
}
