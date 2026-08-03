"use client";

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { toggleCoursePublishAction } from "../actions";

export function CoursePublishToggle({
  courseId,
  published,
}: {
  courseId: string;
  published: boolean;
}) {
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant={published ? "outline" : "default"}
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleCoursePublishAction(courseId, !published);
          if (result.ok) toast.success(result.message ?? "Feito.");
          else toast.error(result.error ?? "Falha ao atualizar o curso.");
        })
      }
    >
      {published ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      {published ? "Despublicar" : "Publicar"}
    </Button>
  );
}
