import { redirect } from "next/navigation";

export default async function CantoIndexRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ canto?: string; circuito?: string; day?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.canto) query.set("canto", params.canto);
  if (params.circuito) query.set("circuito", params.circuito);
  if (params.day) query.set("day", params.day);

  const qs = query.toString();
  redirect(`/app/curso${qs ? `?${qs}` : ""}`);
}
