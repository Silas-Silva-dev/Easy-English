"use client";

import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Compass,
  GraduationCap,
  Layers,
  ListFilter,
  Lock,
  Mic,
  PanelRightClose,
  PanelRightOpen,
  PlayCircle,
  Radio,
  Search,
  Sparkles,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn, pct } from "@/lib/utils";
import {
  CANTOS,
  type CantoSpec,
  type CircuitSpec,
  DAY_RHYTHM,
  DAYS_PER_CIRCUIT,
  TOTAL_DAYS,
} from "@content/curriculum";

export interface SidebarLessonItem {
  id: string;
  day_number: number;
  week_number: number;
  circuit_day: number;
  title: string;
  kind: string;
  is_published: boolean;
  phase?: "A" | "B";
}

export interface CourseSidebarProps {
  cantos?: CantoSpec[];
  circuits?: CircuitSpec[];
  lessons: SidebarLessonItem[];
  completedLessonIds: string[];
  selectedDay: number;
  currentDay: number;
}

const ROLE_ICONS: Record<string, typeof Mic> = {
  listening: Volume2,
  vocabulary: BookOpen,
  grammar: Layers,
  dialogue: Volume2,
  speaking: Mic,
  review: Sparkles,
  assessment: Zap,
};

const KIND_LABELS: Record<string, string> = {
  listening: "Escuta",
  vocabulary: "Blocos",
  grammar: "Troca de peças",
  dialogue: "Diálogo",
  speaking: "Fala",
  review: "Revisão",
  assessment: "Missão",
};

export function CourseSidebar({
  cantos = CANTOS,
  circuits = [],
  lessons,
  completedLessonIds,
  selectedDay,
  currentDay,
}: CourseSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState("");
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  // Determina Canto e Circuito do dia selecionado
  const selectedCircuit = Math.ceil(selectedDay / DAYS_PER_CIRCUIT);
  const selectedCantoSpec =
    cantos.find(
      (c) => selectedCircuit >= c.weekStart && selectedCircuit <= c.weekEnd,
    ) ?? cantos[0];

  // Estado dos acordeões de Cantos (aberto o selecionado por padrão)
  const [openCantos, setOpenCantos] = React.useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      cantos.forEach((c) => {
        initial[c.code] = c.code === selectedCantoSpec?.code;
      });
      return initial;
    },
  );

  // Estado dos acordeões de Circuitos (aberto o selecionado por padrão)
  const [openCircuits, setOpenCircuits] = React.useState<
    Record<number, boolean>
  >(() => {
    return { [selectedCircuit]: true };
  });

  const completedSet = React.useMemo(
    () => new Set(completedLessonIds),
    [completedLessonIds],
  );

  // Mapas auxiliares para cálculo de progresso
  const totalLessons = lessons.length || TOTAL_DAYS;
  const totalCompleted = lessons.filter((l) => completedSet.has(l.id)).length;
  const totalProgressPct = pct(totalCompleted, totalLessons);

  // Mapa de lições por circuito
  const lessonsByCircuit = React.useMemo(() => {
    const map = new Map<number, SidebarLessonItem[]>();
    for (const lesson of lessons) {
      const list = map.get(lesson.week_number) ?? [];
      list.push(lesson);
      map.set(lesson.week_number, list);
    }
    // Ordena dias em cada circuito
    for (const [circuitNum, list] of map.entries()) {
      list.sort((a, b) => a.day_number - b.day_number);
    }
    return map;
  }, [lessons]);

  // Mapa de circuitos por número
  const circuitMap = React.useMemo(() => {
    const map = new Map<number, CircuitSpec>();
    for (const c of circuits) {
      map.set(c.number, c);
    }
    return map;
  }, [circuits]);

  const toggleCanto = (code: string) => {
    setOpenCantos((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const toggleCircuit = (circuitNum: number) => {
    setOpenCircuits((prev) => ({ ...prev, [circuitNum]: !prev[circuitNum] }));
  };

  // Filtragem pela busca
  const query = search.trim().toLowerCase();
  const isSearching = query.length > 0;

  // Render do conteúdo da árvore
  const renderCurriculumTree = () => {
    return (
      <div className="space-y-3 pb-8">
        {cantos.map((canto) => {
          const isCantoOpen = isSearching || (openCantos[canto.code] ?? false);

          // Circuitos pertencentes a este canto
          const cantoCircuits: number[] = [];
          for (let w = canto.weekStart; w <= canto.weekEnd; w++) {
            cantoCircuits.push(w);
          }

          // Lições deste canto
          const cantoLessons = lessons.filter(
            (l) => l.week_number >= canto.weekStart && l.week_number <= canto.weekEnd,
          );
          const cantoDone = cantoLessons.filter((l) => completedSet.has(l.id)).length;
          const cantoTotal = cantoLessons.length || (canto.weekEnd - canto.weekStart + 1) * DAYS_PER_CIRCUIT;
          const cantoPct = pct(cantoDone, cantoTotal);

          // Se estiver pesquisando, verifica se algum item dá match
          const hasMatchingLessons = isSearching
            ? cantoLessons.some(
                (l) =>
                  l.title.toLowerCase().includes(query) ||
                  `dia ${l.day_number}`.includes(query) ||
                  `d${l.day_number}`.includes(query) ||
                  l.kind.toLowerCase().includes(query) ||
                  circuitMap.get(l.week_number)?.title.toLowerCase().includes(query) ||
                  circuitMap.get(l.week_number)?.situation.toLowerCase().includes(query),
              )
            : true;

          if (isSearching && !hasMatchingLessons) return null;

          return (
            <div
              key={canto.code}
              className={cn(
                "rounded-xl border transition-all duration-200 overflow-hidden",
                canto.code === selectedCantoSpec?.code
                  ? "border-primary/40 bg-card/90 shadow-xs"
                  : "border-border/60 bg-card/40 hover:border-border",
              )}
            >
              {/* Cabeçalho do Canto */}
              <button
                type="button"
                onClick={() => toggleCanto(canto.code)}
                className="w-full text-left p-3 flex items-center justify-between gap-2.5 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={cn(
                      "font-mono text-xs font-bold px-2 py-0.5 rounded-md shrink-0",
                      canto.code === selectedCantoSpec?.code
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {canto.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-foreground truncate">
                        {canto.title}
                      </span>
                      <Badge variant="neutral" className="text-[10px] py-0 px-1.5 shrink-0">
                        {canto.level}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="tabular-nums">
                        {cantoDone}/{cantoTotal} lições ({cantoPct}%)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-12 hidden sm:block">
                    <Progress value={cantoPct} className="h-1.5" indicatorClassName="bg-primary" />
                  </div>
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform duration-200",
                      isCantoOpen && "rotate-180 text-foreground",
                    )}
                  />
                </div>
              </button>

              {/* Lista de Circuitos do Canto */}
              {isCantoOpen && (
                <div className="border-t border-border/40 bg-background/50 divide-y divide-border/30">
                  {cantoCircuits.map((circuitNum) => {
                    const circuitSpec = circuitMap.get(circuitNum);
                    const circuitLessons = lessonsByCircuit.get(circuitNum) ?? [];
                    const isCircuitOpen =
                      isSearching || (openCircuits[circuitNum] ?? false);

                    const circuitFirstDay = (circuitNum - 1) * DAYS_PER_CIRCUIT + 1;
                    const circuitLastDay = circuitNum * DAYS_PER_CIRCUIT;
                    const isCurrentCircuit =
                      currentDay >= circuitFirstDay && currentDay <= circuitLastDay;
                    const isSelectedCircuit = selectedCircuit === circuitNum;

                    const circuitDone = circuitLessons.filter((l) =>
                      completedSet.has(l.id),
                    ).length;
                    const circuitTotal = circuitLessons.length || DAYS_PER_CIRCUIT;
                    const circuitPct = pct(circuitDone, circuitTotal);

                    // Filtragem por busca
                    const filteredLessons = isSearching
                      ? circuitLessons.filter(
                          (l) =>
                            l.title.toLowerCase().includes(query) ||
                            `dia ${l.day_number}`.includes(query) ||
                            `d${l.day_number}`.includes(query) ||
                            l.kind.toLowerCase().includes(query) ||
                            circuitSpec?.title.toLowerCase().includes(query) ||
                            circuitSpec?.situation.toLowerCase().includes(query),
                        )
                      : circuitLessons;

                    if (isSearching && filteredLessons.length === 0) return null;

                    return (
                      <div
                        key={circuitNum}
                        className={cn(
                          "transition-colors",
                          isSelectedCircuit && "bg-primary/5",
                        )}
                      >
                        {/* Cabeçalho do Circuito */}
                        <button
                          type="button"
                          onClick={() => toggleCircuit(circuitNum)}
                          className={cn(
                            "w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-accent/30 transition-colors",
                            isSelectedCircuit && "font-medium",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">
                                Circuito {circuitNum}
                              </span>
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                · Dias {circuitFirstDay}-{circuitLastDay}
                              </span>
                              {isCurrentCircuit && (
                                <Badge variant="success" className="text-[9px] py-0 px-1">
                                  Atual
                                </Badge>
                              )}
                              {circuitDone === circuitTotal && circuitTotal > 0 && (
                                <span className="text-[10px] text-success font-medium flex items-center gap-0.5">
                                  <CheckCircle2 className="size-3" />
                                </span>
                              )}
                            </div>
                            {circuitSpec?.title && (
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {circuitSpec.title}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                              {circuitDone}/{circuitTotal}
                            </span>
                            <ChevronRight
                              className={cn(
                                "size-3.5 text-muted-foreground transition-transform duration-200",
                                isCircuitOpen && "rotate-90 text-foreground",
                              )}
                            />
                          </div>
                        </button>

                        {/* Dias do Circuito */}
                        {isCircuitOpen && (
                          <div className="pl-3 pr-2 py-2 space-y-3 bg-card/60 border-t border-border/20">
                            {(["A", "B"] as const).map((phase) => {
                              const phaseLessons = (
                                isSearching ? filteredLessons : circuitLessons
                              ).filter((l) => {
                                const role = DAY_RHYTHM[l.circuit_day - 1];
                                return (l.phase ?? role?.phase) === phase;
                              });

                              if (!phaseLessons.length) return null;

                              return (
                                <div key={phase} className="space-y-1">
                                  <div className="px-2 py-0.5 flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                                      {phase === "A"
                                        ? `Aquisição · Dias ${circuitFirstDay}-${circuitFirstDay + 6}`
                                        : `Consolidação · Dias ${circuitFirstDay + 7}-${circuitLastDay}`}
                                    </span>
                                  </div>

                                  <div className="space-y-0.5">
                                    {phaseLessons.map((lesson) => {
                                      const isDaySelected = lesson.day_number === selectedDay;
                                      const isDayCurrent = lesson.day_number === currentDay;
                                      const isDone = completedSet.has(lesson.id);
                                      const isLocked = !lesson.is_published;
                                      const role = DAY_RHYTHM[lesson.circuit_day - 1];
                                      const RoleIcon = ROLE_ICONS[lesson.kind] || Circle;

                                      return (
                                        <Link
                                          key={lesson.id}
                                          href={`/app/curso?day=${lesson.day_number}`}
                                          onClick={() => setMobileOpen(false)}
                                          className={cn(
                                            "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all group",
                                            isDaySelected
                                              ? "bg-primary text-primary-foreground font-medium shadow-xs"
                                              : isDayCurrent && !isDone
                                                ? "bg-primary/10 text-primary font-medium hover:bg-primary/15 border border-primary/30"
                                                : isDone
                                                  ? "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                                                  : isLocked
                                                    ? "opacity-50 pointer-events-none text-muted-foreground"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                                          )}
                                        >
                                          {/* Ícone de status */}
                                          <div className="shrink-0">
                                            {isDone ? (
                                              <CheckCircle2
                                                className={cn(
                                                  "size-3.5",
                                                  isDaySelected
                                                    ? "text-primary-foreground"
                                                    : "text-success",
                                                )}
                                              />
                                            ) : isLocked ? (
                                              <Lock className="size-3.5 opacity-60" />
                                            ) : isDayCurrent ? (
                                              <PlayCircle
                                                className={cn(
                                                  "size-3.5 animate-pulse",
                                                  isDaySelected
                                                    ? "text-primary-foreground"
                                                    : "text-primary",
                                                )}
                                              />
                                            ) : (
                                              <Circle
                                                className={cn(
                                                  "size-3 opacity-40 group-hover:opacity-70",
                                                  isDaySelected && "text-primary-foreground opacity-90",
                                                )}
                                              />
                                            )}
                                          </div>

                                          {/* Número do Dia */}
                                          <span
                                            className={cn(
                                              "font-mono text-[11px] tabular-nums font-semibold shrink-0",
                                              isDaySelected
                                                ? "text-primary-foreground"
                                                : "text-foreground",
                                            )}
                                          >
                                            Dia {lesson.day_number}
                                          </span>

                                          {/* Título da Lição */}
                                          <span className="truncate flex-1 min-w-0">
                                            {lesson.title}
                                          </span>

                                          {/* Badge do Papel / Tipo */}
                                          <span
                                            className={cn(
                                              "text-[9px] px-1.5 py-0.5 rounded shrink-0 font-medium",
                                              isDaySelected
                                                ? "bg-primary-foreground/20 text-primary-foreground"
                                                : "bg-muted/70 text-muted-foreground",
                                            )}
                                          >
                                            {role?.label || KIND_LABELS[lesson.kind] || lesson.kind}
                                          </span>
                                        </Link>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* Botão de Trigger Mobile / Flutuante */}
      <div className="fixed bottom-[calc(4.75rem+var(--safe-bottom))] right-4 z-40 lg:hidden">
        <Button
          onClick={() => setMobileOpen(true)}
          className="shadow-2xl bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-4 py-2.5 flex items-center gap-2 text-xs font-semibold border border-primary-foreground/20 active:scale-95 transition-all"
        >
          <Layers className="size-4" />
          <span>Conteúdo do Curso</span>
          <Badge variant="neutral" className="bg-black/40 text-white text-[10px] ml-1">
            {totalCompleted}/{totalLessons}
          </Badge>
        </Button>
      </div>

      {/* Gaveta Mobile (Drawer / Slide-over) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex justify-end">
          <button
            type="button"
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu de conteúdo"
          />

          <div className="relative w-full max-w-sm bg-card h-full flex flex-col border-l border-border shadow-2xl z-10 animate-in-up pb-[var(--safe-bottom)]">
            {/* Header da gaveta mobile com recuo seguro da barra de status / notch / bateria */}
            <div className="px-4 pb-3 pt-[calc(1.25rem+var(--safe-top))] border-b border-border flex items-center justify-between shrink-0 bg-card">
              <div className="flex items-center gap-2 min-w-0">
                <div className="bg-primary/15 text-primary p-2 rounded-lg shrink-0">
                  <Compass className="size-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-foreground truncate">Conteúdo do Curso</h2>
                  <p className="text-[11px] text-muted-foreground truncate">
                    4 Cantos · {totalCompleted} de {totalLessons} concluídas ({totalProgressPct}%)
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                className="size-9 rounded-full hover:bg-accent shrink-0"
                aria-label="Fechar menu de conteúdo"
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Busca Mobile */}
            <div className="p-3 border-b border-border/60 bg-muted/20">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar dia, circuito ou assunto…"
                  className="w-full bg-background border border-border/80 rounded-lg pl-8 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Lista rolável mobile */}
            <div className="flex-1 overflow-y-auto p-3">
              {renderCurriculumTree()}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Desktop (Menu Lateral Direito) */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-l border-border bg-card/90 backdrop-blur-md transition-all duration-300 shrink-0 sticky top-[calc(4rem+var(--safe-top))] h-[calc(100vh-4rem-var(--safe-top))] z-20 self-start",
          isCollapsed ? "w-14" : "w-80 xl:w-96",
        )}
      >
        {isCollapsed ? (
          /* Estado Colapsado no Desktop */
          <div className="flex flex-col items-center py-4 gap-4 h-full">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(false)}
              title="Expandir menu de conteúdo"
              className="size-9 text-muted-foreground hover:text-foreground"
            >
              <PanelRightOpen className="size-4" />
            </Button>

            <div className="flex-1 flex flex-col items-center justify-center gap-6 text-muted-foreground">
              <div className="[writing-mode:vertical-rl] rotate-180 text-xs font-semibold tracking-wider uppercase text-muted-foreground/80 flex items-center gap-2">
                <Compass className="size-3.5 rotate-90" />
                <span>Conteúdo do Curso</span>
              </div>

              <div className="text-center font-mono text-[10px] text-primary font-bold">
                {totalProgressPct}%
              </div>
            </div>
          </div>
        ) : (
          /* Estado Aberto / Completo no Desktop */
          <div className="flex flex-col h-full min-h-0">
            {/* Header da Sidebar */}
            <div className="p-4 border-b border-border/80 bg-card/80 shrink-0">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/15 text-primary p-1.5 rounded-lg">
                    <Compass className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight text-foreground">
                      Conteúdo do Curso
                    </h2>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Inglês Destravado: 4 Cantos
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsCollapsed(true)}
                  title="Recolher painel"
                  className="size-7 text-muted-foreground hover:text-foreground"
                >
                  <PanelRightClose className="size-4" />
                </Button>
              </div>

              {/* Barra de Progresso Global do Curso */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground text-[11px]">Progresso geral</span>
                  <span className="font-semibold text-foreground text-[11px] tabular-nums">
                    {totalCompleted}/{totalLessons} ({totalProgressPct}%)
                  </span>
                </div>
                <Progress
                  value={totalProgressPct}
                  className="h-1.5 bg-muted"
                  indicatorClassName="bg-primary"
                />
              </div>

              {/* Campo de Busca Rápida */}
              <div className="mt-3 relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar dia, circuito ou assunto…"
                  className="w-full bg-background/80 border border-border/80 rounded-lg pl-8 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-hidden focus:ring-1 focus:ring-primary transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Lista rolável do currículo */}
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
              {renderCurriculumTree()}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
