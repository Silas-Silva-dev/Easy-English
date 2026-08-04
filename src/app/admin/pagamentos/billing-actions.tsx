"use client";

import {
  Check,
  Copy,
  Gift,
  KeyRound,
  MoreHorizontal,
  RefreshCw,
  ShieldOff,
  UnlockKeyhole,
  UserPlus,
} from "lucide-react";
import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Order } from "@/lib/types/database";

import {
  createFreeStudentAction,
  grantCourtesyAccessAction,
  releaseOrderAccessAction,
  revokeAccessAction,
  syncOrderAction,
  type BillingActionResult,
} from "./actions";

const INITIAL: BillingActionResult = { ok: false };

function useRunner() {
  const [pending, startTransition] = React.useTransition();

  const run = React.useCallback(
    (fn: () => Promise<BillingActionResult>, onDone?: () => void) => {
      startTransition(async () => {
        const result = await fn();
        if (result.ok) {
          toast.success(result.message ?? "Feito.");
          onDone?.();
        } else {
          toast.error(result.error ?? "Não foi possível concluir a ação.");
        }
      });
    },
    [],
  );

  return { pending, run };
}

/** Copia o link de acesso e confirma visualmente por 2 segundos. */
function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = React.useState(false);

  return (
    <div className="bg-muted/60 space-y-2 rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <KeyRound className="size-3.5" /> Link para o aluno definir a senha
      </p>
      <p className="text-muted-foreground text-[11px] leading-relaxed">
        Envie por WhatsApp ou e-mail. O link é de uso único e expira conforme a configuração do
        Supabase.
      </p>
      <div className="flex gap-2">
        <Input readOnly value={link} className="font-mono text-[11px]" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Copiar link"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
            }
          }}
        >
          {copied ? <Check className="text-success size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

function SubmitFreeStudent() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Criar e liberar acesso
    </Button>
  );
}

/** Botão + diálogo de "adicionar aluno sem custo". */
export function NewFreeStudentDialog() {
  const [open, setOpen] = React.useState(false);
  const [state, action] = useActionState(createFreeStudentAction, INITIAL);

  // O diálogo NÃO fecha sozinho no sucesso: o link de senha só existe nesta
  // resposta e some para sempre se a tela fechar antes de ser copiado.
  React.useEffect(() => {
    if (state.ok && !state.inviteLink) toast.success(state.message ?? "Aluno adicionado.");
  }, [state]);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        <UserPlus /> Adicionar aluno sem custo
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar aluno sem custo</DialogTitle>
            <DialogDescription>
              Cria a conta já com o e-mail confirmado e libera o curso completo como cortesia. Não
              gera cobrança nem aparece no faturamento.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            {state.error ? (
              <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
                {state.error}
              </p>
            ) : null}

            {state.ok && state.message ? (
              <p className="bg-success/10 text-success rounded-lg px-3 py-2 text-sm">
                {state.message}
              </p>
            ) : null}

            {state.inviteLink ? <CopyLink link={state.inviteLink} /> : null}

            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input id="fullName" name="fullName" placeholder="Maria Silva" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" placeholder="maria@email.com" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Motivo (aparece na auditoria)</Label>
              <Textarea id="note" name="note" placeholder="Ex.: aluna convidada, bolsa integral" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Fechar
              </Button>
              <SubmitFreeStudent />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Ações de uma linha da tabela de pedidos. */
export function OrderRowActions({ order, hasAccess }: { order: Order; hasAccess: boolean }) {
  const { pending, run } = useRunner();
  const [releaseOpen, setReleaseOpen] = React.useState(false);
  const [revokeOpen, setRevokeOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={pending} aria-label="Ações do pedido">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Pedido</DropdownMenuLabel>

          <DropdownMenuItem
            disabled={!order.payment_id}
            onClick={() => run(() => syncOrderAction(order.id))}
          >
            <RefreshCw /> Reconsultar no Mercado Pago
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Acesso do aluno</DropdownMenuLabel>

          {hasAccess ? (
            <DropdownMenuItem variant="destructive" onClick={() => setRevokeOpen(true)}>
              <ShieldOff /> Revogar acesso
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setReleaseOpen(true)}>
              <UnlockKeyhole /> Liberar acesso manualmente
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* --------------------------------------------- Liberar manualmente */}
      <Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar acesso manualmente</DialogTitle>
            <DialogDescription>
              Libera o curso para <strong>{order.email}</strong> sem alterar o status do pedido. O
              faturamento continua refletindo apenas o que o Mercado Pago aprovou — use quando o
              pagamento existir fora do fluxo automático.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="release-note">Motivo</Label>
            <Textarea
              id="release-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: pagamento conciliado no extrato, PIX travado no Mercado Pago"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseOpen(false)}>
              Cancelar
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                run(() => releaseOrderAccessAction(order.id, note), () => {
                  setReleaseOpen(false);
                  setNote("");
                })
              }
            >
              Liberar acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------- Revogar */}
      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revogar acesso</DialogTitle>
            <DialogDescription>
              <strong>{order.email}</strong> perde o acesso ao curso imediatamente. O histórico de
              progresso e as gravações são preservados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="revoke-note">Motivo</Label>
            <Textarea
              id="revoke-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: estorno solicitado pelo aluno"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              loading={pending}
              onClick={() =>
                run(() => revokeAccessAction(order.user_id, note), () => {
                  setRevokeOpen(false);
                  setNote("");
                })
              }
            >
              Revogar acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Liberar/revogar acesso a partir da lista de usuários. */
export function UserAccessActions({
  userId,
  email,
  hasAccess,
  isSelf,
}: {
  userId: string;
  email: string;
  hasAccess: boolean;
  isSelf: boolean;
}) {
  const { pending, run } = useRunner();
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  if (hasAccess) {
    return (
      <>
        <DropdownMenuItem
          variant="destructive"
          disabled={isSelf || pending}
          onSelect={(event) => {
            event.preventDefault();
            setOpen(true);
          }}
        >
          <ShieldOff /> Revogar acesso ao curso
        </DropdownMenuItem>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Revogar acesso</DialogTitle>
              <DialogDescription>
                <strong>{email}</strong> perde o acesso ao curso imediatamente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor={`revoke-${userId}`}>Motivo</Label>
              <Textarea
                id={`revoke-${userId}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: estorno, cortesia encerrada"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                loading={pending}
                onClick={() =>
                  run(() => revokeAccessAction(userId, note), () => {
                    setOpen(false);
                    setNote("");
                  })
                }
              >
                Revogar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <DropdownMenuItem
      disabled={pending}
      onSelect={(event) => {
        event.preventDefault();
        run(() => grantCourtesyAccessAction(userId, "Liberado pelo painel de usuários"));
      }}
    >
      <Gift /> Liberar acesso sem custo
    </DropdownMenuItem>
  );
}
