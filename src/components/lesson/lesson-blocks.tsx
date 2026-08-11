import { Globe, Info, Lightbulb, TriangleAlert } from "lucide-react";
import * as React from "react";

import { AudioPlayer } from "@/components/audio/audio-player";
import { PronunciationLine } from "@/components/lesson/pronunciation-line";
import { cn } from "@/lib/utils";
import type { LessonBlock } from "@/lib/types/database";

const CALLOUT_STYLE = {
  tip: { icon: Lightbulb, className: "border-primary/25 bg-primary/6", accent: "text-primary" },
  warning: {
    icon: TriangleAlert,
    className: "border-warning/30 bg-warning/8",
    accent: "text-warning",
  },
  culture: { icon: Globe, className: "border-chart-2/30 bg-chart-2/8", accent: "text-chart-2" },
} as const;

/**
 * Renderiza markdown leve: **negrito**, *itálico*, `código`, ~~riscado~~ e
 * tabelas em pipe. Suficiente para o conteúdo das lições e sem dependência
 * externa de parser.
 */
function InlineMarkdown({ text }: { text: string }) {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|~~[^~]+~~)/g);

  return (
    <>
      {tokens.map((token, i) => {
        if (token.startsWith("**") && token.endsWith("**")) {
          return <strong key={i}>{token.slice(2, -2)}</strong>;
        }
        if (token.startsWith("~~") && token.endsWith("~~")) {
          return (
            <span key={i} className="text-destructive line-through">
              {token.slice(2, -2)}
            </span>
          );
        }
        if (token.startsWith("`") && token.endsWith("`")) {
          return (
            <code key={i} className="bg-muted rounded px-1.5 py-0.5 font-mono text-[0.85em]">
              {token.slice(1, -1)}
            </code>
          );
        }
        if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
          return <em key={i}>{token.slice(1, -1)}</em>;
        }
        return <React.Fragment key={i}>{token}</React.Fragment>;
      })}
    </>
  );
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const output: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Tabela em pipe
    if (line.trim().startsWith("|") && lines[i + 1]?.includes("---")) {
      const header = line.split("|").slice(1, -1).map((c) => c.trim());
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim()));
        i++;
      }
      output.push(
        <div key={`t${i}`} className="my-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                {header.map((h, hi) => (
                  <th key={hi} className="px-3 py-2 text-left font-medium">
                    <InlineMarkdown text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-t">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2">
                      <InlineMarkdown text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Lista numerada ou com marcador
    if (/^\s*(\d+\.|[-•])\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*(\d+\.|[-•])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*(\d+\.|[-•])\s+/, ""));
        i++;
      }
      const ListTag = ordered ? "ol" : "ul";
      output.push(
        <ListTag
          key={`l${i}`}
          className={cn("my-3 space-y-1.5 pl-5", ordered ? "list-decimal" : "list-disc")}
        >
          {items.map((item, ii) => (
            <li key={ii} className="leading-relaxed">
              <InlineMarkdown text={item} />
            </li>
          ))}
        </ListTag>,
      );
      continue;
    }

    if (line.trim()) {
      output.push(
        <p key={`p${i}`} className="my-2.5 leading-relaxed">
          <InlineMarkdown text={line} />
        </p>,
      );
    }
    i++;
  }

  return <div className={cn("text-[0.95rem]", className)}>{output}</div>;
}

export function LessonBlockView({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case "text":
      return (
        <section>
          {block.title ? <h3 className="mb-2 text-lg font-semibold">{block.title}</h3> : null}
          <RichText text={block.body} />
        </section>
      );

    case "callout": {
      const style = CALLOUT_STYLE[block.variant ?? "tip"];
      const Icon = style.icon ?? Info;
      return (
        <aside className={cn("rounded-xl border p-5", style.className)}>
          <div className={cn("flex items-center gap-2 font-semibold", style.accent)}>
            <Icon className="size-4 shrink-0" />
            {block.title ?? "Atenção"}
          </div>
          <RichText text={block.body} className="mt-2" />
        </aside>
      );
    }

    case "dialogue":
      return (
        <section>
          {block.title ? <h3 className="mb-3 text-lg font-semibold">{block.title}</h3> : null}
          <div className="space-y-2.5">
            {block.lines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3 rounded-xl px-4 py-3",
                  i % 2 === 0 ? "bg-muted/55" : "bg-primary/6",
                )}
              >
                <span className="text-muted-foreground w-16 shrink-0 text-xs font-semibold tracking-wide uppercase">
                  {line.speaker}
                </span>
                <div className="min-w-0">
                  <p className="text-[0.95rem] font-medium">{line.en}</p>
                  <PronunciationLine text={line.en} />
                  {line.pt ? (
                    <p className="text-muted-foreground mt-0.5 text-sm">{line.pt}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      );

    case "examples":
      return (
        <section>
          {block.title ? <h3 className="mb-3 text-lg font-semibold">{block.title}</h3> : null}
          <div className="divide-y rounded-xl border">
            {block.items.map((item, i) => (
              <div key={i} className="px-4 py-3">
                <p className="font-medium">{item.en}</p>
                <PronunciationLine text={item.en} />
                <p className="text-muted-foreground mt-0.5 text-sm">{item.pt}</p>
                {item.note ? (
                  <p className="text-muted-foreground/85 mt-1 text-xs italic">{item.note}</p>
                ) : null}
                {/*
                  Sem este player a forma era um exercicio de LEITURA, e o curso
                  inteiro se apoia em ouvir antes de ler. O aluno lia "Did you
                  catch that?" e pronunciava com fonema portugues sobre grafia
                  inglesa — que e o defeito que a espinha de fonologia existe
                  para desfazer, criado aqui pela ausencia de um botao.

                  O arquivo ja existia: eram 5.816 audios gerados que nenhuma
                  tela pedia.
                */}
                <AudioPlayer text={item.en} mode="single" label="Ouvir" compact className="mt-2" />
              </div>
            ))}
          </div>
        </section>
      );

    case "drill":
      return (
        <section className="bg-muted/40 rounded-xl border p-5">
          {block.title ? <h3 className="mb-1.5 text-lg font-semibold">{block.title}</h3> : null}
          <p className="text-muted-foreground text-sm">{block.instruction}</p>
          <ul className="mt-3 space-y-2">
            {block.items.map((item, i) => (
              <li key={i} className="bg-card rounded-lg px-3.5 py-2.5 text-sm">
                <InlineMarkdown text={item} />
              </li>
            ))}
          </ul>
        </section>
      );

    case "practice":
      return (
        <section className="border-primary/25 bg-primary/5 rounded-xl border p-5">
          <h3 className="text-primary mb-1.5 text-lg font-semibold">
            {block.title ?? "Fale em voz alta"}
          </h3>
          <p className="text-muted-foreground text-sm">{block.instruction}</p>
          <ol className="mt-3 space-y-2">
            {block.prompts.map((prompt, i) => (
              <li key={i} className="bg-card flex gap-2.5 rounded-lg px-3.5 py-2.5 text-sm">
                <span className="bg-primary/12 text-primary grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{prompt}</span>
              </li>
            ))}
          </ol>
        </section>
      );

    default:
      return null;
  }
}
