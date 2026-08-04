"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Barra de compra fixa no rodapé, só no celular.
 *
 * No desktop o botão do topo acompanha a rolagem o tempo todo; no celular o
 * cabeçalho encolhe e a única chamada fica a 4 telas de distância. Esta barra
 * devolve o botão sem roubar espaço de leitura.
 *
 * Aparece depois que o hero sai da tela e some nas seções que já têm o próprio
 * botão de compra na frente do visitante — sobrepor um segundo botão ali só
 * cobriria conteúdo, inclusive o rodapé.
 */
const SECTIONS_WITH_OWN_CTA = ["investimento", "cta-final"];

export function MobileCta({ priceLabel }: { priceLabel: string }) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero || typeof IntersectionObserver === "undefined") return;

    const owners = SECTIONS_WITH_OWN_CTA.map((id) =>
      document.getElementById(id),
    ).filter((node): node is HTMLElement => node !== null);

    let pastHero = false;
    const showingOwnCta = new Set<Element>();

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === hero) {
          // `top < 0` distingue "já passou do hero" de "ainda não chegou nele".
          pastHero = !entry.isIntersecting && entry.boundingClientRect.top < 0;
          continue;
        }
        if (entry.isIntersecting) showingOwnCta.add(entry.target);
        else showingOwnCta.delete(entry.target);
      }
      setVisible(pastHero && showingOwnCta.size === 0);
    });

    observer.observe(hero);
    for (const node of owners) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn(
        "glass fixed inset-x-0 bottom-0 z-40 border-t transition-transform duration-300 md:hidden",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      // Fora do fluxo enquanto escondida: sem isto o leitor de tela anunciaria
      // um botão que não está na tela.
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3 px-4 pt-3 pb-[calc(0.75rem+var(--safe-bottom))]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{priceLabel}</p>
          <p className="text-muted-foreground truncate text-[11px]">
            Pagamento único · acesso vitalício
          </p>
        </div>
        <Button
          asChild
          size="lg"
          variant="gradient"
          className="shrink-0 shadow-lg"
        >
          <Link href="/cadastro" tabIndex={visible ? undefined : -1}>
            Quero meu acesso <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
