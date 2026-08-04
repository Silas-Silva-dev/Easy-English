-- ===========================================================================
-- Easy English — Duas brechas fechadas no banco
--
-- Ambas vieram de uma auditoria adversarial do schema e sobreviveram à
-- tentativa de refutação. Nenhuma é explorável por aluno anônimo, mas as duas
-- falham EM SILÊNCIO — o operador acredita ter fechado o acesso e não fechou.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Suspender um admin não removia o acesso dele
--
-- `is_admin()` e `is_staff()` olhavam só `profiles.role`. Como toda policy de
-- staff escreve `... or public.is_staff()`, o gate `is_active_account()` era
-- curto-circuitado: um admin marcado como 'suspended' ou 'banned' continuava
-- com `for all` em profiles, courses, modules, lessons, circuits, knowledge_*
-- e leitura de audit_log — bastava falar direto com o PostgREST, sem passar
-- pela aplicação. O JWT dele continua válido: nada sincroniza `profiles.status`
-- com o `banned_until` do GoTrue.
--
-- Por que `not in ('suspended','banned')` e não `= 'active'`:
-- o primeiro admin nasce em 'pending_verification' (handle_new_user, via
-- admin_allowlist). Exigir 'active' o trancaria para fora antes de ele
-- confirmar o e-mail, e ninguém mais poderia destravá-lo.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' and status not in ('suspended', 'banned')
       from public.profiles where id = auth.uid()),
    false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'instructor') and status not in ('suspended', 'banned')
       from public.profiles where id = auth.uid()),
    false);
$$;

-- ---------------------------------------------------------------------------
-- 2. Qualquer usuário podia escrever o e-mail de outra pessoa no próprio perfil
--
-- A policy `profiles_update_own` libera a linha inteira e o trigger só protegia
-- `role` e `status`. Como `profiles.email` é UNIQUE, dava para gravar o e-mail
-- alheio no próprio perfil e:
--
--   a) QUEBRAR O CADASTRO da vítima — `handle_new_user` faz
--      `on conflict (id) do nothing`, que não cobre o unique de e-mail; a
--      exceção sobe e derruba o insert em auth.users ("Database error saving
--      new user").
--
--   b) ESCALAR PRIVILÉGIO — `scripts/bootstrap-admin.ts` promove por
--      `.eq("email", ...)`. Rodar `npm run bootstrap:admin -- dono@empresa.com`
--      promoveria a linha DO ATACANTE, porque é ela que carrega aquele e-mail.
--
-- A regra abaixo não proíbe a coluna de mudar: proíbe ela de divergir do
-- `auth.users`. Assim o trigger de confirmação/troca de e-mail continua
-- funcionando (ele grava exatamente o e-mail de auth.users), e a falsificação
-- fica impossível — o atacante só consegue gravar o próprio endereço.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Chamadas com service_role (scripts, admin API) e triggers do GoTrue têm
  -- auth.uid() nulo — é por aí que o bootstrap de admin funciona.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Nao e permitido alterar o proprio papel';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Nao e permitido alterar o proprio status de conta';
  end if;

  -- O e-mail do perfil é um espelho de auth.users, nunca um campo livre.
  if new.email is distinct from old.email
     and new.email is distinct from (select u.email from auth.users u where u.id = new.id)
  then
    raise exception 'E-mail e sincronizado a partir do cadastro, nao pode ser editado aqui';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

/**
 * Conserta divergências que já existam: se algum perfil tem e-mail diferente
 * do cadastro real, ele volta a espelhar auth.users. Não faz nada num banco
 * saudável.
 */
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;

notify pgrst, 'reload schema';
