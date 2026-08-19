import { redirect } from "next/navigation";

export default async function CantoRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ circuito?: string; day?: string }>;
}) {
  const { code } = await params;
  const { circuito, day } = await searchParams;

  const query = new URLSearchParams();
  if (code) query.set("canto", code);
  if (circuito) query.set("circuito", circuito);
  if (day) query.set("day", day);

  const qs = query.toString();
  redirect(`/app/curso${qs ? `?${qs}` : ""}`);
}
