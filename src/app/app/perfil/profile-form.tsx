"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile, StudyTrack } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { TRACKS } from "@content/curriculum";

import { updateProfileAction } from "../actions";

const LEVELS = [
  { value: "A1", label: "A1 — Iniciante absoluto" },
  { value: "A2", label: "A2 — Básico" },
  { value: "B1", label: "B1 — Intermediário" },
  { value: "B2", label: "B2 — Intermediário avançado" },
  { value: "C1", label: "C1 — Avançado" },
];

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Fortaleza",
  "America/Cuiaba",
  "America/Rio_Branco",
  "America/Noronha",
  "UTC",
];

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Salvar alterações
    </Button>
  );
}

export function ProfileForm({
  profile,
  track,
}: {
  profile: Profile;
  track: StudyTrack;
}) {
  const [state, action] = useActionState(updateProfileAction, {});
  const [selected, setSelected] = useState<StudyTrack>(track);
  const current = TRACKS.find((t) => t.id === selected) ?? TRACKS[1];

  return (
    <form action={action} className="space-y-5">
      {state.error ? (
        <p className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="bg-success/10 text-success flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          {state.success}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input id="fullName" name="fullName" defaultValue={profile.full_name ?? ""} required />
      </div>

      {/* -------------------------------------------------------- Trilha
          O conteúdo é o mesmo nas três; o que muda é quanto se faz por dia —
          e a meta prometida muda junto. É por isso que o limite honesto de
          cada trilha aparece aqui, na hora da escolha, e não só na landing. */}
      <div className="space-y-2">
        <Label>Ritmo de estudo</Label>
        <input type="hidden" name="track" value={selected} />
        <div className="grid gap-2 sm:grid-cols-3">
          {TRACKS.map((option) => {
            const active = option.id === selected;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelected(option.id)}
                aria-pressed={active}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  active ? "border-primary bg-primary/8" : "hover:bg-accent",
                )}
              >
                <p className="text-sm font-medium">{option.label}</p>
                <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                  {option.dailyMinutes} min/dia · {option.totalHours} h · meta {option.cefr}
                </p>
              </button>
            );
          })}
        </div>

        <div className="bg-muted/50 space-y-2 rounded-lg p-3.5">
          <p className="text-sm leading-relaxed">
            <strong className="text-success">Entrega:</strong> {current.promise}
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            <strong className="text-streak">Não entrega:</strong> {current.honestLimit}
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dailyGoalMinutes">Meta diária (minutos)</Label>
          <Input
            id="dailyGoalMinutes"
            name="dailyGoalMinutes"
            type="number"
            min={5}
            max={180}
            step={5}
            defaultValue={profile.daily_goal_minutes}
            required
          />
          <p className="text-muted-foreground text-xs">
            A trilha {current.label} pede {current.dailyMinutes} min por dia.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetLevel">Nível alvo</Label>
          <Select id="targetLevel" name="targetLevel" defaultValue={profile.target_level}>
            {LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </Select>
          <p className="text-muted-foreground text-xs">
            Calibra a exigência da tutora nas correções.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="timezone">Fuso horário</Label>
        <Select id="timezone" name="timezone" defaultValue={profile.timezone}>
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </Select>
        <p className="text-muted-foreground text-xs">
          Define quando o dia vira para efeito da ofensiva.
        </p>
      </div>

      <SaveButton />
    </form>
  );
}
