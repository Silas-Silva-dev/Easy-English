import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name?: string | null, fallback = "?") {
  if (!name?.trim()) return fallback;
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || fallback;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function formatDate(value?: string | Date | null) {
  if (!value) return ": ";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? ": " : dateFormatter.format(date);
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return ": ";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? ": " : dateTimeFormatter.format(date);
}

export function formatRelative(value?: string | Date | null) {
  if (!value) return "nunca";
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `ha ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `ha ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `ha ${days} d`;
  return formatDate(date);
}

export function formatMinutes(total: number) {
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

export function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

export const DAYS_PER_CIRCUIT = 14;

/**
 * Converte o dia absoluto (1..728) na posicao dentro do circuito.
 *
 * O cronograma NAO tem dia da semana. Um curso de 2 anos que amarra a licao a
 * "segunda-feira" quebra na primeira vez que o aluno pula um dia: e todo
 * aluno pula. Aqui o Dia 42 e o Dia 42 independente da data em que ele chega.
 */
export function dayToCircuit(dayNumber: number) {
  const circuit = Math.ceil(dayNumber / DAYS_PER_CIRCUIT);
  const circuitDay = ((dayNumber - 1) % DAYS_PER_CIRCUIT) + 1;
  return { circuit, circuitDay, phase: circuitDay <= 7 ? ("A" as const) : ("B" as const) };
}

/** Rotulo curto do dia, sempre no formato "Dia N". */
export function dayLabel(dayNumber: number) {
  return `Dia ${dayNumber}`;
}
