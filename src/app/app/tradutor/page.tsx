import type { Metadata } from "next";

import { TranslatorPanel } from "@/components/translator/translator-panel";
import { VoiceTranslator } from "@/components/translator/voice-translator";
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

      <TranslatorPanel />

      {/*
        A voz vem DEPOIS do tradutor de texto de propósito: quem chega aqui
        procurando uma palavra encontra o campo de digitar primeiro, e quem
        quer falar desce uma tela. O contrário esconderia a ferramenta mais
        usada atrás da mais nova.
      */}
      <VoiceTranslator />
    </div>
  );
}
