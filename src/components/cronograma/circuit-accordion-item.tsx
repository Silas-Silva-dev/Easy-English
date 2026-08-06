"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface CircuitAccordionItemProps {
  circuit: number;
  isOpen: boolean;
  isCurrent: boolean;
  children: React.ReactNode;
}

export function CircuitAccordionItem({
  circuit,
  isOpen,
  isCurrent,
  children,
}: CircuitAccordionItemProps) {
  function handleToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    const details = e.currentTarget;

    // Alinha ao topo do próprio circuito SOMENTE no mobile (largura < 768px)
    if (details.open && typeof window !== "undefined" && window.innerWidth < 768) {
      setTimeout(() => {
        details.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }

  return (
    <details
      name="circuitos"
      open={isOpen}
      onToggle={handleToggle}
      className={cn(
        "group bg-card overflow-hidden rounded-xl border transition-colors scroll-mt-20 sm:scroll-mt-24",
        isCurrent && "border-primary/45",
      )}
    >
      {children}
    </details>
  );
}
