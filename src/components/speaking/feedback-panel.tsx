"use client";

import {
  ArrowRight,
  BookMarked,
  Volume2,
  MessageSquareQuote,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { CefrLevel } from "@/lib/types/database";

export interface SpeakingResult {
  sessionId: string;
  audible: boolean;
  languageDetected: "en" | "pt" | "mixed" | "unknown";
  transcript: string;
  correctedText: string;
  estimatedLevel: CefrLevel;
  scores: {
    overall: number;
    pronunciation: number;
    fluency: number;
    grammar: number;
    vocabulary: number;
    task: number;
  };
  summary: string;
  encouragement: string;
  corrections: {
    original: string;
    corrected: string;
    explanation_pt: string;
    category: "pronunciation" | "grammar" | "vocabulary" | "fluency" | "naturalness";
    severity: "low" | "medium" | "high";
  }[];
  pronunciationNotes: { word: string; ipa: string; heard: string; tip_pt: string }[];
  suggestedPhrases: { en: string; pt: string; context?: string }[];
  audioUrl?: string;
  tutorAudioUrl?: string;
  nextSteps: string[];
}

const CATEGORY_LABEL = {
  pronunciation: "Pronúncia",
  grammar: "Gramática",
  vocabulary: "Vocabulário",
  fluency: "Fluência",
  naturalness: "Naturalidade",
} as const;

const SEVERITY_VARIANT = {
  high: "destructive",
  medium: "warning",
  low: "neutral",
} as const;

function scoreTone(score: number) {
  if (score >= 8) return "text-success";
  if (score >= 6) return "text-warning";
  return "text-destructive";
}

function scoreBar(score: number) {
  if (score >= 8) return "bg-success";
  if (score >= 6) return "bg-warning";
  return "bg-destructive";
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-semibold tabular-nums", scoreTone(value))}>
          {value.toFixed(1)}
        </span>
      </div>
      <Progress value={value * 10} className="h-1.5" indicatorClassName={scoreBar(value)} />
    </div>
  );
}

export function SpeakingFeedbackPanel({ result }: { result: SpeakingResult }) {
  const { scores } = result;

  return (
    <div className="animate-in-up space-y-5">
      {/* ------------------------------------------------------ Nota geral */}
      <Card className="overflow-hidden">
        <div className="from-primary/12 bg-gradient-to-br to-transparent p-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-5">
              <div className="text-center">
                <div className={cn("text-5xl font-bold tabular-nums", scoreTone(scores.overall))}>
                  {scores.overall.toFixed(1)}
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">nota geral</div>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>
                    <Trophy className="size-3" /> Nível estimado: {result.estimatedLevel}
                  </Badge>
                  {result.languageDetected === "pt" ? (
                    <Badge variant="warning">Você falou em português</Badge>
                  ) : null}
                  {!result.audible ? <Badge variant="destructive">Áudio inaudível</Badge> : null}
                </div>
                {result.encouragement ? (
                  <p className="mt-2.5 text-sm font-medium">{result.encouragement}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <ScoreRow label="Pronúncia" value={scores.pronunciation} />
          <ScoreRow label="Fluência" value={scores.fluency} />
          <ScoreRow label="Gramática" value={scores.grammar} />
          <ScoreRow label="Vocabulário" value={scores.vocabulary} />
          <ScoreRow label="Cumprimento da tarefa" value={scores.task} />
        </CardContent>
      </Card>

      {/* ------------------------------------------- Áudio gravado & Resposta em áudio */}
      <Card className="border-primary/25 bg-primary/4">
        <CardHeader className="pb-2">
          <CardTitle className="text-primary flex items-center gap-2 text-sm">
            <Volume2 className="size-4" /> Seu áudio salvo & Orientações da Professora Emma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Seu áudio gravado (salvo na plataforma)
            </p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio
              src={result.audioUrl ?? `/api/speaking/audio?sessionId=${result.sessionId}`}
              controls
              className="w-full"
            />
          </div>

          {result.tutorAudioUrl ? (
            <div className="border-primary/20 bg-background space-y-1.5 rounded-lg border p-3">
              <p className="text-primary flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                <Sparkles className="size-3.5" /> Orientação e correções faladas pela tutora
              </p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio src={result.tutorAudioUrl} controls autoPlay={false} className="w-full" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* --------------------------------------------------------- Resumo */}
      {result.summary ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="text-primary size-4" /> O que a tutora observou
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{result.summary}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* --------------------------------------- Transcrição vs. correção */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageSquareQuote className="size-4" /> O que você falou
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="bg-muted/60 rounded-lg p-4 text-sm leading-relaxed italic">
              {result.transcript || ": "}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-success flex items-center gap-2 text-sm">
              <Sparkles className="size-4" /> Como soaria natural
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="bg-success/8 border-success/20 rounded-lg border p-4 text-sm leading-relaxed">
              {result.correctedText || ": "}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ----------------------------------------------------- Correções */}
      {result.corrections.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Correções ({result.corrections.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.corrections.map((correction, i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="mb-2.5 flex flex-wrap items-center gap-2">
                  <Badge variant={SEVERITY_VARIANT[correction.severity]} className="text-[10px]">
                    {CATEGORY_LABEL[correction.category] ?? correction.category}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-destructive line-through decoration-1">
                    {correction.original}
                  </span>
                  <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
                  <span className="text-success font-medium">{correction.corrected}</span>
                </div>

                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {correction.explanation_pt}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* ------------------------------------------- Notas de pronúncia */}
      {result.pronunciationNotes.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Volume2 className="size-4" /> Pronúncia: palavra por palavra
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {result.pronunciationNotes.map((note, i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold">{note.word}</span>
                  <code className="text-primary bg-primary/8 rounded px-1.5 py-0.5 font-mono text-xs">
                    {note.ipa}
                  </code>
                </div>
                <p className="text-muted-foreground mt-1.5 text-xs">
                  Você falou: <span className="text-destructive font-medium">{note.heard}</span>
                </p>
                <p className="mt-2 text-sm leading-relaxed">{note.tip_pt}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* ------------------------------------------------ Frases sugeridas */}
      {result.suggestedPhrases.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookMarked className="size-4" /> Frases para incorporar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {result.suggestedPhrases.map((phrase, i) => (
              <div key={i} className="bg-muted/50 rounded-lg px-4 py-3">
                <p className="text-sm font-medium">{phrase.en}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">{phrase.pt}</p>
                {phrase.context ? (
                  <p className="text-muted-foreground/80 mt-1 text-[11px] italic">{phrase.context}</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* -------------------------------------------------- Próximos passos */}
      {result.nextSteps.length ? (
        <Card className="border-primary/25 bg-primary/4">
          <CardHeader className="pb-2">
            <CardTitle className="text-primary flex items-center gap-2 text-sm">
              <Target className="size-4" /> O que treinar na próxima
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {result.nextSteps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span className="bg-primary/12 text-primary mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
