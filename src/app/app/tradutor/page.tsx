import type { Metadata } from "next";

import { TranslatorPanel } from "@/components/translator/translator-panel";
import { PageHeader } from "@/components/ui/misc";
import { requireActiveUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Tradutor" };

export default async function TranslatorPage() {
  await requireActiveUser("/app/tradutor");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Ferramenta"
        title="Tradutor"
        description="Tradução instantânea entre inglês e português com pronúncia, IPA e exemplos de uso em contexto."
      />

      <TranslatorPanel />
    </div>
  );
}
