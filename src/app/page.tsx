import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Flame,
  Globe,
  Headphones,
  Layers,
  Lock,
  MessageSquare,
  Mic,
  PlayCircle,
  Radio,
  Repeat,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  Volume2,
  Waves,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionContext } from "@/lib/auth/guards";
import { CANTOS, CIRCUITS, type CantoSpec } from "@content/curriculum";

export const metadata: Metadata = {
  title: "InglishEasy: Plataforma Completa de Inglês em 4 Cantos com IA",
  description:
    "Aprenda a falar inglês fluente no seu ritmo com a Professora Emma (IA). 4 Cantos, 52 circuitos, 728 dias de lições práticas com análise de pronúncia em áudio e conversa ao vivo.",
};

const CANTOS_DESCRIPTIONS = [
  {
    code: "C1",
    title: "Canto 1: Destravar",
    level: "A1 · Iniciante",
    circuits: "Circuitos 1 ao 13 (Dias 1 a 182)",
    summary:
      "Construa uma fundação sólida de fala sem travar. Memorize blocos práticos para situações do dia a dia, imersão em ritmo real e primeiros diálogos com a tutora.",
    canDo: [
      "Apresentar-se e fazer perguntas básicas do dia a dia",
      "Pedir informações, comida em restaurantes e direções",
      "Compreender a estrutura de frases curtas sem traduzir",
    ],
  },
  {
    code: "C2",
    title: "Canto 2: Contar",
    level: "A2 · Básico Avançado",
    circuits: "Circuitos 14 ao 26 (Dias 183 a 364)",
    summary:
      "Domine o passado simples e narrativas de experiências pessoais. Conte histórias, descreva viagens, hábitos e atividades passadas com naturalidade.",
    canDo: [
      "Contar o que fez no fim de semana, férias ou no trabalho",
      "Conectar ideias usando conectivos de tempo e causa",
      "Interagir em conversas cotidianas de forma autônoma",
    ],
  },
  {
    code: "C3",
    title: "Canto 3: Resolver",
    level: "B1 · Intermediário",
    circuits: "Circuitos 27 ao 39 (Dias 365 a 546)",
    summary:
      "Enfrante imprevistos, expresse opiniões fortes e resolva problemas em viagens, trabalho e situações acadêmicas com confiança e riqueza de vocabulário.",
    canDo: [
      "Resolver contratempos em hotéis, aeroportos e compras",
      "Dar sua opinião sobre assuntos profissionais e atuais",
      "Manter conversas prolongadas com falantes de inglês",
    ],
  },
  {
    code: "C4",
    title: "Canto 4: Soar natural",
    level: "B2 · Intermediário Avançado",
    circuits: "Circuitos 40 ao 52 (Dias 547 a 728)",
    summary:
      "Refine ritmo, entonação, colocações verbais e phrasal verbs. Elimine os vícios fonéticos brasileiros e soe fluido e natural em qualquer contexto.",
    canDo: [
      "Debater tópicos complexos com espontaneidade",
      "Usar colocações e expressões idiomáticas naturais",
      "Conversar ao vivo em velocidade nativa sem pausas",
    ],
  },
];

const METHOD_STEPS = [
  {
    step: "01",
    tag: "Etapa de Aquisição (Dias 1 a 7)",
    title: "Imersão, Blocos & Quiz",
    body: "Você ouve o diálogo em velocidade real antes de ler o texto. Aprende blocos prontos (\"Can I get a...\") em vez de decorar tabelas de gramática e testa a retenção com quizzes rápidos.",
  },
  {
    step: "02",
    tag: "Etapa de Consolidação (Dias 8 a 14)",
    title: "Desafio de Fala & Áudio Salvo",
    body: "Grave sua resposta em inglês diretamente na plataforma. Seu áudio fica salvo na sua conta para você acompanhar sua evolução de fala mês a mês.",
  },
  {
    step: "03",
    tag: "Feedback da Tutora Emma",
    title: "Análise por IA & Orientações em Áudio",
    body: "A tutora de IA analisa seu áudio em segundos, gera notas de pronúncia (com IPA), correções comentadas e responde em áudio com orientações faladas.",
  },
  {
    step: "04",
    tag: "Conversa ao Vivo",
    title: "Prática de Voz em Tempo Real",
    body: "Entrar na sala de voz com a Emma para simular situações reais sem roteiro. Ela fala no seu nível e ajuda você a destravar o improviso.",
  },
];

const FAQS = [
  {
    q: "Preciso saber inglês para começar no Canto 1?",
    a: "Não! O Canto 1 (Destravar) é desenhado desde o nível A1 inicial. O curso utiliza o método de blocos de fala e imersão progressiva, ideal tanto para quem está do zero quanto para quem tem o inglês travado na mente.",
  },
  {
    q: "Quanto tempo preciso dedicar por dia?",
    a: "Apenas 15 a 20 minutos diários! As lições são objetivas para garantir constância. Cada dia tem um papel fixo, permitindo que você estude sem perda de tempo.",
  },
  {
    q: "Como a tutora de IA Emma corrige a minha pronúncia?",
    a: "Ao gravar seu áudio no Desafio de Fala, a Emma faz a transcrição literal, detecta erros típicos de brasileiros (como o TH, a vogal epentética no fim das palavras e a sílaba extra do -ED), exibe a pronúncia alvo em IPA e gera orientações faladas em áudio.",
  },
  {
    q: "Meus áudios gravados ficam salvos?",
    a: "Sim! Todos os áudios gravados nos desafios de fala ficam salvos na sua plataforma privada, permitindo que você reouça suas práticas e acompanhe sua evolução de fluência ao longo dos meses.",
  },
  {
    q: "Como funciona a divisão dos 4 Cantos?",
    a: "O curso é dividido nos 4 Cantos: C1 Destravar (A1), C2 Contar (A2), C3 Resolver (B1) e C4 Soar natural (B2). Você tem acesso a cada um diretamente no menu lateral com o seu percentual de conclusão.",
  },
];

export default async function LandingPage() {
  const session = await getSessionContext();

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* ----------------------------------------------------------- Header */}
      <header className="glass fixed top-0 inset-x-0 z-50 border-b">
        <div className="mx-auto flex h-[calc(4rem+var(--safe-top))] max-w-6xl items-center justify-between px-4 pt-[var(--safe-top)] sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold transition-opacity hover:opacity-90">
            <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-xl shadow-md shadow-primary/20">
              <Waves className="size-4.5" />
            </span>
            <span className="text-[1.1rem] tracking-tight font-bold">InglishEasy</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <a href="#cantos" className="text-muted-foreground hover:text-foreground transition-colors">
              Os 4 Cantos
            </a>
            <a href="#metodologia" className="text-muted-foreground hover:text-foreground transition-colors">
              Metodologia
            </a>
            <a href="#tutora" className="text-muted-foreground hover:text-foreground transition-colors">
              Tutora em Áudio
            </a>
            <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">
              Perguntas
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            {session ? (
              <Button asChild size="sm" variant="gradient" className="h-10 px-4 sm:h-9">
                <Link href="/app">
                  Meu painel <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/login">Entrar</Link>
                </Button>
                <Button asChild size="sm" variant="gradient" className="h-10 px-4 sm:h-9">
                  <Link href="/cadastro">Começar grátis</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden pt-[calc(5rem+var(--safe-top))] pb-20 sm:pt-[calc(6rem+var(--safe-top))] sm:pb-28">
        <div className="bg-grid pointer-events-none absolute inset-0 -z-10 opacity-70" />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[500px] bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent)]" />

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5 text-xs font-semibold text-primary animate-fade mb-6">
              <Sparkles className="size-3.5" />
              Curso Completo em 4 Cantos com Tutora de IA em Áudio
            </div>

            <h1 className="animate-in-up text-4xl leading-[1.08] font-extrabold sm:text-6xl tracking-tight">
              <span className="text-gradient">Pare de travar no inglês.</span>
              <br />
              Comece a <span className="text-primary">falar com confiança</span>.
            </h1>

            <p className="text-muted-foreground animate-in-up mx-auto mt-6 max-w-2xl text-base sm:text-lg leading-relaxed font-normal">
              Domine o inglês em <strong>4 Cantos</strong> com 15 minutos por dia. Grave sua fala nos desafios, salve seus áudios na plataforma e receba correções da <strong>Professora Emma (IA)</strong> em texto e áudio.
            </p>

            <div className="animate-in-up mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="xl" variant="gradient" className="w-full sm:w-auto shadow-lg shadow-primary/20">
                <Link href="/cadastro">
                  Criar conta grátis <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="w-full sm:w-auto">
                <Link href="#cantos">Ver os 4 Cantos do Curso</Link>
              </Button>
            </div>

            {/* Destaques rápidos */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="text-success size-4" /> Áudios de fala salvos na conta
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="text-success size-4" /> Respostas da tutora em áudio
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="text-success size-4" /> 728 dias no seu ritmo
              </span>
            </div>

            {/* Métricas do curso */}
            <div className="mt-14 grid grid-cols-2 gap-4 rounded-2xl border bg-card/60 p-6 backdrop-blur-md sm:grid-cols-4">
              {[
                { k: "4 Cantos", v: "Do A1 ao B2" },
                { k: "52 Circuitos", v: "Situações Reais" },
                { k: "728 Dias", v: "Roteiro Completo" },
                { k: "15 min/dia", v: "No seu ritmo" },
              ].map((s) => (
                <div key={s.k} className="text-center">
                  <div className="text-foreground text-2xl font-bold tabular-nums">{s.k}</div>
                  <div className="text-muted-foreground mt-1 text-xs font-medium uppercase tracking-wide">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- Os 4 Cantos */}
      <section id="cantos" className="border-t py-24 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="neutral" className="text-xs font-semibold uppercase tracking-widest mb-3">
              Estrutura Curricular
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Os 4 Cantos do Inglês Destravado
            </h2>
            <p className="text-muted-foreground mt-3 text-base">
              Nossa jornada em espiral leva você do nível iniciante (A1) até a fluência conectada e natural (B2).
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {CANTOS_DESCRIPTIONS.map((canto) => (
              <Card key={canto.code} className="card-hover overflow-hidden border">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="bg-primary/15 text-primary grid size-9 place-items-center rounded-xl font-mono text-sm font-bold">
                        {canto.code}
                      </span>
                      <div>
                        <h3 className="font-bold text-lg">{canto.title}</h3>
                        <p className="text-muted-foreground text-xs">{canto.circuits}</p>
                      </div>
                    </div>
                    <Badge variant="neutral" className="text-xs font-medium">
                      {canto.level}
                    </Badge>
                  </div>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {canto.summary}
                  </p>

                  <div className="border-t pt-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Ao final deste canto você consegue:
                    </p>
                    <ul className="space-y-1.5">
                      {canto.canDo.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs leading-normal">
                          <BadgeCheck className="text-success mt-0.5 size-4 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Metodologia */}
      <section id="metodologia" className="border-t py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="neutral" className="text-xs font-semibold uppercase tracking-widest mb-3">
              Como Você Aprende
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Ciclo de 14 Dias por Circuito
            </h2>
            <p className="text-muted-foreground mt-3 text-base">
              Cada circuito dura 14 dias: 7 dias de aquisição dos blocos de fala e 7 dias de consolidação com áudio e conversa ao vivo.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {METHOD_STEPS.map((m) => (
              <div key={m.step} className="bg-card rounded-xl border p-6 flex flex-col justify-between">
                <div>
                  <div className="text-primary/30 font-mono text-4xl font-extrabold mb-2">
                    {m.step}
                  </div>
                  <span className="text-primary text-[11px] font-semibold uppercase tracking-wider block mb-1">
                    {m.tag}
                  </span>
                  <h3 className="font-bold text-base mt-1 mb-2">{m.title}</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">{m.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Tutora IA Emma */}
      <section id="tutora" className="border-t py-24 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <Badge className="gap-1.5 px-3 py-1">
                <Sparkles className="size-3.5" /> Professora de IA Dedicada
              </Badge>

              <h2 className="text-3xl font-bold sm:text-4xl leading-tight">
                Sua tutora de fala que <span className="text-primary">ouve, avalia e responde em áudio</span>.
              </h2>

              <p className="text-muted-foreground text-base leading-relaxed">
                A <strong>Professora Emma</strong> foi treinada especificamente para identificar os vícios fonéticos e os erros estruturais que brasileiros cometem ao falar inglês.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex gap-3">
                  <div className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                    <Volume2 className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Respostas e Orientações em Áudio</h4>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Além do relatório por escrito, você pode ouvir a tutora explicando as correções em áudio com pronúncia perfeita.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                    <Headphones className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Áudios Salvos na Sua Conta</h4>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Todas as suas gravações ficam salvas no seu histórico para você ouvir novamente e comprovar sua evolução de sotaque.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                    <Radio className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Conversa ao Vivo em Tempo Real</h4>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Pratique conversa fluida sem roteiro na sala ao vivo. A Emma responde instantaneamente em voz ao que você diz.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Simulação de Card do Player de Feedback */}
            <div className="bg-card rounded-2xl border p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary text-primary-foreground grid size-10 place-items-center rounded-full font-bold text-sm">
                    EM
                  </div>
                  <div>
                    <p className="font-bold text-sm">Professora Emma (IA)</p>
                    <p className="text-muted-foreground text-xs">Avaliação de Fala & Áudio</p>
                  </div>
                </div>
                <Badge variant="success" className="text-xs">
                  Nota: 8.5 / 10
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="bg-muted/50 rounded-xl p-3.5 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Seu áudio gravado
                  </p>
                  <p className="text-xs italic">"Hi, I want a coffee please and a water."</p>
                </div>

                <div className="border-primary/20 bg-primary/5 rounded-xl border p-3.5 space-y-2">
                  <p className="text-primary flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                    <Volume2 className="size-3.5" /> Orientação em áudio da tutora
                  </p>
                  <div className="bg-background rounded-lg p-2.5 flex items-center gap-3 border">
                    <button className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-full shrink-0">
                      <PlayCircle className="size-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="bg-muted h-1.5 w-full rounded-full overflow-hidden">
                        <div className="bg-primary h-full w-2/3" />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">0:18 / 0:28 · Ouvir correções faladas</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <span className="font-semibold block">Dica de pronúncia:</span>
                  <p className="text-muted-foreground">
                    Cuidado com a palavra <span className="text-destructive font-medium">water</span>. Diga com o R suave do inglês americano: <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px]">/ˈwɑː.t̬ɚ/</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- FAQ */}
      <section id="faq" className="border-t py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="neutral" className="text-xs font-semibold uppercase tracking-widest mb-3">
              Tire Suas Dúvidas
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">Perguntas Frequentes</h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <details key={i} className="group bg-card rounded-xl border p-5 [&::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between font-semibold text-base">
                  <span>{faq.q}</span>
                  <span className="text-primary transition-transform duration-200 group-open:rotate-180">
                    ▼
                  </span>
                </summary>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed border-t pt-3">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- CTA */}
      <section className="border-t py-24 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 space-y-6">
          <h2 className="text-3xl font-bold sm:text-5xl tracking-tight">
            Comece a falar inglês hoje mesmo
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Abra o app, faça os 15 minutos do dia, grave seu áudio e receba a avaliação em áudio da Professora Emma.
          </p>
          <Button asChild size="xl" variant="gradient" className="shadow-xl shadow-primary/25">
            <Link href="/cadastro">
              Criar conta grátis <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ------------------------------------------------------------ Footer */}
      <footer className="border-t py-10">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <span className="bg-primary text-primary-foreground grid size-6 place-items-center rounded-lg">
              <Waves className="size-3.5" />
            </span>
            <span>InglishEasy</span>
          </div>
          <p className="text-xs">© {new Date().getFullYear()} InglishEasy. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
