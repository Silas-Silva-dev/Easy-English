-- ===========================================================================
-- Easy English — Cobrança no cadastro (Mercado Pago) e liberação de acesso
--
-- O cadastro deixa de ser gratuito. A partir daqui existem DOIS conceitos
-- separados, e essa separação é o ponto central desta migration:
--
--   profiles.status  -> a conta existe e o e-mail foi confirmado
--   access_grants    -> a pessoa PODE ESTUDAR
--
-- Antes eram a mesma coisa: quem confirmava o e-mail entrava no curso. Se o
-- paywall reaproveitasse `status`, um aluno inadimplente teria de ser marcado
-- como 'suspended' — e aí ele veria a tela de "conta suspensa", perderia a
-- rota de pagamento e ainda apareceria como punido no painel. Acesso é uma
-- concessão com origem, validade e trilha de auditoria própria.
--
-- O acesso vem de duas fontes:
--   'payment'  — webhook do Mercado Pago aprovou o pedido
--   'courtesy' — o admin liberou sem custo (aluno convidado, bolsa, teste)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.payment_status as enum (
    'pending',      -- criado, aguardando o pagador (PIX gerado, cartão em análise)
    'in_process',   -- em análise antifraude do Mercado Pago
    'approved',     -- dinheiro creditado
    'rejected',     -- recusado (limite, dados, antifraude)
    'cancelled',    -- expirou ou o pagador desistiu
    'refunded',     -- estornado
    'charged_back'  -- contestado pelo titular do cartão
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.access_source as enum ('payment', 'courtesy');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- orders — um pedido por tentativa de compra
--
-- Valores em CENTAVOS (integer). Dinheiro nunca entra como float: 297.00 em
-- double precision vira 296.99999999999994 e a conciliação com o extrato do
-- Mercado Pago passa a divergir por centavos que ninguém consegue explicar.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  -- Cópia do e-mail/nome no momento da compra: o perfil pode mudar depois e a
  -- nota fiscal precisa refletir quem comprou naquele dia.
  email                    text not null,
  full_name                text,

  amount_cents             integer not null check (amount_cents > 0),
  currency                 text not null default 'BRL',
  description              text,

  status                   public.payment_status not null default 'pending',
  provider                 text not null default 'mercadopago',

  -- Checkout Pro: a preferência é o "pedido" do lado do Mercado Pago.
  preference_id            text,
  init_point               text,

  /**
   * A chave que amarra os dois lados. Vai na preferência como
   * `external_reference` e volta em todo webhook: é por ela que o pedido é
   * encontrado, e não pelo payment_id — que só existe DEPOIS que o pagador
   * escolhe o meio de pagamento.
   */
  external_reference       text not null unique,

  payment_id               text,
  payment_type             text,   -- credit_card · debit_card · bank_transfer (PIX)
  payment_method           text,   -- visa · master · pix · elo …
  status_detail            text,   -- motivo da recusa, vindo do Mercado Pago

  installments             integer,
  installment_amount_cents integer,
  -- Com juros do comprador, o total pago é MAIOR que amount_cents. A diferença
  -- é do banco emissor, não sua: por isso os dois campos coexistem.
  total_paid_cents         integer,
  -- Líquido creditado depois da taxa do Mercado Pago.
  net_received_cents       integer,

  paid_at                  timestamptz,
  expires_at               timestamptz,

  raw                      jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists orders_user_idx       on public.orders (user_id);
create index if not exists orders_status_idx     on public.orders (status);
create index if not exists orders_created_idx    on public.orders (created_at desc);
create index if not exists orders_paid_idx       on public.orders (paid_at desc);
create index if not exists orders_preference_idx on public.orders (preference_id);

-- Um mesmo payment_id não pode ser creditado em dois pedidos. Índice parcial
-- porque a coluna nasce nula (o pagamento ainda não existe) e NULL repetido é
-- legítimo aqui.
create unique index if not exists orders_payment_id_uidx
  on public.orders (payment_id) where payment_id is not null;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- access_grants — a concessão de acesso ao curso
-- ---------------------------------------------------------------------------
create table if not exists public.access_grants (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  source         public.access_source not null,
  order_id       uuid references public.orders (id) on delete set null,
  -- Quem liberou. Nulo quando veio do webhook (ninguém liberou, o robô liberou).
  granted_by     uuid references public.profiles (id) on delete set null,
  note           text,
  starts_at      timestamptz not null default now(),
  -- Nulo = vitalício. É o padrão da compra única.
  expires_at     timestamptz,
  revoked_at     timestamptz,
  revoked_reason text,
  created_at     timestamptz not null default now()
);

create index if not exists access_grants_user_idx on public.access_grants (user_id);

/**
 * No máximo UMA concessão viva por aluno.
 *
 * Sem isto, dois cliques no botão de cortesia (ou um webhook reentregue pelo
 * Mercado Pago, o que acontece o tempo todo) criam duas linhas ativas. Revogar
 * o acesso passaria a ser um jogo de apagar linhas até acertar todas, e o
 * histórico de quem pagou o quê ficaria impossível de auditar.
 */
create unique index if not exists access_grants_one_active_uidx
  on public.access_grants (user_id) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- has_course_access — a pergunta que o paywall faz
--
-- Staff nunca é barrada: quem publica a lição precisa abrir a lição. Um admin
-- suspenso, porém, perde tudo — mesma trava da migration 600.
-- ---------------------------------------------------------------------------
create or replace function public.has_course_access(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((
      select p.role in ('admin', 'instructor') and p.status not in ('suspended', 'banned')
        from public.profiles p where p.id = p_user
    ), false)
    or exists (
      select 1 from public.access_grants g
       where g.user_id = p_user
         and g.revoked_at is null
         and g.starts_at <= now()
         and (g.expires_at is null or g.expires_at > now())
    );
$$;

-- ---------------------------------------------------------------------------
-- grant_course_access — concede acesso de forma idempotente
--
-- SECURITY DEFINER e sem checagem de papel de propósito: só é alcançável via
-- service_role (o grant abaixo revoga de authenticated/anon). Quem chama é o
-- webhook, depois de validar a assinatura, ou uma Server Action que já passou
-- por `assertAdmin()`.
-- ---------------------------------------------------------------------------
create or replace function public.grant_course_access(
  p_user       uuid,
  p_source     public.access_source,
  p_order_id   uuid default null,
  p_granted_by uuid default null,
  p_note       text default null,
  p_expires_at timestamptz default null
)
returns public.access_grants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.access_grants;
begin
  -- Já tem acesso vivo: não empilha uma segunda concessão. O webhook do
  -- Mercado Pago reentrega a mesma notificação várias vezes; sem esta saída
  -- antecipada, a segunda entrega estouraria no índice único.
  select * into v_grant
    from public.access_grants
   where user_id = p_user and revoked_at is null
   limit 1;

  if found then
    -- Cortesia que vira compra: registra o pedido que passou a sustentar o
    -- acesso, sem trocar a data de início (o aluno já estava estudando).
    if v_grant.source = 'courtesy' and p_source = 'payment' and p_order_id is not null then
      update public.access_grants
         set source = 'payment', order_id = p_order_id, note = coalesce(p_note, note)
       where id = v_grant.id
       returning * into v_grant;
    end if;
    return v_grant;
  end if;

  insert into public.access_grants (user_id, source, order_id, granted_by, note, expires_at)
  values (p_user, p_source, p_order_id, p_granted_by, p_note, p_expires_at)
  returning * into v_grant;

  return v_grant;
end;
$$;

create or replace function public.revoke_course_access(
  p_user   uuid,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.access_grants
     set revoked_at = now(), revoked_reason = p_reason
   where user_id = p_user and revoked_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
--
-- Aluno LÊ os próprios pedidos e a própria concessão; não escreve nenhum dos
-- dois. Toda escrita passa por service_role (webhook + Server Actions de
-- admin) — é o que impede alguém de dar `insert` num access_grant pelo
-- PostgREST e entrar no curso de graça.
-- ---------------------------------------------------------------------------
alter table public.orders        enable row level security;
alter table public.access_grants enable row level security;

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "orders_admin_write" on public.orders;
create policy "orders_admin_write" on public.orders
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "access_grants_select_own" on public.access_grants;
create policy "access_grants_select_own" on public.access_grants
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "access_grants_admin_write" on public.access_grants;
create policy "access_grants_admin_write" on public.access_grants
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Conteúdo do curso agora exige acesso liberado
--
-- Não basta o paywall na aplicação: sem isto, um aluno logado e sem pagar
-- ainda leria as 728 lições falando direto com o PostgREST, que é uma API
-- pública. As policies abaixo substituem as da migration 100 acrescentando
-- `has_course_access()` ao teste de conta ativa.
-- ---------------------------------------------------------------------------
drop policy if exists "lessons_select_published" on public.lessons;
create policy "lessons_select_published" on public.lessons
  for select to authenticated
  using (
    public.is_staff()
    or (
      is_published
      and public.is_active_account()
      and public.has_course_access()
      and exists (select 1 from public.courses c where c.id = course_id and c.is_published)
    )
  );

drop policy if exists "lesson_resources_select" on public.lesson_resources;
create policy "lesson_resources_select" on public.lesson_resources
  for select to authenticated
  using (
    public.is_staff()
    or (
      public.is_active_account()
      and public.has_course_access()
      and exists (select 1 from public.lessons l where l.id = lesson_id and l.is_published)
    )
  );

drop policy if exists "knowledge_documents_read" on public.knowledge_documents;
create policy "knowledge_documents_read" on public.knowledge_documents
  for select to authenticated
  using (public.is_staff() or (public.is_active_account() and public.has_course_access()));

drop policy if exists "knowledge_chunks_read" on public.knowledge_chunks;
create policy "knowledge_chunks_read" on public.knowledge_chunks
  for select to authenticated
  using (public.is_staff() or (public.is_active_account() and public.has_course_access()));

/**
 * Matrícula também exige acesso. `getOrCreateEnrollment` roda no layout de
 * /app e criaria a matrícula de quem ainda não pagou — deixando lixo no banco
 * e inflando o número de "alunos ativos" do painel.
 */
drop policy if exists "enrollments_own_insert" on public.enrollments;
create policy "enrollments_own_insert" on public.enrollments
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_account() and public.has_course_access());

-- ---------------------------------------------------------------------------
-- Painel financeiro
-- ---------------------------------------------------------------------------
create or replace view public.admin_billing_overview
with (security_invoker = true) as
select
  (select count(*) from public.orders where status = 'approved')                            as paid_orders,
  (select count(*) from public.orders where status in ('pending', 'in_process'))            as pending_orders,
  (select count(*) from public.orders where status = 'rejected')                            as rejected_orders,
  (select count(*) from public.orders where status in ('refunded', 'charged_back'))         as refunded_orders,
  (select coalesce(sum(amount_cents), 0) from public.orders where status = 'approved')      as gross_cents,
  (select coalesce(sum(net_received_cents), 0) from public.orders where status = 'approved') as net_cents,
  (select count(*) from public.orders
    where status = 'approved' and paid_at >= now() - interval '30 days')                    as paid_orders_30d,
  (select coalesce(sum(amount_cents), 0) from public.orders
    where status = 'approved' and paid_at >= now() - interval '30 days')                    as gross_cents_30d,
  (select count(*) from public.access_grants where revoked_at is null)                      as active_grants,
  (select count(*) from public.access_grants where revoked_at is null and source = 'courtesy') as courtesy_grants;

-- ---------------------------------------------------------------------------
-- Permissões
--
-- `grant_course_access` e `revoke_course_access` são SECURITY DEFINER: se
-- ficassem executáveis por `authenticated`, qualquer aluno logado chamaria
-- `rpc('grant_course_access')` com o próprio uuid e entraria sem pagar.
-- ---------------------------------------------------------------------------
revoke all on function public.grant_course_access(uuid, public.access_source, uuid, uuid, text, timestamptz)
  from anon, authenticated, public;
grant execute on function public.grant_course_access(uuid, public.access_source, uuid, uuid, text, timestamptz)
  to service_role;

revoke all on function public.revoke_course_access(uuid, text) from anon, authenticated, public;
grant execute on function public.revoke_course_access(uuid, text) to service_role;

grant execute on function public.has_course_access(uuid) to authenticated, service_role;

revoke all on public.orders        from anon;
revoke all on public.access_grants from anon;
grant select on public.admin_billing_overview to authenticated;

notify pgrst, 'reload schema';
