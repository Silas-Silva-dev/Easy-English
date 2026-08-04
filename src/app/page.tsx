import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Headphones,
  Layers,
  Lock,
  PlayCircle,
  Radio,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Volume2,
  Waves,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { HeroScene } from "@/components/landing/hero-scene";
import { MobileCta } from "@/components/landing/mobile-cta";
import { TiltCard } from "@/components/landing/tilt-card";
import { ThemeToggle } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { formatBRL } from "@/lib/billing";
import { checkoutEnv } from "@/lib/env";
import { getInstallmentTable } from "@/lib/mercadopago/installments";
import { cn } from "@/lib/utils";
// CANTOS/CIRCUITS saíram: eram importados e nunca usados — a seção dos cantos
// é montada a partir da constante CANTOS_DESCRIPTIONS, logo abaixo.
import { DAY_BLOCKS, TRACKS, type TrackSpec } from "@content/curriculum";

export const metadata: Metadata = {
  title: "Easy English: Plataforma Completa de Inglês em 4 Cantos com IA",
  description:
    "Aprenda a falar inglês com a Professora Emma (IA). 4 Cantos, 52 circuitos, 728 dias de lições práticas com análise de pronúncia em áudio e conversa ao vivo. Três ritmos, de 20 min a 1h40 por dia, com a meta de cada um dita na cara. Pagamento único, acesso vitalício.",
};

/**
 * Regenerada de hora em hora.
 *
 * A página continua pré-renderizada (é o que os cabeçalhos de cache do
 * next.config pressupõem), mas o preço e a tabela de parcelas deixam de ficar
 * congelados no HTML do build: mudar `CHECKOUT_PRICE_CENTS` passa a valer sem
 * novo deploy. Um preço errado na página de vendas é uma promessa que o
 * checkout não cumpre.
 */
export const revalidate = 3600;

/** 20 → "20 min" · 60 → "1h" · 100 → "1h40" */
function formatDaily(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/**
 * A trilha padrão da plataforma — é a que `profiles.preferred_track` assume e
 * a que `courses.daily_minutes` (60) reflete. Ganha destaque visual para o
 * visitante não ter que adivinhar qual escolher.
 */
const DEFAULT_TRACK: TrackSpec["id"] = "complete";

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

/**
 * As placas da cena 3D do hero.
 *
 * A barra não é "progresso" inventado: é a posição do canto na escada do CEFR
 * — C1 leva ao A1, C4 ao B2 — que é exatamente o que a escada em profundidade
 * representa. Um percentual decorativo aqui insinuaria um número que o produto
 * não mede.
 */
const SCENE_CARDS = CANTOS_DESCRIPTIONS.map((canto, index) => ({
  code: canto.code,
  title: canto.title.split(": ")[1] ?? canto.title,
  level: canto.level,
  fill: (index + 1) * 25,
}));

const METHOD_STEPS = [
  {
    step: "01",
    tag: "Etapa de Aquisição (Dias 1 a 7)",
    title: "Imersão, Blocos & Quiz",
    body: 'Você ouve o diálogo em velocidade real antes de ler o texto. Aprende blocos prontos ("Can I get a...") em vez de decorar tabelas de gramática e testa a retenção com quizzes rápidos.',
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

const INCLUDED_IN_PRICE = [
  "Os 4 Cantos completos: 52 circuitos e 728 dias de lição, do A1 ao B2",
  "Desafios de fala com gravação e análise de pronúncia por IA (com IPA)",
  "Correções da Professora Emma em texto e em áudio falado",
  "Sala de conversa ao vivo por voz, em tempo real e no seu nível",
  "Revisão espaçada automática de cada bloco de fala que você aprende",
  "Seus áudios e seu progresso salvos para sempre na sua conta",
  "Acesso pelo celular, tablet e computador, sem instalar nada",
  "Novas lições e melhorias da plataforma sem custo adicional",
];

const FAQS = [
  {
    q: "Como funciona o pagamento e o que acontece depois?",
    a: "É um pagamento único, sem mensalidade e sem renovação automática. Você cria a conta, confirma o e-mail e conclui o pagamento no ambiente seguro do Mercado Pago (a plataforma de pagamentos do Mercado Livre). Assim que o pagamento é aprovado, o acesso ao curso completo abre automaticamente — no PIX isso costuma levar segundos.",
  },
  {
    q: "Posso parcelar? Tem juros?",
    a: "Pode parcelar no cartão de crédito. A primeira parcela é sem juros; a partir da segunda, o parcelamento segue a tabela de juros da operadora do seu cartão, cobrada por ela. O valor exato de cada parcela aparece na tela do Mercado Pago antes de você confirmar a compra. Se preferir pagar sem nenhum acréscimo, use o PIX ou o cartão à vista.",
  },
  {
    q: "Quais formas de pagamento vocês aceitam?",
    a: "PIX, cartão de crédito (à vista ou parcelado), cartão de débito e saldo em conta Mercado Pago. Os dados do seu cartão são digitados no ambiente do Mercado Pago e não passam pela nossa plataforma.",
  },
  {
    q: "Preciso saber inglês para começar no Canto 1?",
    a: "Não! O Canto 1 (Destravar) é desenhado desde o nível A1 inicial. O curso utiliza o método de blocos de fala e imersão progressiva, ideal tanto para quem está do zero quanto para quem tem o inglês travado na mente.",
  },
  {
    q: "Quanto tempo preciso dedicar por dia?",
    a: "Depende do resultado que você quer, e a gente prefere ser honesto sobre isso. O núcleo da lição são 15 minutos e é igual em todas as trilhas — é ele que sustenta o hábito. A partir daí você escolhe: Essencial (20 min/dia) para se virar sozinho no dia a dia, Completo (60 min/dia) para conversar sobre qualquer assunto com um nativo, ou Intensivo (1h40/dia) para discutir e trabalhar em inglês. Você pode trocar de trilha quando quiser, direto no seu perfil.",
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
  const priceCents = checkoutEnv.priceCents;
  const { options, source } = await getInstallmentTable(priceCents);
  // Última linha da tabela: a maior parcela permitida, que é o número que o
  // visitante procura ("cabe no meu mês?").
  const longest = options[options.length - 1];

  return (
    /*
      `overflow-x-clip`, e não `overflow-x-hidden`: as placas 3D giradas
      ultrapassam a lateral em telas estreitas e criariam rolagem horizontal.
      `hidden` resolveria isso também, mas criaria um contêiner de rolagem — e
      o cartão de preço `lg:sticky` pararia de grudar.
    */
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      {/*
        Sem JavaScript o IntersectionObserver nunca roda e todo bloco com
        <Reveal> ficaria invisível para sempre. Isto devolve a página inteira a
        quem navega com JS desligado e a qualquer rastreador que não execute
        scripts — uma página de vendas em branco no Google seria um estrago bem
        maior do que a animação vale.
      */}
      <noscript>
        <style
          dangerouslySetInnerHTML={{
            __html: ".reveal{opacity:1;transform:none}",
          }}
        />
      </noscript>

      {/* ----------------------------------------------------------- Header */}
      <header className="glass fixed top-0 inset-x-0 z-50 border-b">
        <div className="mx-auto flex h-[calc(4rem+var(--safe-top))] max-w-6xl items-center justify-between px-4 pt-[var(--safe-top)] sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-semibold transition-opacity hover:opacity-90"
          >
            <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-xl shadow-md shadow-primary/20">
              <Waves className="size-4.5" />
            </span>
            <span className="text-[1.1rem] tracking-tight font-bold">
              Easy English
            </span>
          </Link>

          {/* Rótulos curtos: com "Ritmos" são 6 itens, e os nomes longos
              estouravam a barra já em 768px, junto com logo e botões. */}
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            {[
              { href: "#cantos", label: "4 Cantos" },
              { href: "#metodologia", label: "Método" },
              { href: "#ritmos", label: "Ritmos" },
              { href: "#tutora", label: "Tutora" },
              { href: "#investimento", label: "Preço" },
              { href: "#faq", label: "Dúvidas" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Link href="/login">Entrar</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="gradient"
              className="h-10 px-4 sm:h-9"
            >
              <Link href="#investimento">Garantir meu acesso</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- Hero */}
      {/* `id` serve à barra de compra do celular, que só aparece depois que
          este bloco sai da tela. */}
      <section
        id="hero"
        className="relative overflow-hidden pt-[calc(4.5rem+var(--safe-top))] pb-16 sm:pt-[calc(6rem+var(--safe-top))] sm:pb-24"
      >
        <div className="bg-grid pointer-events-none absolute inset-0 -z-10 opacity-70" />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[500px] bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent)]" />

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/*
            Duas colunas a partir de lg, empilhado antes disso. No celular a
            cena 3D vem DEPOIS do texto e dos botões: quem abre no telefone
            precisa ler a promessa e alcançar o botão sem rolar por decoração.
          */}
          <div className="items-center gap-12 lg:grid lg:grid-cols-[1.05fr_.95fr] lg:gap-10">
            <div className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5 text-xs font-semibold text-primary animate-fade mb-6">
                <Sparkles className="size-3.5" />
                Curso Completo em 4 Cantos com Tutora de IA em Áudio
              </div>

              {/* 4xl (36px) estourava "Pare de travar no inglês." em tela de
                  360px. O passo extra em 2rem resolve sem encolher o desktop. */}
              <h1 className="animate-in-up text-[2rem] leading-[1.1] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                <span className="text-gradient">Pare de travar no inglês.</span>
                <br />
                Comece a{" "}
                <span className="text-primary">falar com confiança</span>.
              </h1>

              <p className="text-muted-foreground animate-in-up mx-auto mt-5 max-w-2xl text-base leading-relaxed font-normal sm:mt-6 sm:text-lg lg:mx-0">
                Domine o inglês em <strong>4 Cantos</strong>, no ritmo que{" "}
                <strong>você</strong> escolhe — de 20 minutos a 1h40 por dia.
                Grave sua fala nos desafios, salve seus áudios na plataforma e
                receba correções da <strong>Professora Emma (IA)</strong> em
                texto e áudio.
              </p>

              <div className="animate-in-up mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Button
                  asChild
                  size="xl"
                  variant="gradient"
                  className="w-full sm:w-auto shadow-lg shadow-primary/20"
                >
                  <Link href="/cadastro">
                    Quero meu acesso <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="xl"
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <Link href="#cantos">Ver os 4 Cantos do Curso</Link>
                </Button>
              </div>

              <p className="text-muted-foreground animate-in-up mt-4 text-sm">
                Pagamento único de{" "}
                <strong className="text-foreground">
                  {formatBRL(priceCents)}
                </strong>
                {longest && longest.installments > 1 ? (
                  <>
                    {" "}
                    ou {longest.installments}x de{" "}
                    <strong className="text-foreground">
                      {formatBRL(longest.installmentCents)}
                    </strong>
                  </>
                ) : null}{" "}
                · acesso vitalício, sem mensalidade
              </p>
            </div>

            {/* A escada dos 4 Cantos em profundidade — CSS 3D, zero WebGL. */}
            <div className="animate-fade mt-14 lg:mt-0">
              <HeroScene cards={SCENE_CARDS} />
            </div>
          </div>

          {/* Destaques rápidos */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="text-success size-4" /> Pague uma vez,
              estude para sempre
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="text-success size-4" /> Respostas da
              tutora em áudio
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="text-success size-4" /> 728 dias no seu
              ritmo
            </span>
          </div>

          {/* Métricas do curso */}
          <div className="mt-10 grid grid-cols-2 gap-4 rounded-2xl border bg-card/60 p-5 backdrop-blur-md sm:mt-14 sm:grid-cols-4 sm:p-6">
            {[
              { k: "4 Cantos", v: "Do A1 ao B2" },
              { k: "52 Circuitos", v: "Situações Reais" },
              { k: "728 Dias", v: "Roteiro Completo" },
              { k: "3 Ritmos", v: "20, 60 ou 100 min" },
            ].map((s) => (
              <div key={s.k} className="text-center">
                <div className="text-foreground text-xl font-bold tabular-nums sm:text-2xl">
                  {s.k}
                </div>
                <div className="text-muted-foreground mt-1 text-[10px] font-medium uppercase tracking-wide sm:text-xs">
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- Os 4 Cantos */}
      <section id="cantos" className="border-t py-16 sm:py-24 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="text-center max-w-3xl mx-auto">
            <Badge
              variant="neutral"
              className="text-xs font-semibold uppercase tracking-widest mb-3"
            >
              Estrutura Curricular
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Os 4 Cantos do Inglês Destravado
            </h2>
            <p className="text-muted-foreground mt-3 text-base">
              Nossa jornada em espiral leva você do nível iniciante (A1) até a
              fluência conectada e natural (B2).
            </p>
          </Reveal>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {CANTOS_DESCRIPTIONS.map((canto, index) => (
              <Reveal key={canto.code} delay={index * 70} className="flex">
                <TiltCard>
                  <Card className="card-hover overflow-hidden border w-full">
                    <CardContent className="p-6 space-y-4 text-center sm:text-left">
                      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                        <div className="flex flex-col items-center gap-2.5 sm:flex-row">
                          <span className="bg-primary/15 text-primary grid size-9 shrink-0 place-items-center rounded-xl font-mono text-sm font-bold">
                            {canto.code}
                          </span>
                          <div>
                            <h3 className="font-bold text-lg">{canto.title}</h3>
                            <p className="text-muted-foreground text-xs">
                              {canto.circuits}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="neutral"
                          className="text-xs font-medium"
                        >
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
                            <li
                              key={i}
                              className="flex items-start justify-center gap-2 text-xs leading-normal sm:justify-start"
                            >
                              <BadgeCheck className="text-success mt-0.5 size-4 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Metodologia */}
      <section id="metodologia" className="border-t py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="text-center max-w-3xl mx-auto">
            <Badge
              variant="neutral"
              className="text-xs font-semibold uppercase tracking-widest mb-3"
            >
              Como Você Aprende
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Ciclo de 14 Dias por Circuito
            </h2>
            <p className="text-muted-foreground mt-3 text-base">
              Cada circuito dura 14 dias: 7 dias de aquisição dos blocos de fala
              e 7 dias de consolidação com áudio e conversa ao vivo.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {METHOD_STEPS.map((m, index) => (
              <Reveal key={m.step} delay={index * 70} className="flex">
                <div className="bg-card flex w-full flex-col justify-between rounded-xl border p-6 text-center sm:text-left">
                  <div>
                    <div className="text-primary/30 font-mono text-4xl font-extrabold mb-2">
                      {m.step}
                    </div>
                    <span className="text-primary text-[11px] font-semibold uppercase tracking-wider block mb-1">
                      {m.tag}
                    </span>
                    <h3 className="font-bold text-base mt-1 mb-2">{m.title}</h3>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {m.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Ritmos */}
      {/*
        Esta seção existe para consertar uma promessa que a página fazia e o
        curso não cumpria: "15 minutos por dia" até o B2. Os 15 minutos são o
        NÚCLEO da lição, comum às três trilhas — não a trilha inteira. Chegar
        ao B2 é a trilha Completo: 60 min/dia, 728 horas.

        Os números abaixo saem de TRACKS (content/curriculum.ts), que espelha a
        tabela `track_targets`. A migration 400 diz de onde a UI deve tirar o
        que promete: "nunca de um número inventado na landing page".
      */}
      <section id="ritmos" className="border-t py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mx-auto max-w-3xl text-center">
            <Badge
              variant="neutral"
              className="text-xs font-semibold uppercase tracking-widest mb-3"
            >
              Quanto tempo por dia
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Você escolhe o ritmo. A gente diz aonde ele chega.
            </h2>
            <p className="text-muted-foreground mt-3 text-base leading-relaxed">
              O conteúdo é o mesmo nas três trilhas — muda quanto você faz por
              dia. E cada uma vem com o que ela <strong>não</strong> entrega,
              escrito na mesma letra da promessa. Você troca de trilha quando
              quiser, no seu perfil.
            </p>
          </Reveal>

          {/* O núcleo comum: é daqui que vinha o "15 minutos" */}
          <Reveal className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-3 rounded-xl border bg-card p-5 text-center sm:flex-row sm:items-start sm:text-left">
            <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl">
              <Clock className="size-5" />
            </span>
            <div className="text-sm">
              <p className="font-semibold">
                O núcleo são {DAY_BLOCKS.core.minutes} minutos, em qualquer
                trilha
              </p>
              <p className="text-muted-foreground mt-1 leading-relaxed">
                {DAY_BLOCKS.core.brief} As trilhas mais longas acrescentam
                blocos a ele — nunca o substituem. Num dia corrido, fazer só o
                núcleo mantém a constância.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {TRACKS.map((track, index) => {
              const featured = track.id === DEFAULT_TRACK;

              return (
                <Reveal key={track.id} delay={index * 90} className="flex">
                  <TiltCard intensity={5}>
                    <div
                      className={cn(
                        "bg-card relative flex w-full flex-col rounded-2xl border p-6 text-center sm:text-left",
                        featured &&
                          "border-primary/40 ring-primary/20 shadow-lg ring-2",
                      )}
                    >
                      {featured ? (
                        // Centralizada no celular; a partir de sm volta a
                        // ancorar na quina esquerda do cartão.
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1 shadow-sm sm:left-6 sm:translate-x-0">
                          <Star className="size-3" /> Mais escolhido
                        </Badge>
                      ) : null}

                      <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                        <h3 className="text-lg font-bold">{track.label}</h3>
                        <Badge variant="neutral" className="text-xs">
                          Chega ao {track.cefr}
                        </Badge>
                      </div>

                      <div className="mt-4 flex items-baseline justify-center gap-1.5 sm:justify-start">
                        <span className="text-3xl font-extrabold tabular-nums">
                          {formatDaily(track.dailyMinutes)}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          por dia
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {track.totalHours} horas ao longo dos 728 dias
                      </p>

                      <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:items-start">
                        <Target className="text-success size-4 shrink-0 sm:mt-0.5" />
                        <p className="text-sm leading-relaxed font-medium">
                          {track.promise}
                        </p>
                      </div>

                      {/*
                    O limite honesto não é letra miúda: fica do mesmo tamanho da
                    promessa. É o que faz o aluno escolher sabendo o que recebe,
                    em vez de desistir no mês 8 achando que foi enganado.

                    No celular o filete vira uma régua no topo: uma borda à
                    esquerda com o texto centralizado ficaria solta, apontando
                    para nada.
                  */}
                      <div className="border-muted-foreground/25 mt-4 border-t-2 pt-3 sm:border-t-0 sm:border-l-2 sm:pt-0 sm:pl-3">
                        <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                          O que essa trilha não entrega
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                          {track.honestLimit}
                        </p>
                      </div>

                      <div className="mt-auto border-t pt-4">
                        <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                          Blocos do dia
                        </p>
                        <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                          {track.blocks.map((block) => (
                            <span
                              key={block}
                              className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-[11px] font-medium"
                            >
                              {DAY_BLOCKS[block].label} ·{" "}
                              {DAY_BLOCKS[block].minutes} min
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TiltCard>
                </Reveal>
              );
            })}
          </div>

          <Reveal>
            <p className="text-muted-foreground mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed">
              Não existe trilha errada — existe a que você sustenta. Começar no
              Essencial e subir depois funciona melhor do que escolher o
              Intensivo e abandonar no segundo mês.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------ Tutora IA Emma */}
      <section id="tutora" className="border-t py-16 sm:py-24 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <Reveal className="space-y-6 text-center sm:text-left">
              <Badge className="gap-1.5 px-3 py-1">
                <Sparkles className="size-3.5" /> Professora de IA Dedicada
              </Badge>

              <h2 className="text-3xl font-bold sm:text-4xl leading-tight">
                Sua tutora de fala que{" "}
                <span className="text-primary">
                  ouve, avalia e responde em áudio
                </span>
                .
              </h2>

              <p className="text-muted-foreground text-base leading-relaxed">
                A <strong>Professora Emma</strong> foi treinada especificamente
                para identificar os vícios fonéticos e os erros estruturais que
                brasileiros cometem ao falar inglês.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:gap-3">
                  <div className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                    <Volume2 className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">
                      Respostas e Orientações em Áudio
                    </h4>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Além do relatório por escrito, você pode ouvir a tutora
                      explicando as correções em áudio com pronúncia perfeita.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:gap-3">
                  <div className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                    <Headphones className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">
                      Áudios Salvos na Sua Conta
                    </h4>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Todas as suas gravações ficam salvas no seu histórico para
                      você ouvir novamente e comprovar sua evolução de sotaque.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:gap-3">
                  <div className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                    <Radio className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">
                      Conversa ao Vivo em Tempo Real
                    </h4>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Pratique conversa fluida sem roteiro na sala ao vivo. A
                      Emma responde instantaneamente em voz ao que você diz.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Simulação de Card do Player de Feedback */}
            <Reveal
              delay={120}
              className="bg-card rounded-2xl border p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary text-primary-foreground grid size-10 place-items-center rounded-full font-bold text-sm">
                    EM
                  </div>
                  <div>
                    <p className="font-bold text-sm">Professora Emma (IA)</p>
                    <p className="text-muted-foreground text-xs">
                      Avaliação de Fala & Áudio
                    </p>
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
                  <p className="text-xs italic">
                    "Hi, I want a coffee please and a water."
                  </p>
                </div>

                <div className="border-primary/20 bg-primary/5 rounded-xl border p-3.5 space-y-2">
                  <p className="text-primary flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                    <Volume2 className="size-3.5" /> Orientação em áudio da
                    tutora
                  </p>
                  <div className="bg-background rounded-lg p-2.5 flex items-center gap-3 border">
                    <button className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-full shrink-0">
                      <PlayCircle className="size-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="bg-muted h-1.5 w-full rounded-full overflow-hidden">
                        <div className="bg-primary h-full w-2/3" />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        0:18 / 0:28 · Ouvir correções faladas
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <span className="font-semibold block">
                    Dica de pronúncia:
                  </span>
                  <p className="text-muted-foreground">
                    Cuidado com a palavra{" "}
                    <span className="text-destructive font-medium">water</span>.
                    Diga com o R suave do inglês americano:{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px]">
                      /ˈwɑː.t̬ɚ/
                    </code>
                    .
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- Investimento */}
      <section
        id="investimento"
        className="border-t py-16 sm:py-24 bg-muted/20"
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Badge
              variant="neutral"
              className="text-xs font-semibold uppercase tracking-widest mb-3"
            >
              Investimento
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Um pagamento. Dois anos de curso. Acesso para sempre.
            </h2>
            <p className="text-muted-foreground mt-3 text-base">
              Sem mensalidade, sem renovação automática e sem cobrança surpresa.
              Você paga uma única vez e o curso inteiro fica na sua conta.
            </p>
          </Reveal>

          {/*
            A grade inteira num só <Reveal>, e não cada cartão: o card de preço
            é `lg:sticky`, e um wrapper com altura própria em volta dele viraria
            o bloco em que ele gruda — matando o sticky.
          */}
          <Reveal className="mt-14 grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
            {/* O que está incluído */}
            <div className="bg-card rounded-2xl border p-7 text-center sm:text-left">
              <h3 className="text-lg font-bold">Tudo isto está incluído</h3>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {INCLUDED_IN_PRICE.map((item) => (
                  <li
                    key={item}
                    className="flex items-start justify-center gap-2.5 text-sm leading-relaxed sm:justify-start"
                  >
                    <BadgeCheck className="text-success mt-0.5 size-4.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t pt-6 text-xs text-muted-foreground font-medium sm:justify-start">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="text-success size-4" /> Pagamento
                  processado pelo Mercado Pago
                </span>
                <span className="flex items-center gap-1.5">
                  <Lock className="text-success size-4" /> Seus dados de cartão
                  não passam por nós
                </span>
              </div>
            </div>

            {/* Card de preço */}
            <div className="bg-card overflow-hidden rounded-2xl border shadow-xl lg:sticky lg:top-24">
              <div className="border-b bg-[linear-gradient(110deg,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)] p-7 text-center">
                <p className="text-primary text-xs font-semibold uppercase tracking-widest">
                  Acesso completo
                </p>

                <div className="mt-4 flex items-baseline justify-center gap-2">
                  <span className="text-4xl font-extrabold tabular-nums">
                    {formatBRL(priceCents)}
                  </span>
                  <span className="text-muted-foreground text-sm">à vista</span>
                </div>

                {longest && longest.installments > 1 ? (
                  <p className="text-muted-foreground mt-2 text-sm">
                    ou em até{" "}
                    <strong className="text-foreground">
                      {longest.installments}x de{" "}
                      {formatBRL(longest.installmentCents)}
                    </strong>{" "}
                    no cartão
                  </p>
                ) : null}

                <p className="text-muted-foreground mt-1 text-xs">
                  Pagamento único · sem mensalidade
                </p>
              </div>

              <div className="p-7 space-y-5">
                <div className="space-y-2.5 text-sm">
                  {[
                    { icon: Zap, text: "PIX: acesso liberado em segundos" },
                    {
                      icon: Layers,
                      text: `Cartão de crédito em até ${checkoutEnv.maxInstallments}x`,
                    },
                    {
                      icon: Lock,
                      text: "Cartão de débito e saldo Mercado Pago",
                    },
                  ].map((item) => (
                    <div
                      key={item.text}
                      className="flex items-center justify-center gap-2.5 sm:justify-start"
                    >
                      <item.icon className="text-primary size-4 shrink-0" />
                      <span className="text-muted-foreground">{item.text}</span>
                    </div>
                  ))}
                </div>

                <Button
                  asChild
                  size="xl"
                  variant="gradient"
                  className="w-full shadow-lg shadow-primary/20"
                >
                  <Link href="/cadastro">
                    Criar conta e pagar <ArrowRight className="size-4" />
                  </Link>
                </Button>

                <p className="text-muted-foreground text-center text-xs leading-relaxed">
                  Você cria a conta, confirma o e-mail e conclui o pagamento no
                  ambiente seguro do Mercado Pago. O acesso abre automaticamente
                  na aprovação.
                </p>

                <p className="text-muted-foreground border-t pt-4 text-center text-[11px] leading-relaxed">
                  {source === "estimate"
                    ? "Valores de parcela simulados. A primeira parcela é sem juros; a partir da segunda incidem os juros da operadora do seu cartão, confirmados pelo Mercado Pago antes de você autorizar a compra."
                    : "A primeira parcela é sem juros. A partir da segunda incidem os juros da operadora do seu cartão, exibidos pelo Mercado Pago antes de você autorizar a compra."}
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <p className="text-muted-foreground mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed">
              Já tem conta e ainda não concluiu o pagamento?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Entre na plataforma
              </Link>{" "}
              para retomar de onde parou.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------- FAQ */}
      <section id="faq" className="border-t py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <Badge
              variant="neutral"
              className="text-xs font-semibold uppercase tracking-widest mb-3"
            >
              Tire Suas Dúvidas
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Perguntas Frequentes
            </h2>
          </Reveal>

          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <Reveal key={i} delay={Math.min(i, 4) * 60}>
                <details className="group bg-card rounded-xl border p-5 [&::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-center justify-between font-semibold text-base">
                    <span>{faq.q}</span>
                    <span className="text-primary transition-transform duration-200 group-open:rotate-180">
                      ▼
                    </span>
                  </summary>
                  <p className="text-muted-foreground mt-3 border-t pt-3 text-center text-sm leading-relaxed sm:text-left">
                    {faq.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- CTA */}
      <section
        id="cta-final"
        className="border-t py-16 sm:py-24 bg-gradient-to-b from-primary/5 to-transparent"
      >
        <Reveal className="mx-auto max-w-3xl px-4 text-center sm:px-6 space-y-6">
          <h2 className="text-3xl font-bold sm:text-5xl tracking-tight">
            Comece a falar inglês hoje mesmo
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Abra o app, faça o bloco do dia no seu ritmo, grave seu áudio e
            receba a avaliação em áudio da Professora Emma.
          </p>
          <Button
            asChild
            size="xl"
            variant="gradient"
            className="shadow-xl shadow-primary/25"
          >
            <Link href="/cadastro">
              Garantir meu acesso <ArrowRight className="size-4" />
            </Link>
          </Button>
          <p className="text-muted-foreground text-sm">
            {formatBRL(priceCents)} à vista
            {longest && longest.installments > 1
              ? ` ou ${longest.installments}x de ${formatBRL(longest.installmentCents)}`
              : ""}{" "}
            · pagamento único, acesso vitalício
          </p>
        </Reveal>
      </section>

      {/* Barra de compra fixa — só no celular, e só entre o hero e o preço. */}
      <MobileCta
        priceLabel={
          longest && longest.installments > 1
            ? `${formatBRL(priceCents)} ou ${longest.installments}x de ${formatBRL(longest.installmentCents)}`
            : formatBRL(priceCents)
        }
      />

      {/* ------------------------------------------------------------ Footer */}
      <footer className="border-t py-10">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <span className="bg-primary text-primary-foreground grid size-6 place-items-center rounded-lg">
              <Waves className="size-3.5" />
            </span>
            <span>Easy English</span>
          </div>
          <p className="text-xs">
            © {new Date().getFullYear()} Easy English. Todos os direitos
            reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
