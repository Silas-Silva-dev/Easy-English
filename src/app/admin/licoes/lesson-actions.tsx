"use client";

import { CheckCircle2, EyeOff, Loader2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { bulkPublishLessonsAction, toggleLessonPublishAction } from "../actions";

export function PublishToggle({ lessonId, published }: { lessonId: string; published: boolean }) {
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant={published ? "ghost" : "outline"}
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleLessonPublishAction(lessonId, !published);
          if (result.ok) toast.success(result.message ?? "Feito.");
          else toast.error(result.error ?? "Falha ao atualizar a lição.");
        })
      }
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : published ? (
        <EyeOff className="size-3.5" />
      ) : (
        <CheckCircle2 className="size-3.5" />
      )}
      {published ? "Despublicar" : "Publicar"}
    </Button>
  );
}

export function BulkPublishButton({ lessonIds }: { lessonIds: string[] }) {
  const [pending, startTransition] = React.useTransition();

  if (!lessonIds.length) return null;

  return (
    <Button
      variant="gradient"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await bulkPublishLessonsAction(lessonIds);
          if (result.ok) toast.success(result.message ?? "Feito.");
          else toast.error(result.error ?? "Falha ao publicar em lote.");
        })
      }
    >
      <CheckCircle2 className="size-4" />
      Publicar {lessonIds.length} desta página
    </Button>
  );
}
