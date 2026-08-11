import { ChevronRight, Info } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import type { GateComponentResult, GateComponentSpec } from "@/lib/types/database";
import { cn, formatRelative, pct } from "@/lib/utils";

/**
 * O portão da quinzena, do jeito que o aluno precisa ler.
 *
 * ===========================================================================
 * POR QUE ESTA TELA EXISTE
 * ===========================================================================
 * "Passou o circuito 14" era uma frase do briefing: o critério estava escrito
 * na prosa de `rampa.json`, o motor sabia contar (`evaluate_circuit_gate`) e
 * nenhuma tela mostrava o resultado. O aluno não via por que passou nem o que
 * faltava — e o que falta é a única informação acionável que o portão produz.
 *
 * Cada componente vem do banco com o MEDIDO ao lado do EXIGIDO, e é isso que
 * permite dizer "faltam 2 dos 14 dias com input" em vez de "você não passou".
 *
 * ===========================================================================
 * O RÓTULO E O CRITÉRIO VÊM DE FONTES DIFERENTES
 * ===========================================================================
 * `circuit_gate_status.components` guarda só `{tipo, exigido, medido, de,
 * passou}`: o número do circuito atrasado, quantas revisões certas cada bloco
 * precisa e se o baralho é o núcleo ficam em `circuit_gates.components`, o
 * critério semeado. Sem casar os dois, "Blocos do circuito N" não teria o N e
 * a linha do acervo não diria o que ela conta.
 */

/**
 * Os sete componentes, em português.
 *
 * `tipo` é o vocabulário do parser e do banco; nada disso aparece para o
 * aluno, que lê "Dias com escuta registrada" e não `input`.
 */
const ROTULOS: Record<GateComponentSpec["tipo"], string> = {
  input: "Dias com escuta registrada",
  licao: "Dias com a lição concluída",
  fila: "Dias com a fila zerada",
  novos: "Blocos deste circuito",
  acumulado: "Acervo acumulado",
  defasado: "Blocos do circuito",
  nota: "Nota de fala",
};

/** Nota é decimal e o aluno é brasileiro; o resto é contagem. */
function formatar(valor: number, tipo: GateComponentSpec["tipo"]): string {
  return tipo === "nota" ? valor.toFixed(1).replace(".", ",") : String(Math.round(valor));
}

function rotuloDe(tipo: GateComponentSpec["tipo"], spec: GateComponentSpec | undefined): string {
  if (tipo === "defasado") {
    return spec?.circuito ? `Blocos do circuito ${spec.circuito}` : ROTULOS.defasado;
  }
  return ROTULOS[tipo];
}

/**
 * A frase que diz o que a linha conta.
 *
 * Sem ela, "Blocos deste circuito: 3 de 5" não informa nada: o aluno não sabe
 * que só entram os blocos que já voltaram duas vezes certas na revisão E foram
 * falados em voz alta, então não sabe o que fazer para mover o número.
 */
function detalheDe(
  tipo: GateComponentSpec["tipo"],
  spec: GateComponentSpec | undefined,
  de: number | null,
): string | null {
  const total = spec?.de ?? de ?? null;

  switch (tipo) {
    case "input":
    case "licao":
    case "fila":
      return total ? `O circuito tem ${total} dias.` : null;

    case "novos":
    case "acumulado":
    case "defasado": {
      const partes: string[] = [];
      const repeticoes = spec?.repeticoes ?? 0;
      if (repeticoes > 0) {
        partes.push(`${repeticoes} ${repeticoes === 1 ? "revisão certa" : "revisões certas"}`);
      }
      const faladas = spec?.faladas ?? 0;
      if (faladas > 0) {
        partes.push(`${faladas} ${faladas === 1 ? "fala" : "falas"} em voz alta`);
      }

      const baralho =
        spec?.escopo === "nucleo"
          ? "Contam só os blocos do núcleo"
          : "Contam os blocos";
      const exigencia = partes.length ? ` com ${partes.join(" e ")}` : "";
      const universo = total ? ` Ao todo são ${total}.` : "";

      return `${baralho}${exigencia}.${universo}`;
    }

    case "nota":
      // A consulta usa `max`, não média: uma gravação ruim no dia 2 não desfaz
      // uma boa no dia 11, e o aluno precisa saber disso antes de evitar gravar.
      return "Vale a melhor gravação do circuito, não a média.";

    default:
      return null;
  }
}

/** Quantos componentes já estão cumpridos. */
function cumpridos(componentes: GateComponentResult[]): number {
  return componentes.filter((c) => c.passou).length;
}

export function PainelDoPortao({
  circuito,
  trilha,
  passou,
  avaliadoEm,
  especificacao,
  avaliacao,
  prosa,
}: {
  circuito: number;
  /** Rótulo da trilha ("Essencial", "Completo", "Intensivo"). */
  trilha: string;
  passou: boolean;
  avaliadoEm: string;
  /** O critério semeado: traz o circuito atrasado, o baralho e as repetições. */
  especificacao: GateComponentSpec[];
  /** A avaliação deste aluno: o medido ao lado do exigido. */
  avaliacao: GateComponentResult[];
  /** A prosa do portão. É escrita para o aluno e carrega a tarefa falada. */
  prosa: string;
}) {
  const porTipo = new Map(especificacao.map((spec) => [spec.tipo, spec]));
  const ok = cumpridos(avaliacao);

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------ O que o portão diz */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>Circuito {circuito} · trilha {trilha}</CardTitle>
              <CardDescription>
                {ok} de {avaliacao.length}{" "}
                {avaliacao.length === 1 ? "critério cumprido" : "critérios cumpridos"} ·
                conferido {formatRelative(avaliadoEm)}
              </CardDescription>
            </div>
            <Badge variant={passou ? "success" : "warning"} className="shrink-0">
              {passou ? "Você passou" : "Ainda falta"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          {avaliacao.length ? (
            <ul className="space-y-2.5">
              {avaliacao.map((componente) => {
                const spec = porTipo.get(componente.tipo);
                const rotulo = rotuloDe(componente.tipo, spec);
                const detalhe = detalheDe(componente.tipo, spec, componente.de);
                const falta = Math.max(0, componente.exigido - componente.medido);

                return (
                  <li key={componente.tipo} className="rounded-lg border p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm font-medium">{rotulo}</p>
                      <Badge
                        variant={componente.passou ? "success" : "neutral"}
                        className="shrink-0"
                      >
                        {componente.passou
                          ? "cumprido"
                          : `faltam ${formatar(falta, componente.tipo)}`}
                      </Badge>
                    </div>

                    <div className="mt-2.5 flex items-center gap-3">
                      <Progress
                        value={pct(componente.medido, componente.exigido)}
                        className="h-1.5 flex-1"
                        indicatorClassName={componente.passou ? "bg-success" : "bg-warning"}
                      />
                      <span
                        className={cn(
                          "shrink-0 text-xs tabular-nums",
                          componente.passou ? "text-success" : "text-muted-foreground",
                        )}
                      >
                        {formatar(componente.medido, componente.tipo)} de{" "}
                        {formatar(componente.exigido, componente.tipo)}
                      </span>
                    </div>

                    {detalhe ? (
                      <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                        {detalhe}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="Este portão não tem componente medido"
              description="O critério deste circuito não chegou ao banco. Ele volta a aparecer assim que o curso for semeado de novo."
              className="border-0"
            />
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------- A prosa do portão */}
      {prosa ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">O que a quinzena pede</CardTitle>
            <CardDescription>
              A tarefa falada não vira número: ela está escrita aqui, e nenhuma consulta a avalia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{prosa}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* ------------------------- O portão é diagnóstico, não é fechadura */}
      <div className="bg-muted/50 border-border/70 flex gap-3 rounded-xl border p-4">
        <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">O portão não tranca nada.</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Quem não passa não perde acesso ao circuito seguinte. O que muda é a quinzena
            seguinte, que repete o que ficou para trás dentro do material novo. Isto aqui existe
            para você ver o que falta, não para segurar conteúdo que você já pagou.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * O atalho que leva à tela do portão, com a última avaliação que existir.
 *
 * Mora na página do Canto porque é de lá que o aluno olha a quinzena. Ele lê
 * `circuit_gate_status` (a última avaliação gravada) em vez de chamar
 * `evaluate_circuit_gate`: a avaliação ESCREVE uma linha e roda meia dúzia de
 * contagens, e pagar isso em toda visita ao cronograma seria caro sem ninguém
 * ter pedido o diagnóstico.
 */
export function AtalhoDoPortao({
  circuito,
  status,
}: {
  circuito: number;
  status: { passed: boolean; evaluated_at: string; components: GateComponentResult[] } | null;
}) {
  const total = status?.components.length ?? 0;
  const ok = status ? cumpridos(status.components) : 0;

  return (
    <Link
      href={`/app/portao/${circuito}`}
      className="bg-card hover:bg-accent shadow-xs flex items-center gap-3 rounded-xl border p-4 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Portão do circuito {circuito}</span>
          {status ? (
            <Badge variant={status.passed ? "success" : "neutral"}>
              {status.passed ? "passou" : `${ok} de ${total}`}
            </Badge>
          ) : (
            <Badge variant="neutral">ainda não conferido</Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {status
            ? `Veja o que falta. Conferido ${formatRelative(status.evaluated_at)}.`
            : "Veja o que a quinzena pede e o quanto você já cumpriu."}
        </p>
      </div>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </Link>
  );
}
