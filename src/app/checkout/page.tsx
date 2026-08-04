import {
  BadgeCheck,
  BrainCircuit,
  Clock,
  CreditCard,
  Headphones,
  Infinity as InfinityIcon,
  Lock,
  Mic,
  Radio,
  ShieldCheck,
  Waves,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL, PAYMENT_STATUS_LABEL } from "@/lib/billing";
import { getAccessGrant, requireActiveUser } from "@/lib/auth/guards";
import { checkoutEnv } from "@/lib/env";
import { getInstallmentTable } from "@/lib/mercadopago/installments";
import { createServerSupabase } from "@/lib/supabase/server";

import { signOutAction } from "../(auth)/actions";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = {
  title: "Finalizar matrícula",
  description: "Conclua o pagamento e libere o acesso completo ao InglishEasy.",
  robots: { index: false, follow: false },
};

// O preço e a tabela de parcelas vêm de fora a cada visita: nada aqui pode
// ser servido de um HTML pré-renderizado com o valor de ontem.
export const dynamic = "force-dynamic";

const INCLUDED = [
  {
    icon: BrainCircuit,
    title: "4 Cantos · 52 circuitos · 728 dias",
    body: "O roteiro inteiro do A1 ao B2, dia a dia, sem precisar decidir o que estudar.",
  },
  {
    icon: Mic,
    title: "Correção de pronúncia por IA",
    body: "Grave sua fala nos desafios e receba nota, correções comentadas e o IPA da pronúncia alvo.",
  },
  {
    icon: Headphones,
    title: "Respostas da Professora Emma em áudio",
    body: "Além do relatório escrito, a tutora explica as correções falando com você.",
  },
  {
    icon: Radio,
    title: "Conversa ao vivo em tempo real",
    body: "Sala de voz sem roteiro, no seu nível, para destravar o improviso.",
  },
  {
    icon: Clock,
    title: "Revisão espaçada automática",
    body: "Cada bloco de fala ganha agenda própria para você não esquecer o que já aprendeu.",
  },
  {
    icon: InfinityIcon,
    title: "Acesso vitalício, sem mensalidade",
    body: "Pagamento único. Seus áudios e seu progresso ficam salvos na conta para sempre.",
  },
];

const STEPS = [
  { n: 1, label: "Conta criada", done: true },
  { n: 2, label: "Pagamento", done: false },
  { n: 3, label: "Acesso liberado", done: false },
];

export default async function CheckoutPage() {
  const session = await requireActiveUser("/checkout");

  // Quem já tem acesso não deve ver tela de compra — inclusive a staff, que
  // passa pelo paywall por papel e compraria o que já tem.
  if (await getAccessGrant()) redirect("/app");
  if (session.profile.role === "admin" || session.profile.role === "instructor") redirect("/app");

  const priceCents = checkoutEnv.priceCents;
  const [{ options, source }, supabase] = await Promise.all([
    getInstallmentTable(priceCents),
    createServerSupabase(),
  ]);

  // Pedido em aberto: normalmente um PIX gerado e ainda não pago, ou um cartão
  // em análise antifraude. Avisar evita o segundo pagamento do mesmo curso.
  const { data: openOrder } = await supabase
    .from("orders")
    .select("status, created_at, payment_type")
    .eq("user_id", session.userId)
    .in("status", ["pending", "in_process"])
    .not("payment_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cheapest = options[0];

  return (
    <div className="bg-muted/25 min-h-screen">
      {/* ----------------------------------------------------------- Header */}
      <header className="glass sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-[calc(4rem+var(--safe-top))] max-w-6xl items-center justify-between gap-4 px-4 pt-[var(--safe-top)] sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
            <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-xl">
              <Waves className="size-4.5" />
            </span>
            <span className="tracking-tight">InglishEasy</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground hidden items-center gap-1.5 text-xs font-medium sm:flex">
              <Lock className="size-3.5" /> Ambiente seguro
            </span>
            <ThemeToggle />
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* ---------------------------------------------------------- Passos */}
        <ol className="mb-8 flex items-center justify-center gap-2 sm:gap-4">
          {STEPS.map((step, i) => (
            <li key={step.n} className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <span
                  className={
                    step.done
                      ? "bg-success text-success-foreground grid size-7 place-items-center rounded-full text-xs font-bold"
                      : step.n === 2
                        ? "bg-primary text-primary-foreground grid size-7 place-items-center rounded-full text-xs font-bold"
                        : "bg-muted text-muted-foreground grid size-7 place-items-center rounded-full text-xs font-bold"
                  }
                >
                  {step.done ? <BadgeCheck className="size-4" /> : step.n}
                </span>
                <span
                  className={
                    step.n === 2
                      ? "text-foreground text-xs font-semibold sm:text-sm"
                      : "text-muted-foreground hidden text-xs sm:inline sm:text-sm"
                  }
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 ? <span className="bg-border h-px w-4 sm:w-10" /> : null}
            </li>
          ))}
        </ol>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px] lg:items-start">
          {/* ------------------------------------------------------ Coluna 1 */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Badge variant="neutral" className="text-[11px] font-semibold tracking-widest uppercase">
                Falta pouco, {session.profile.full_name?.split(" ")[0] ?? "aluno"}
              </Badge>
              <h1 className="text-2xl font-bold sm:text-3xl">Libere seu acesso ao InglishEasy</h1>
              <p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
                Sua conta <strong className="text-foreground">{session.email}</strong> já está
                confirmada. Falta apenas o pagamento para o cronograma de 728 dias abrir.
              </p>
            </div>

            {openOrder ? (
              <div className="border-warning/30 bg-warning/10 flex items-start gap-3 rounded-xl border p-4">
                <Clock className="text-warning mt-0.5 size-5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">
                    Você tem um pagamento em andamento: {PAYMENT_STATUS_LABEL[openOrder.status]}.
                  </p>
                  <p className="text-muted-foreground mt-1 leading-relaxed">
                    Se você já pagou (PIX ou cartão em análise), aguarde alguns instantes e
                    atualize a página — o acesso abre sozinho assim que o Mercado Pago confirmar.
                    Só inicie um novo pagamento se tiver certeza de que o anterior não foi concluído.
                  </p>
                </div>
              </div>
            ) : null}

            {/* O que está incluído */}
            <section className="bg-card rounded-2xl border p-6">
              <h2 className="text-base font-semibold">O que você recebe</h2>
              <ul className="mt-5 grid gap-5 sm:grid-cols-2">
                {INCLUDED.map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-xl">
                      <item.icon className="size-4.5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                      <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                        {item.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Segurança */}
            <section className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  title: "Pagamento pelo Mercado Pago",
                  body: "Seus dados de cartão não passam pela nossa plataforma.",
                },
                {
                  icon: CreditCard,
                  title: "PIX, crédito e débito",
                  body: `Parcele em até ${checkoutEnv.maxInstallments}x no cartão de crédito.`,
                },
                {
                  icon: InfinityIcon,
                  title: "Pagamento único",
                  body: "Sem mensalidade, sem renovação automática.",
                },
              ].map((item) => (
                <div key={item.title} className="bg-card rounded-xl border p-4">
                  <item.icon className="text-primary size-5" />
                  <p className="mt-2.5 text-xs font-semibold">{item.title}</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{item.body}</p>
                </div>
              ))}
            </section>
          </div>

          {/* ------------------------------------------------------ Coluna 2 */}
          <aside className="lg:sticky lg:top-24">
            <div className="bg-card overflow-hidden rounded-2xl border shadow-lg">
              <div className="border-b bg-[linear-gradient(110deg,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)] p-6">
                <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                  Resumo do pedido
                </p>
                <h2 className="mt-2 text-base font-bold">{checkoutEnv.productTitle}</h2>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tabular-nums">
                    {formatBRL(priceCents)}
                  </span>
                  <span className="text-muted-foreground text-sm">à vista</span>
                </div>

                {cheapest && options.length > 1 ? (
                  <p className="text-muted-foreground mt-1 text-sm">
                    ou até{" "}
                    <strong className="text-foreground">
                      {options[options.length - 1]!.installments}x de{" "}
                      {formatBRL(options[options.length - 1]!.installmentCents)}
                    </strong>{" "}
                    no cartão
                  </p>
                ) : null}
              </div>

              <div className="p-6">
                <CheckoutForm
                  priceCents={priceCents}
                  options={options}
                  estimated={source === "estimate"}
                />
              </div>
            </div>

            <p className="text-muted-foreground mt-4 px-2 text-center text-xs leading-relaxed">
              Precisa de ajuda para concluir? Escreva para{" "}
              <a href="mailto:suporte@inglisheasy.com" className="text-primary hover:underline">
                suporte@inglisheasy.com
              </a>
              .
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
