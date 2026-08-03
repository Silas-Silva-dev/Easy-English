"use client";

import { AlertCircle, CheckCircle2, Save } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Lesson } from "@/lib/types/database";

import { updateLessonAction, type ActionResult } from "../../actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      <Save className="size-4" /> Salvar lição
    </Button>
  );
}

export function LessonEditor({ lesson }: { lesson: Lesson }) {
  const action = updateLessonAction.bind(null, lesson.id);
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: false });

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <p className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="bg-success/10 text-success flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-[1fr_9rem]">
        <div className="space-y-2">
          <Label htmlFor="title">Título</Label>
          <Input id="title" name="title" defaultValue={lesson.title} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimated_minutes">Duração (min)</Label>
          <Input
            id="estimated_minutes"
            name="estimated_minutes"
            type="number"
            min={1}
            max={180}
            defaultValue={lesson.estimated_minutes}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subtitle">Subtítulo</Label>
        <Input id="subtitle" name="subtitle" defaultValue={lesson.subtitle ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="objective">Objetivo pedagógico</Label>
        <Textarea id="objective" name="objective" defaultValue={lesson.objective ?? ""} rows={2} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="grammar_focus">Foco gramatical</Label>
        <Input id="grammar_focus" name="grammar_focus" defaultValue={lesson.grammar_focus ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="grammar_explanation">Explicação da gramática (markdown)</Label>
        <Textarea
          id="grammar_explanation"
          name="grammar_explanation"
          defaultValue={lesson.grammar_explanation ?? ""}
          rows={8}
          className="font-mono text-xs"
        />
        <p className="text-muted-foreground text-xs">
          Suporta <code>**negrito**</code>, <code>*itálico*</code>, <code>`código`</code>, listas e
          tabelas em pipe.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="listening_script">Script do áudio</Label>
        <Textarea
          id="listening_script"
          name="listening_script"
          defaultValue={lesson.listening_script ?? ""}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="speaking_prompt">Enunciado da prática falada (em português)</Label>
        <Textarea
          id="speaking_prompt"
          name="speaking_prompt"
          defaultValue={lesson.speaking_prompt ?? ""}
          rows={3}
        />
        <p className="text-muted-foreground text-xs">
          Escreva o que fazer em português — o aluno precisa entender a tarefa. As frases-alvo em
          inglês vão entre «aspas». É este texto que a tutora de IA usa como critério de avaliação.
        </p>
      </div>

      <SaveButton />
    </form>
  );
}
