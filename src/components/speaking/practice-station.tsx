"use client";

import { Mic, Quote, RefreshCcw, Sparkles } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { SpeakingFeedbackPanel, type SpeakingResult } from "./feedback-panel";
import { SpeakingRecorder } from "./recorder";

/**
 * Estação de prática: enunciado + gravador + feedback.
 * Usada tanto na lição do dia quanto na prática livre.
 */
export function PracticeStation({
  prompt,
  promptHelp,
  lessonId,
  rubric,
  onCompleted,
}: {
  prompt: string;
  promptHelp?: string;
  lessonId?: string;
  rubric?: { criterion: string; description: string }[];
  onCompleted?: (result: SpeakingResult) => void;
}) {
  const [result, setResult] = React.useState<SpeakingResult | null>(null);
  const resultRef = React.useRef<HTMLDivElement>(null);

  function handleResult(next: SpeakingResult) {
    setResult(next);
    onCompleted?.(next);
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Mic className="text-primary size-4" /> Desafio de fala
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <blockquote className="border-primary bg-primary/6 rounded-r-lg border-l-3 py-3 pr-4 pl-4">
            <Quote className="text-primary/40 mb-1.5 size-4" />
            <p className="text-[0.95rem] leading-relaxed font-medium">{prompt}</p>
            {promptHelp ? (
              <p className="text-muted-foreground mt-2 text-sm">{promptHelp}</p>
            ) : null}
          </blockquote>

          {rubric?.length ? (
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Você será avaliado em
              </p>
              <div className="flex flex-wrap gap-2">
                {rubric.map((item) => (
                  <span
                    key={item.criterion}
                    title={item.description}
                    className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs"
                  >
                    {item.criterion}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {result ? (
            <div className="flex items-center justify-center pt-2">
              <Button variant="outline" onClick={() => setResult(null)}>
                <RefreshCcw className="size-4" /> Gravado · Regravar fala
              </Button>
            </div>
          ) : (
            <SpeakingRecorder prompt={prompt} lessonId={lessonId} onResult={handleResult} />
          )}
        </CardContent>
      </Card>

      {result ? (
        <div ref={resultRef} className="scroll-mt-24 space-y-4">
          <div className="flex items-center justify-between gap-3 border-b pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary size-5 animate-pulse" />
              <h3 className="text-base font-bold tracking-tight">Avaliação & Correção da Sua Fala</h3>
            </div>
            <Button variant="outline" size="sm" onClick={() => setResult(null)}>
              <RefreshCcw className="size-3.5" /> Refazer gravação
            </Button>
          </div>
          <SpeakingFeedbackPanel result={result} />
        </div>
      ) : null}
    </div>
  );
}
