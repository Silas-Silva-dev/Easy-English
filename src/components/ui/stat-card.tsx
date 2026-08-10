import * as React from "react";

import { cn } from "@/lib/utils";

const TONE_STYLES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  streak: "bg-streak/15 text-streak",
  neutral: "bg-muted text-muted-foreground",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "primary",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: keyof typeof TONE_STYLES;
  className?: string;
}) {
  return (
    <div className={cn("bg-card card-hover rounded-xl border p-5 max-sm:p-4 shadow-xs", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground truncate max-sm:overflow-visible max-sm:whitespace-normal text-xs font-medium tracking-wide uppercase">
            {label}
          </p>
          <p className="mt-2 text-2xl max-sm:text-xl font-semibold tabular-nums">{value}</p>
        </div>
        {icon ? (
          <div
            className={cn(
              "grid size-10 max-sm:size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-5 max-sm:[&_svg]:size-4",
              TONE_STYLES[tone],
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
      {hint ? <p className="text-muted-foreground mt-3 text-xs">{hint}</p> : null}
    </div>
  );
}
