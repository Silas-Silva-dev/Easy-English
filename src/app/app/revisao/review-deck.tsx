"use client";

import { CheckCircle2, Eye, PartyPopper, Repeat, Volume2, XCircle, Zap } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { AudioPlayer } from "@/components/audio/audio-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  formatInterval,
  masteryStage,
  previewNextInterval,
  STAGE_LABEL,
  STAGE_TONE,
  type ChunkMastery,
} from "@/lib/srs";
import { cn } from "@/lib/utils";

import { markSpokenAction, reviewChunkAction } from "./actions";

type Answer = "instant" | "hesitant" | "failed";

const ANSWERS: { id: Answer; label: string; hint: string; icon: typeof Zap; tone: string }[] = [
  {
    id: "instant",
    label: "Saiu na hora",
    hint: "Sem pensar",
    icon: Zap,
    tone: "border-success/40 hover:bg-success/10 text-success",
  },
  {
    id: "hesitant",
    label: "Hesitei",
    hint: "Lembrei, mas devagar",
    icon: Repeat,
    tone: "border-warning/40 hover:bg-warning/10 text-warning",
  },
  {
    id: "failed",
    label: "Não lembrei",
    hint: "Precisei ver",
    icon: XCircle,
    tone: "border-destructive/40 hover:bg-destructive/10 text-destructive",
  },
];

/**
 * Baralho de recuperação ativa.
 *
 * A ordem importa: mostra o PORTUGUÊS primeiro e pede a produção em inglês em
 * voz alta. O caminho inverso (ver o inglês e reconhecer) é fácil demais e
 * gera a ilusão de saber — reconhecer não é produzir.
 */
export function ReviewDeck({ chunks }: { chunks: ChunkMastery[] }) {
  const [index, setIndex] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [stats, setStats] = React.useState({ instant: 0, hesitant: 0, failed: 0 });
  const spokenRef = React.useRef<string[]>([]);

  const current = chunks[index];
  const done = index >= chunks.length;

  React.useEffect(() => {
    // Ao terminar, registra de uma vez os blocos produzidos em voz alta.
    if (done && spokenRef.current.length) {
      const keys = [...spokenRef.current];
      spokenRef.current = [];
      void markSpokenAction(keys);
    }
  }, [done]);

  function answer(result: Answer) {
    if (!current) return;

    startTransition(async () => {
      const response = await reviewChunkAction({ chunkKey: current.chunk_key, result });

      if (!response.ok) {
        toast.error(response.error ?? "Não foi possível salvar a revisão");
        return;
      }

      if (result !== "failed") spokenRef.current.push(current.chunk_key);
      setStats((s) => ({ ...s, [result]: s[result] + 1 }));
      setRevealed(false);
      setIndex((i) => i + 1);
    });
  }

  if (!chunks.length) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <div className="bg-success/12 text-success mx-auto grid size-14 place-items-center rounded-full">
            <CheckCircle2 className="size-6" />
          </div>
          <p className="mt-4 font-medium">Nenhum bloco vencendo hoje</p>
          <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm">
            Sua agenda está em dia. Blocos revisados voltam sozinhos no intervalo certo — não force
            revisão antecipada, ela atrapalha a consolidação.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/app">Voltar ao painel</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (done) {
    const total = stats.instant + stats.hesitant + stats.failed;
    return (
      <Card className="overflow-hidden">
        <div className="from-success/15 bg-gradient-to-b to-transparent px-6 pt-10 pb-6 text-center">
          <div className="bg-success/15 text-success mx-auto grid size-16 place-items-center rounded-full">
            <PartyPopper className="size-7" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold">Revisão fechada</h2>
          <p className="text-muted-foreground mt-2 text-sm">{total} blocos puxados da memória.</p>
        </div>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-success/10 rounded-xl p-4">
              <p className="text-success text-2xl font-semibold tabular-nums">{stats.instant}</p>
              <p className="text-muted-foreground text-xs">na hora</p>
            </div>
            <div className="bg-warning/10 rounded-xl p-4">
              <p className="text-warning text-2xl font-semibold tabular-nums">{stats.hesitant}</p>
              <p className="text-muted-foreground text-xs">hesitei</p>
            </div>
            <div className="bg-destructive/10 rounded-xl p-4">
              <p className="text-destructive text-2xl font-semibold tabular-nums">{stats.failed}</p>
              <p className="text-muted-foreground text-xs">não lembrei</p>
            </div>
          </div>

          {stats.failed > 0 ? (
            <p className="text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 text-sm leading-relaxed">
              Os {stats.failed} blocos que você não lembrou voltam <strong>amanhã</strong>. Errar na
              revisão não é retrocesso: é exatamente assim que o intervalo se recalibra.
            </p>
          ) : null}

          <Button asChild className="w-full" size="lg">
            <Link href="/app">Voltar ao painel</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const stage = masteryStage(current);
  const isLate = current.due_date < new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground tabular-nums">
            {index + 1} de {chunks.length}
          </span>
          <div className="flex items-center gap-1.5">
            <Badge variant={STAGE_TONE[stage]} className="text-[10px]">
              {STAGE_LABEL[stage]}
            </Badge>
            {isLate ? (
              <Badge variant="warning" className="text-[10px]">
                atrasado
              </Badge>
            ) : null}
          </div>
        </div>
        <Progress value={(index / chunks.length) * 100} className="h-1.5" />
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="text-center">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Como se diz em inglês?
            </p>
            <p className="mt-3 text-xl font-medium">{current.chunk_pt}</p>
          </div>

          {!revealed ? (
            <div className="space-y-4">
              <div className="border-border/70 rounded-xl border border-dashed px-5 py-8 text-center">
                <p className="text-sm font-medium">Diga em voz alta antes de conferir</p>
                <p className="text-muted-foreground mx-auto mt-1.5 max-w-xs text-xs leading-relaxed">
                  O esforço de puxar da memória é o exercício. Espiar antes de tentar transforma
                  isto numa leitura — e leitura não fixa.
                </p>
              </div>
              <Button size="lg" className="w-full" onClick={() => setRevealed(true)}>
                <Eye className="size-4" /> Já falei — mostrar resposta
              </Button>
            </div>
          ) : (
            <div className="animate-in-up space-y-4">
              <div className="bg-success/8 border-success/25 rounded-xl border p-5 text-center">
                <p className="text-lg font-semibold">{current.chunk_en}</p>
              </div>

              <AudioPlayer text={current.chunk_en} mode="single" label="Ouvir a pronúncia" compact />

              <div>
                <p className="text-muted-foreground mb-2 text-center text-xs">
                  Como foi? Seja honesto — a agenda depende disso.
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {ANSWERS.map((option) => {
                    const Icon = option.icon;
                    const grade =
                      option.id === "instant" ? 5 : option.id === "hesitant" ? 3 : 1;
                    const next = previewNextInterval(current, grade);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={pending}
                        onClick={() => answer(option.id)}
                        className={cn(
                          "rounded-xl border p-3 text-center transition-colors disabled:opacity-50",
                          option.tone,
                        )}
                      >
                        <Icon className="mx-auto size-4" />
                        <p className="mt-1.5 text-sm font-medium">{option.label}</p>
                        <p className="text-muted-foreground text-[10px]">{option.hint}</p>
                        <p className="text-muted-foreground/80 mt-1 text-[10px]">
                          volta {formatInterval(next)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-center text-xs">
        <Volume2 className="size-3" />
        Circuito {current.circuit_number} · falado {current.spoken_count}x em voz alta
      </p>
    </div>
  );
}
