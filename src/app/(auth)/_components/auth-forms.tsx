"use client";

import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  requestPasswordResetAction,
  resendVerificationAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
  type AuthFormState,
} from "../actions";

const INITIAL: AuthFormState = {};

function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className={cn("w-full", className)} loading={pending}>
      {children}
    </Button>
  );
}

function FormAlert({ state }: { state: AuthFormState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p
        role="status"
        className="bg-success/10 text-success flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
      >
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        {state.success}
      </p>
    );
  }
  return null;
}

function PasswordInput({
  id,
  name,
  autoComplete,
  placeholder = "••••••••",
  minLength,
}: {
  id: string;
  name: string;
  autoComplete: string;
  placeholder?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        minLength={minLength}
        required
        className="pr-12"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // size-10: no dedo, um alvo de 24px acerta o campo de texto atrás.
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded transition-colors"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

// --------------------------------------------------------------------- Login
export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signInAction, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/app"} />
      <FormAlert state={state} />

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Senha</Label>
          {/* -my-2 py-2: dobra o alvo de toque sem mexer no alinhamento. */}
          <a href="/recuperar-senha" className="text-primary -my-2 py-2 text-xs hover:underline">
            Esqueci minha senha
          </a>
        </div>
        <PasswordInput id="password" name="password" autoComplete="current-password" />
      </div>

      <SubmitButton>Entrar</SubmitButton>
    </form>
  );
}

// ------------------------------------------------------------------ Cadastro
export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <FormAlert state={state} />

      <div className="space-y-2">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          placeholder="Maria Silva"
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
        />
        <p className="text-muted-foreground text-xs">Mínimo de 8 caracteres.</p>
      </div>

      <SubmitButton>Criar minha conta</SubmitButton>

      <p className="text-muted-foreground text-center text-xs leading-relaxed">
        Ao criar a conta você concorda em receber o e-mail de verificação necessário para ativar o
        acesso.
      </p>
    </form>
  );
}

// ----------------------------------------------------------- Recuperar senha
export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <FormAlert state={state} />

      <div className="space-y-2">
        <Label htmlFor="email">E-mail da conta</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          required
          autoFocus
        />
      </div>

      <SubmitButton>Enviar link de redefinição</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------- Nova senha
export function NewPasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <FormAlert state={state} />

      <div className="space-y-2">
        <Label htmlFor="password">Nova senha</Label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirme a nova senha</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={8}
        />
      </div>

      <SubmitButton>Salvar nova senha</SubmitButton>
    </form>
  );
}

// -------------------------------------------------------- Reenviar validação
export function ResendVerificationForm({ email }: { email?: string }) {
  const [state, action] = useActionState(resendVerificationAction, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <FormAlert state={state} />

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={email}
          placeholder="voce@email.com"
          required
        />
      </div>

      <SubmitButton className="!bg-secondary !text-secondary-foreground hover:!bg-secondary/70">
        Reenviar e-mail de verificação
      </SubmitButton>
    </form>
  );
}
