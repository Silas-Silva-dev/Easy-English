import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Flame,
  Mic,
  Repeat,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSessionContext } from "@/lib/auth/guards";
import { CANTOS, CIRCUITS, type CantoSpec } from "@content/curriculum";

const FEATURES = [
  {
    icon: Blocks,
    title: "Blocos prontos, não regras",
    body: "Você não monta frase a partir de tabela de conjugação — ninguém faz isso em tempo real. Decora o bloco inteiro (\"Can I have a coffee, please?\") e troca as peças. É assim que o cérebro adulto realmente absorve.",
  },
  {
    icon: Mic,
    title: "Tutora de IA que ouve você",
    body: "Grave sua fala e receba, em segundos, a transcrição literal do que você disse, as correções de pronúncia em IPA e a instrução articulatória para acertar.",
  },
  {
    icon: BrainCircuit,
    title: "Especialista em erro de brasileiro",
    body: "O TH que vira 'f', o 'i' que aparece no fim das palavras, o -ed pronunciado como sílaba extra. A tutora conhece cada armadilha do português.",
  },
  {
    icon: Repeat,
    title: "Revisão espaçada de verdade",
    body: "Cada bloco tem uma data própria de retorno, calculada pelo seu desempenho — e só conta como dominado depois que você o falou em voz alta.",
  },
  {
    icon: CalendarDays,
    title: "Dia 1, Dia 2, Dia 3 — no seu ritmo",
    body: "Cronograma de 728 dias fechado, e solto do calendário: não existe lição de segunda-feira. Você abre o app, faz o próximo dia e fecha. A consistência faz o resto.",
  },
  {
    icon: Flame,
    title: "Ofensiva e progresso visível",
    body: "Sequência de dias, minutos acumulados e evolução das notas de pronúncia, fluência, gramática e vocabulário ao longo do curso.",
  },
  {
    icon: BookOpen,
    title: "Material indexado e pesquisável",
    body: "Toda dúvida é respondida com base no material do curso, com citação da lição exata em que aquilo foi ensinado.",
  },
  {
    icon: ShieldCheck,
    title: "Contas verificadas e seguras",
    body: "Verificação por e-mail, papéis separados para aluno, instrutor e administrador, e isolamento de dados garantido no banco.",
  },
];

const STEPS = [
  { n: "01", title: "Faça o dia de hoje", body: "Abra a próxima lição: imersão, blocos, escuta, produção ou revisão. Cada dia do circuito tem um papel fixo, então você nunca decide o que estudar." },
  { n: "02", title: "Grave sua fala", body: "Toda lição termina com um desafio de fala. Você grava direto no navegador, sem instalar nada." },
  { n: "03", title: "Receba a correção", body: "A tutora devolve nota por critério, correções comentadas em português e o que treinar amanhã." },
];

export default async function LandingPage() {
  const session = await getSessionContext();

  return (
    <div className="relative min-h-screen">
      {/* ----------------------------------------------------------- Header */}
      <header className="glass sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
            <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg">
              <Waves className="size-4" />
            </span>
            <span className="text-[1.05rem] tracking-tight">InglishEasy</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm md:flex">
            <a href="#recursos" className="text-muted-foreground hover:text-foreground transition-colors">
              Recursos
            </a>
            <a href="#curso" className="text-muted-foreground hover:text-foreground transition-colors">
              O curso
            </a>
            <a href="#como-funciona" className="text-muted-foreground hover:text-foreground transition-colors">
              Como funciona
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {session ? (
              <Button asChild size="sm" className="h-10 sm:h-8">
                <Link href="/app">
                  Meu painel <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/login">Entrar</Link>
                </Button>
                {/* h-10 no celular: é o único botão de conversão visível ali,
                    já que "Entrar" some abaixo de sm. */}
                <Button asChild size="sm" className="h-10 sm:h-8">
                  <Link href="/cadastro">Começar grátis</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 -z-10" />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[440px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)]" />

        <div className="mx-auto max-w-6xl px-4 pt-20 pb-24 sm:px-6 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="animate-fade mb-6 gap-1.5 px-3 py-1">
              <Sparkles className="size-3" />
              Tutora de IA treinada para corrigir brasileiros
            </Badge>

            <h1 className="animate-in-up text-4xl leading-[1.08] font-bold sm:text-6xl">
              <span className="text-gradient">Pare de estudar inglês.</span>
              <br />
              Comece a <span className="text-primary">falar</span> inglês.
            </h1>

            <p className="text-muted-foreground animate-in-up mx-auto mt-6 max-w-2xl text-lg leading-relaxed">
              Um ano de curso focado em conversação, com 15 minutos de estudo por dia. Você grava
              sua fala, e uma tutora de IA especialista em fonética devolve a correção exata —
              incluindo os erros que só quem fala português comete.
            </p>

            <div className="animate-in-up mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="xl" variant="gradient">
                <Link href="/cadastro">
                  Criar minha conta grátis <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline">
                <Link href="#curso">Ver o programa completo</Link>
              </Button>
            </div>

            <dl className="text-muted-foreground mt-14 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {[
                { k: "728", v: "dias de curso" },
                { k: "20–100 min", v: "por dia, você escolhe" },
                { k: "52", v: "circuitos" },
                { k: "A1→B2", v: "níveis CEFR" },
              ].map((s) => (
                <div key={s.v}>
                  <dt className="text-foreground text-2xl font-semibold tabular-nums">{s.k}</dt>
                  <dd className="mt-0.5 text-xs tracking-wide uppercase">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Recursos */}
      <section id="recursos" className="border-t py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-primary text-xs font-semibold tracking-widest uppercase">Recursos</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Tudo que falta nos cursos que você já tentou
            </h2>
            <p className="text-muted-foreground mt-4 text-base">
              O problema nunca foi falta de conteúdo. Foi falta de alguém ouvindo você falar e
              dizendo, com precisão, o que corrigir.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card card-hover rounded-xl border p-6">
                <div className="bg-primary/10 text-primary mb-4 grid size-11 place-items-center rounded-lg">
                  <f.icon className="size-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Como funciona */}
      <section id="como-funciona" className="bg-muted/35 border-t py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-primary text-xs font-semibold tracking-widest uppercase">
              Como funciona
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Três passos, todo dia</h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <div className="text-primary/25 font-display text-5xl font-extrabold tabular-nums">
                  {s.n}
                </div>
                <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Curso */}
      <section id="curso" className="border-t py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-primary text-xs font-semibold tracking-widest uppercase">O programa</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Inglês Destravado — 4 Cantos
            </h2>
            <p className="text-muted-foreground mt-4 text-base">
              4 Cantos, 52 circuitos, 728 dias. Cada circuito é uma{" "}
              <strong className="text-foreground">situação real</strong> — pedir um café, resolver
              um problema no hotel, participar de uma reunião — com 7 blocos de fala prontos que
              você memoriza inteiros e sai usando.
            </p>
          </div>

          <ol className="mt-14 grid gap-4 md:grid-cols-2">
            {CANTOS.map((canto: CantoSpec) => (
              <li key={canto.code} className="bg-card card-hover rounded-xl border p-6">
                <div className="flex items-center gap-2">
                  <span className="text-primary font-mono text-xs font-semibold">{canto.code}</span>
                  <Badge variant="neutral" className="text-[10px]">
                    {canto.level}
                  </Badge>
                  <Badge variant="neutral" className="text-[10px]">
                    {canto.weekEnd - canto.weekStart + 1} circuitos
                  </Badge>
                </div>
                <h3 className="mt-2.5 text-lg font-semibold">{canto.title}</h3>
                <p className="text-muted-foreground mt-0.5 text-xs">{canto.subtitle}</p>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  {canto.description}
                </p>
                <ul className="mt-4 space-y-1.5">
                  {canto.canDo.slice(0, 3).map((c: string) => (
                    <li key={c} className="text-muted-foreground flex gap-2 text-xs">
                      <BadgeCheck className="text-success mt-0.5 size-3.5 shrink-0" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          {/* Amostra de circuitos — prova concreta de que não é curso de gramática */}
          <div className="mt-12">
            <p className="text-muted-foreground mb-4 text-xs font-medium tracking-wide uppercase">
              Alguns dos 52 circuitos
            </p>
            <div className="flex flex-wrap gap-2">
              {[1, 4, 12, 17, 24, 31, 34, 40, 42, 45, 47, 52].map((n) => {
                const circuit = CIRCUITS.find((c) => c.number === n);
                if (!circuit) return null;
                return (
                  <span
                    key={n}
                    className="bg-muted text-muted-foreground rounded-full px-3.5 py-1.5 text-xs"
                  >
                    <span className="text-primary font-mono">{n}</span> · {circuit.title}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- CTA */}
      <section className="border-t py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Daqui a um ano você vai desejar ter começado hoje
          </h2>
          <p className="text-muted-foreground mt-4 text-base">
            Quinze minutos. É menos tempo do que você gasta rolando o feed antes de dormir.
          </p>
          <Button asChild size="xl" variant="gradient" className="mt-8">
            <Link href="/cadastro">
              Começar agora <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t py-10">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Waves className="size-4" />
            <span>InglishEasy</span>
          </div>
          <p>© {new Date().getFullYear()} InglishEasy. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
