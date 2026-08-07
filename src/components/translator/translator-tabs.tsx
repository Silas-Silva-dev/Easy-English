"use client";

import { Keyboard, Mic } from "lucide-react";
import * as React from "react";

import { TranslatorPanel } from "@/components/translator/translator-panel";
import { VoiceTranslator } from "@/components/translator/voice-translator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * As duas ferramentas do tradutor, uma por aba.
 *
 * Empilhadas na mesma tela, a de voz ficava abaixo da dobra e o aluno precisava
 * rolar sem saber que ela existia — e as duas competiam pelo mesmo espaço
 * vertical, cada uma com o seu seletor de idioma.
 *
 * O texto vem primeiro porque é o uso mais comum: quem abre o tradutor
 * normalmente quer conferir uma palavra.
 */
export function TranslatorTabs() {
  return (
    <Tabs defaultValue="texto" className="w-full">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="texto" className="flex-1 gap-2 sm:flex-none">
          <Keyboard />
          Digitar
        </TabsTrigger>
        <TabsTrigger value="voz" className="flex-1 gap-2 sm:flex-none">
          <Mic />
          Falar
        </TabsTrigger>
      </TabsList>

      <TabsContent value="texto">
        <TranslatorPanel />
      </TabsContent>

      {/*
        `forceMount` + `hidden` mantém o painel de voz montado ao trocar de aba.
        Sem isso, sair da aba desmonta o componente, o reconhecimento morre no
        meio da frase e a transcrição já feita some — inclusive as traduções
        que ainda estavam voltando do servidor.
      */}
      <TabsContent value="voz" forceMount className="data-[state=inactive]:hidden">
        <VoiceTranslator />
      </TabsContent>
    </Tabs>
  );
}
