import SchedulePage from "@/app/app/cronograma/page";
import { getPrimaryCourse } from "@/lib/learning";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function CantoPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ circuito?: string }>;
}) {
  const { code } = await params;
  const { circuito } = await searchParams;

  const course = await getPrimaryCourse();
  if (!course) {
    return SchedulePage({ searchParams: Promise.resolve({ circuito }) });
  }

  const supabase = await createServerSupabase();
  const upperCode = code.toUpperCase();

  const { data: module } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", course.id)
    .ilike("code", upperCode)
    .maybeSingle();

  return SchedulePage({
    searchParams: Promise.resolve({
      modulo: module?.id ?? undefined,
      circuito,
    }),
  });
}
