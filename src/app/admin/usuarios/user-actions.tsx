"use client";

import { Ban, CheckCircle2, MailCheck, MoreHorizontal, ShieldCheck, Trash2, UserCog } from "lucide-react";
import * as React from "react";
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
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/lib/types/database";

import { UserAccessActions } from "../pagamentos/billing-actions";
import {
  deleteUserAction,
  updateUserRoleAction,
  updateUserStatusAction,
  verifyUserEmailAction,
  type ActionResult,
} from "../actions";

export function UserRowActions({
  user,
  isSelf,
  hasAccess,
  showAccessActions,
}: {
  user: Profile;
  isSelf: boolean;
  /** Tem concessão de acesso viva ao curso. */
  hasAccess: boolean;
  /** Falso para admin/instrutor: eles entram pelo papel, não por concessão. */
  showAccessActions: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  function run(fn: () => Promise<ActionResult>, onDone?: () => void) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Feito.");
        onDone?.();
      } else {
        toast.error(result.error ?? "Não foi possível concluir a ação.");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={pending} aria-label="Ações do usuário">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Papel</DropdownMenuLabel>
          {(["student", "instructor", "admin"] as const).map((role) => (
            <DropdownMenuItem
              key={role}
              disabled={user.role === role || (isSelf && role !== "admin")}
              onClick={() => run(() => updateUserRoleAction(user.id, role))}
            >
              <UserCog />
              {role === "student" ? "Aluno" : role === "instructor" ? "Instrutor" : "Administrador"}
              {user.role === role ? " •" : ""}
            </DropdownMenuItem>
          ))}

          {showAccessActions ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Curso</DropdownMenuLabel>
              <UserAccessActions
                userId={user.id}
                email={user.email}
                hasAccess={hasAccess}
                isSelf={isSelf}
              />
            </>
          ) : null}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Conta</DropdownMenuLabel>

          {user.status === "pending_verification" ? (
            <DropdownMenuItem onClick={() => run(() => verifyUserEmailAction(user.id))}>
              <MailCheck /> Confirmar e-mail manualmente
            </DropdownMenuItem>
          ) : null}

          {user.status !== "active" ? (
            <DropdownMenuItem onClick={() => run(() => updateUserStatusAction(user.id, "active"))}>
              <CheckCircle2 /> Reativar conta
            </DropdownMenuItem>
          ) : null}

          {user.status !== "suspended" && !isSelf ? (
            <DropdownMenuItem onClick={() => setSuspendOpen(true)}>
              <ShieldCheck /> Suspender
            </DropdownMenuItem>
          ) : null}

          {user.status !== "banned" && !isSelf ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => run(() => updateUserStatusAction(user.id, "banned"))}
            >
              <Ban /> Banir
            </DropdownMenuItem>
          ) : null}

          {!isSelf ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 /> Excluir permanentemente
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ------------------------------------------------------ Suspender */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspender conta</DialogTitle>
            <DialogDescription>
              {user.full_name ?? user.email} perderá o acesso ao conteúdo até ser reativado. O motivo
              informado aparece para o aluno.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: pagamento pendente"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              loading={pending}
              onClick={() =>
                run(() => updateUserStatusAction(user.id, "suspended", reason), () => {
                  setSuspendOpen(false);
                  setReason("");
                })
              }
            >
              Suspender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------------------- Excluir */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir usuário</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Todo o progresso, gravações e histórico de{" "}
              <strong>{user.email}</strong> serão apagados permanentemente.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              loading={pending}
              onClick={() => run(() => deleteUserAction(user.id), () => setDeleteOpen(false))}
            >
              Excluir permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
