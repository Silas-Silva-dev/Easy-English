import type { Metadata } from "next";

import { TranslatorTabs } from "@/components/translator/translator-tabs";
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
        description="Tradução instantânea entre inglês e português — por texto, com pronúncia, IPA e exemplos, ou por voz, falando direto no microfone."
      />

      <TranslatorTabs />
    </div>
  );
}
