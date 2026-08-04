-- ===========================================================================
-- InglishEasy: schema completo (arquivo GERADO)
--
-- Não edite este arquivo: ele é a concatenação de supabase/migrations/ na
-- ordem correta. Edite as migrations e rode `npm run db:bundle`.
--
-- COMO USAR: cole tudo no SQL Editor do Supabase e clique em Run.
-- É idempotente: pode rodar mais de uma vez sem duplicar nada.
--
-- Migrations incluídas:
--   1. 20260101000000_init.sql
--   2. 20260101000100_rls.sql
--   3. 20260101000200_storage.sql
--   4. 20260101000300_method.sql
--   5. 20260101000400_fluency.sql
--   6. 20260101000500_local_content.sql
--   7. 20260101000600_auth_hardening.sql
--   8. 20260101000700_billing.sql
-- ===========================================================================


-- ###########################################################################
-- ## 20260101000000_init.sql
-- ###########################################################################

-- ===========================================================================
-- InglishEasy — Schema base
-- Perfis, papeis, catalogo de cursos, trilha de aprendizado, tutor de IA e RAG.
-- ===========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('student', 'instructor', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('pending_verification', 'active', 'suspended', 'banned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.enrollment_status as enum ('active', 'paused', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.progress_status as enum ('not_started', 'in_progress', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lesson_kind as enum (
    'vocabulary', 'grammar', 'listening', 'speaking', 'dialogue', 'review', 'assessment'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cefr_level as enum ('A1', 'A2', 'B1', 'B2', 'C1');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.speaking_status as enum ('uploaded', 'processing', 'completed', 'failed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Helper: updated_at automatico
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — espelho de auth.users com papel e status de conta
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null unique,
  full_name         text,
  avatar_url        text,
  role              public.user_role not null default 'student',
  status            public.account_status not null default 'pending_verification',
  native_language   text not null default 'pt-BR',
  target_level      public.cefr_level not null default 'B1',
  daily_goal_minutes integer not null default 15 check (daily_goal_minutes between 5 and 180),
  timezone          text not null default 'America/Sao_Paulo',
  phone             text,
  bio               text,
  email_verified_at timestamptz,
  onboarded_at      timestamptz,
  last_seen_at      timestamptz,
  suspended_reason  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists profiles_role_idx   on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_email_idx  on public.profiles (lower(email));

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Lista de e-mails promovidos a admin automaticamente no cadastro.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_allowlist (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Funcoes de autorizacao (SECURITY DEFINER para nao recursar nas policies)
-- ---------------------------------------------------------------------------
create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role in ('admin', 'instructor') from public.profiles where id = auth.uid()), false);
$$;

-- Conta ativa = e-mail verificado e nao suspensa/banida.
create or replace function public.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select status = 'active' from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- Provisionamento automatico de perfil quando auth.users recebe um registro
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   public.user_role := 'student';
  v_status public.account_status := 'pending_verification';
begin
  if exists (select 1 from public.admin_allowlist a where lower(a.email) = lower(new.email)) then
    v_role := 'admin';
  end if;

  if new.email_confirmed_at is not null then
    v_status := 'active';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role, status, email_verified_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    v_role,
    v_status,
    new.email_confirmed_at
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ao confirmar o e-mail, a conta sai de pending_verification para active.
create or replace function public.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.profiles
       set status            = case when status = 'pending_verification' then 'active' else status end,
           email_verified_at = new.email_confirmed_at,
           email             = new.email
     where id = new.id;
  elsif new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update on auth.users
  for each row execute function public.handle_user_email_confirmed();

-- ---------------------------------------------------------------------------
-- Catalogo: courses > modules > lessons
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  title          text not null,
  subtitle       text,
  description    text,
  language       text not null default 'en',
  level_from     public.cefr_level not null default 'A1',
  level_to       public.cefr_level not null default 'B2',
  cover_url      text,
  accent_color   text default '#4f46e5',
  duration_days  integer not null default 365 check (duration_days > 0),
  daily_minutes  integer not null default 15 check (daily_minutes > 0),
  is_published   boolean not null default false,
  published_at   timestamptz,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

create table if not exists public.modules (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  position     integer not null,
  code         text not null,
  title        text not null,
  subtitle     text,
  description  text,
  level        public.cefr_level not null default 'A1',
  week_start   integer not null,
  week_end     integer not null,
  objectives   jsonb not null default '[]'::jsonb,
  can_do       jsonb not null default '[]'::jsonb,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (course_id, position),
  check (week_end >= week_start)
);

create index if not exists modules_course_idx on public.modules (course_id, position);

drop trigger if exists modules_set_updated_at on public.modules;
create trigger modules_set_updated_at
  before update on public.modules
  for each row execute function public.set_updated_at();

create table if not exists public.lessons (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references public.courses (id) on delete cascade,
  module_id         uuid not null references public.modules (id) on delete cascade,
  day_number        integer not null check (day_number >= 1),
  /**
   * Circuito ao qual o dia pertence (1..52). O nome é herança da grade antiga;
   * NÃO é semana de calendário. O dia do circuito (1..14) entra na migration
   * 20260101000500 como `circuit_day` — e dia da semana não existe de propósito.
   */
  week_number       integer not null check (week_number >= 1),
  title             text not null,
  subtitle          text,
  kind              public.lesson_kind not null default 'vocabulary',
  level             public.cefr_level not null default 'A1',
  estimated_minutes integer not null default 15,
  objective         text,
  -- Corpo da licao (warm-up, explicacao, exemplos, exercicios) em blocos.
  content           jsonb not null default '{}'::jsonb,
  vocabulary        jsonb not null default '[]'::jsonb,
  phrases           jsonb not null default '[]'::jsonb,
  grammar_focus     text,
  grammar_explanation text,
  listening_script  text,
  speaking_prompt   text,
  speaking_rubric   jsonb not null default '[]'::jsonb,
  quiz              jsonb not null default '[]'::jsonb,
  is_published      boolean not null default false,
  generated_by      text,
  generated_at      timestamptz,
  reviewed_by       uuid references public.profiles (id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (course_id, day_number)
);

create index if not exists lessons_module_idx  on public.lessons (module_id, day_number);
create index if not exists lessons_course_idx  on public.lessons (course_id, day_number);
create index if not exists lessons_pending_idx on public.lessons (course_id) where is_published = false;

drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

create table if not exists public.lesson_resources (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  kind       text not null,
  title      text not null,
  url        text,
  storage_path text,
  meta       jsonb not null default '{}'::jsonb,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists lesson_resources_lesson_idx on public.lesson_resources (lesson_id, position);

-- ---------------------------------------------------------------------------
-- Trilha do aluno
-- ---------------------------------------------------------------------------
create table if not exists public.enrollments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  course_id           uuid not null references public.courses (id) on delete cascade,
  status              public.enrollment_status not null default 'active',
  current_day         integer not null default 1,
  streak_current      integer not null default 0,
  streak_longest      integer not null default 0,
  minutes_total       integer not null default 0,
  lessons_completed   integer not null default 0,
  last_activity_date  date,
  started_at          timestamptz not null default now(),
  target_end_date     date,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists enrollments_user_idx   on public.enrollments (user_id);
create index if not exists enrollments_course_idx on public.enrollments (course_id);

drop trigger if exists enrollments_set_updated_at on public.enrollments;
create trigger enrollments_set_updated_at
  before update on public.enrollments
  for each row execute function public.set_updated_at();

create table if not exists public.lesson_progress (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  lesson_id     uuid not null references public.lessons (id) on delete cascade,
  status        public.progress_status not null default 'not_started',
  score         numeric(5,2),
  quiz_answers  jsonb not null default '[]'::jsonb,
  minutes_spent integer not null default 0,
  attempts      integer not null default 0,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (enrollment_id, lesson_id)
);

create index if not exists lesson_progress_user_idx   on public.lesson_progress (user_id, status);
create index if not exists lesson_progress_lesson_idx on public.lesson_progress (lesson_id);

drop trigger if exists lesson_progress_set_updated_at on public.lesson_progress;
create trigger lesson_progress_set_updated_at
  before update on public.lesson_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tutor de conversacao (audio assincrono)
-- ---------------------------------------------------------------------------
create table if not exists public.speaking_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  course_id      uuid references public.courses (id) on delete set null,
  lesson_id      uuid references public.lessons (id) on delete set null,
  prompt         text not null,
  level          public.cefr_level not null default 'A1',
  audio_path     text not null,
  audio_mime     text not null default 'audio/webm',
  duration_seconds numeric(6,2),
  status         public.speaking_status not null default 'uploaded',
  transcript     text,
  model          text,
  error_message  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists speaking_sessions_user_idx   on public.speaking_sessions (user_id, created_at desc);
create index if not exists speaking_sessions_lesson_idx on public.speaking_sessions (lesson_id);

drop trigger if exists speaking_sessions_set_updated_at on public.speaking_sessions;
create trigger speaking_sessions_set_updated_at
  before update on public.speaking_sessions
  for each row execute function public.set_updated_at();

create table if not exists public.speaking_feedback (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null unique references public.speaking_sessions (id) on delete cascade,
  user_id             uuid not null references public.profiles (id) on delete cascade,
  overall_score       numeric(4,1) not null,
  pronunciation_score numeric(4,1) not null,
  fluency_score       numeric(4,1) not null,
  grammar_score       numeric(4,1) not null,
  vocabulary_score    numeric(4,1) not null,
  task_score          numeric(4,1),
  estimated_level     public.cefr_level,
  corrected_text      text,
  summary_pt          text,
  encouragement_pt    text,
  corrections         jsonb not null default '[]'::jsonb,
  pronunciation_notes jsonb not null default '[]'::jsonb,
  suggested_phrases   jsonb not null default '[]'::jsonb,
  next_steps          jsonb not null default '[]'::jsonb,
  raw                 jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists speaking_feedback_user_idx on public.speaking_feedback (user_id, created_at desc);

-- Conversa por texto com o tutor
create table if not exists public.tutor_threads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  lesson_id  uuid references public.lessons (id) on delete set null,
  title      text not null default 'Nova conversa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tutor_threads_user_idx on public.tutor_threads (user_id, updated_at desc);

drop trigger if exists tutor_threads_set_updated_at on public.tutor_threads;
create trigger tutor_threads_set_updated_at
  before update on public.tutor_threads
  for each row execute function public.set_updated_at();

create table if not exists public.tutor_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.tutor_threads (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  citations  jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tutor_messages_thread_idx on public.tutor_messages (thread_id, created_at);

-- ---------------------------------------------------------------------------
-- Base de conhecimento (RAG com pgvector)
-- ---------------------------------------------------------------------------
create table if not exists public.knowledge_documents (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid references public.courses (id) on delete cascade,
  lesson_id  uuid references public.lessons (id) on delete cascade,
  title      text not null,
  source     text not null default 'lesson',
  checksum   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_documents_course_idx on public.knowledge_documents (course_id);

create table if not exists public.knowledge_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  course_id   uuid references public.courses (id) on delete cascade,
  lesson_id   uuid references public.lessons (id) on delete set null,
  chunk_index integer not null default 0,
  content     text not null,
  metadata    jsonb not null default '{}'::jsonb,
  embedding   vector(768),
  created_at  timestamptz not null default now()
);

create index if not exists knowledge_chunks_document_idx on public.knowledge_chunks (document_id);
create index if not exists knowledge_chunks_course_idx   on public.knowledge_chunks (course_id);
create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding vector_cosine_ops);

-- Busca semantica usada pelo tutor.
create or replace function public.match_knowledge(
  query_embedding vector(768),
  match_count     integer default 6,
  filter_course   uuid default null,
  similarity_floor float default 0.35
)
returns table (
  id uuid,
  lesson_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    kc.id,
    kc.lesson_id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  where kc.embedding is not null
    and (filter_course is null or kc.course_id = filter_course)
    and 1 - (kc.embedding <=> query_embedding) >= similarity_floor
  order by kc.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- ---------------------------------------------------------------------------
-- Auditoria administrativa
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id         bigserial primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  actor_email text,
  action     text not null,
  entity     text not null,
  entity_id  text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_actor_idx   on public.audit_log (actor_id);

-- ---------------------------------------------------------------------------
-- Registro diario de estudo + calculo de ofensiva (streak)
-- ---------------------------------------------------------------------------
create table if not exists public.study_days (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  study_date    date not null,
  minutes       integer not null default 0,
  lessons_done  integer not null default 0,
  goal_met      boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (enrollment_id, study_date)
);

create index if not exists study_days_user_idx on public.study_days (user_id, study_date desc);

-- Registra atividade do dia e recalcula a ofensiva do aluno.
create or replace function public.register_study_activity(
  p_enrollment_id uuid,
  p_minutes       integer default 0,
  p_lessons_done  integer default 0
)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.enrollments;
  v_today      date;
  v_tz         text;
  v_goal       integer;
  v_minutes    integer;
  v_streak     integer;
begin
  select e.* into v_enrollment
    from public.enrollments e
   where e.id = p_enrollment_id
     and (e.user_id = auth.uid() or public.is_admin());

  if v_enrollment.id is null then
    raise exception 'Matricula nao encontrada ou acesso negado';
  end if;

  select p.timezone, p.daily_goal_minutes into v_tz, v_goal
    from public.profiles p where p.id = v_enrollment.user_id;

  v_today := (now() at time zone coalesce(v_tz, 'UTC'))::date;

  insert into public.study_days (user_id, enrollment_id, study_date, minutes, lessons_done, goal_met)
  values (v_enrollment.user_id, p_enrollment_id, v_today, greatest(p_minutes, 0), greatest(p_lessons_done, 0),
          greatest(p_minutes, 0) >= coalesce(v_goal, 15))
  on conflict (enrollment_id, study_date) do update
    set minutes      = public.study_days.minutes + greatest(excluded.minutes, 0),
        lessons_done = public.study_days.lessons_done + greatest(excluded.lessons_done, 0),
        goal_met     = (public.study_days.minutes + greatest(excluded.minutes, 0)) >= coalesce(v_goal, 15)
  returning minutes into v_minutes;

  -- Ofensiva = dias consecutivos com a meta batida, terminando hoje ou ontem.
  -- (Se o aluno ainda nao bateu a meta de hoje, a ofensiva de ontem e preservada;
  --  se o ultimo dia valido for anterior a ontem, a ofensiva foi perdida.)
  with ordered as (
    select study_date,
           row_number() over (order by study_date desc) as rn
      from public.study_days
     where enrollment_id = p_enrollment_id
       and goal_met
       and study_date <= v_today
  ),
  anchor as (
    select study_date as last_day from ordered where rn = 1
  )
  select case
           when (select last_day from anchor) is null          then 0
           when (select last_day from anchor) < v_today - 1    then 0
           else (
             select count(*)::int
               from ordered, anchor
              where ordered.study_date = anchor.last_day - (ordered.rn - 1)
           )
         end
    into v_streak;

  update public.enrollments
     set minutes_total      = minutes_total + greatest(p_minutes, 0),
         lessons_completed  = lessons_completed + greatest(p_lessons_done, 0),
         last_activity_date = v_today,
         streak_current     = coalesce(v_streak, 0),
         streak_longest     = greatest(streak_longest, coalesce(v_streak, 0))
   where id = p_enrollment_id
  returning * into v_enrollment;

  return v_enrollment;
end;
$$;

-- ---------------------------------------------------------------------------
-- Visao consolidada para o dashboard administrativo
-- ---------------------------------------------------------------------------
create or replace view public.admin_overview
with (security_invoker = true) as
select
  (select count(*) from public.profiles)                                             as total_users,
  (select count(*) from public.profiles where status = 'active')                     as active_users,
  (select count(*) from public.profiles where status = 'pending_verification')       as pending_users,
  (select count(*) from public.profiles where status in ('suspended', 'banned'))     as blocked_users,
  (select count(*) from public.profiles where created_at >= now() - interval '30 days') as new_users_30d,
  (select count(*) from public.courses)                                              as total_courses,
  (select count(*) from public.courses where is_published)                           as published_courses,
  (select count(*) from public.lessons)                                              as total_lessons,
  (select count(*) from public.lessons where is_published)                           as published_lessons,
  (select count(*) from public.enrollments where status = 'active')                  as active_enrollments,
  (select count(*) from public.speaking_sessions)                                    as speaking_sessions,
  (select count(*) from public.speaking_sessions where created_at >= now() - interval '7 days') as speaking_sessions_7d,
  (select coalesce(round(avg(overall_score), 2), 0) from public.speaking_feedback)   as avg_speaking_score;

-- O PostgREST mantem um cache da assinatura das funcoes. Sem este reload, a RPC
-- match_knowledge existe no banco mas responde "Could not find the function ...
-- in the schema cache" ate o cache expirar sozinho.
notify pgrst, 'reload schema';


-- ###########################################################################
-- ## 20260101000100_rls.sql
-- ###########################################################################

-- ===========================================================================
-- InglishEasy — Row Level Security
--
-- Regras gerais:
--   * admin      -> acesso total a tudo
--   * instructor -> gerencia catalogo e revisa alunos, sem tocar em papeis
--   * student    -> le apenas conteudo publicado e escreve apenas o proprio dado
--   * conta so acessa conteudo se status = 'active' (e-mail verificado)
-- ===========================================================================

alter table public.profiles            enable row level security;
alter table public.admin_allowlist     enable row level security;
alter table public.courses             enable row level security;
alter table public.modules             enable row level security;
alter table public.lessons             enable row level security;
alter table public.lesson_resources    enable row level security;
alter table public.enrollments         enable row level security;
alter table public.lesson_progress     enable row level security;
alter table public.study_days          enable row level security;
alter table public.speaking_sessions   enable row level security;
alter table public.speaking_feedback   enable row level security;
alter table public.tutor_threads       enable row level security;
alter table public.tutor_messages      enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks    enable row level security;
alter table public.audit_log           enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Trava de escalonamento de privilegio: um usuario comum nao muda o proprio
-- papel nem o proprio status, mesmo passando pela policy de update acima.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Chamadas com service_role (scripts/admin API) tem auth.uid() nulo.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Nao e permitido alterar o proprio papel';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Nao e permitido alterar o proprio status de conta';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ---------------------------------------------------------------------------
-- admin_allowlist — somente admin
-- ---------------------------------------------------------------------------
drop policy if exists "allowlist_admin_all" on public.admin_allowlist;
create policy "allowlist_admin_all" on public.admin_allowlist
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- courses / modules / lessons / resources
-- ---------------------------------------------------------------------------
drop policy if exists "courses_select_published" on public.courses;
create policy "courses_select_published" on public.courses
  for select to authenticated
  using ((is_published and public.is_active_account()) or public.is_staff());

drop policy if exists "courses_staff_write" on public.courses;
create policy "courses_staff_write" on public.courses
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "modules_select_published" on public.modules;
create policy "modules_select_published" on public.modules
  for select to authenticated
  using (
    public.is_staff()
    or (
      is_published
      and public.is_active_account()
      and exists (select 1 from public.courses c where c.id = course_id and c.is_published)
    )
  );

drop policy if exists "modules_staff_write" on public.modules;
create policy "modules_staff_write" on public.modules
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "lessons_select_published" on public.lessons;
create policy "lessons_select_published" on public.lessons
  for select to authenticated
  using (
    public.is_staff()
    or (
      is_published
      and public.is_active_account()
      and exists (select 1 from public.courses c where c.id = course_id and c.is_published)
    )
  );

drop policy if exists "lessons_staff_write" on public.lessons;
create policy "lessons_staff_write" on public.lessons
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "lesson_resources_select" on public.lesson_resources;
create policy "lesson_resources_select" on public.lesson_resources
  for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.lessons l
       where l.id = lesson_id and l.is_published and public.is_active_account()
    )
  );

drop policy if exists "lesson_resources_staff_write" on public.lesson_resources;
create policy "lesson_resources_staff_write" on public.lesson_resources
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- enrollments / progresso / dias de estudo
-- ---------------------------------------------------------------------------
drop policy if exists "enrollments_own_select" on public.enrollments;
create policy "enrollments_own_select" on public.enrollments
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "enrollments_own_insert" on public.enrollments;
create policy "enrollments_own_insert" on public.enrollments
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_account());

drop policy if exists "enrollments_own_update" on public.enrollments;
create policy "enrollments_own_update" on public.enrollments
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "enrollments_admin_delete" on public.enrollments;
create policy "enrollments_admin_delete" on public.enrollments
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "lesson_progress_own" on public.lesson_progress;
create policy "lesson_progress_own" on public.lesson_progress
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "study_days_own" on public.study_days;
create policy "study_days_own" on public.study_days
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Tutor de conversacao
-- ---------------------------------------------------------------------------
drop policy if exists "speaking_sessions_own" on public.speaking_sessions;
create policy "speaking_sessions_own" on public.speaking_sessions
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "speaking_feedback_own_select" on public.speaking_feedback;
create policy "speaking_feedback_own_select" on public.speaking_feedback
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "speaking_feedback_admin_write" on public.speaking_feedback;
create policy "speaking_feedback_admin_write" on public.speaking_feedback
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "tutor_threads_own" on public.tutor_threads;
create policy "tutor_threads_own" on public.tutor_threads
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid());

drop policy if exists "tutor_messages_own" on public.tutor_messages;
create policy "tutor_messages_own" on public.tutor_messages
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Base de conhecimento — leitura para alunos ativos, escrita so por staff
-- ---------------------------------------------------------------------------
drop policy if exists "knowledge_documents_read" on public.knowledge_documents;
create policy "knowledge_documents_read" on public.knowledge_documents
  for select to authenticated
  using (public.is_active_account() or public.is_staff());

drop policy if exists "knowledge_documents_staff_write" on public.knowledge_documents;
create policy "knowledge_documents_staff_write" on public.knowledge_documents
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "knowledge_chunks_read" on public.knowledge_chunks;
create policy "knowledge_chunks_read" on public.knowledge_chunks
  for select to authenticated
  using (public.is_active_account() or public.is_staff());

drop policy if exists "knowledge_chunks_staff_write" on public.knowledge_chunks;
create policy "knowledge_chunks_staff_write" on public.knowledge_chunks
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Auditoria — leitura de admin; escrita apenas via service_role
-- ---------------------------------------------------------------------------
drop policy if exists "audit_log_admin_read" on public.audit_log;
create policy "audit_log_admin_read" on public.audit_log
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Revogacoes explicitas
-- ---------------------------------------------------------------------------
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

revoke all on function public.register_study_activity(uuid, integer, integer) from anon;
grant execute on function public.register_study_activity(uuid, integer, integer) to authenticated;

revoke all on function public.match_knowledge(vector, integer, uuid, float) from anon;
grant execute on function public.match_knowledge(vector, integer, uuid, float) to authenticated, service_role;


-- ###########################################################################
-- ## 20260101000200_storage.sql
-- ###########################################################################

-- ===========================================================================
-- InglishEasy — Buckets de Storage e respectivas policies
-- Convencao de caminho: <bucket>/<user_id>/<arquivo>
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('speaking-audio', 'speaking-audio', false, 26214400,
   array['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/aac']),
  ('avatars', 'avatars', true, 2097152,
   array['image/png', 'image/jpeg', 'image/webp']),
  ('course-assets', 'course-assets', true, 52428800, null)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- speaking-audio (privado): o aluno so enxerga a propria pasta
-- ---------------------------------------------------------------------------
drop policy if exists "speaking_audio_insert_own" on storage.objects;
create policy "speaking_audio_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'speaking-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_account()
  );

drop policy if exists "speaking_audio_select_own" on storage.objects;
create policy "speaking_audio_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'speaking-audio'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );

drop policy if exists "speaking_audio_delete_own" on storage.objects;
create policy "speaking_audio_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'speaking-audio'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- avatars (publico para leitura, escrita restrita ao dono)
-- ---------------------------------------------------------------------------
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_write_own" on storage.objects;
create policy "avatars_write_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------------------------------------------------------------------------
-- course-assets (publico para leitura, escrita restrita a staff)
-- ---------------------------------------------------------------------------
drop policy if exists "course_assets_public_read" on storage.objects;
create policy "course_assets_public_read" on storage.objects
  for select to public
  using (bucket_id = 'course-assets');

drop policy if exists "course_assets_staff_write" on storage.objects;
create policy "course_assets_staff_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'course-assets' and public.is_staff())
  with check (bucket_id = 'course-assets' and public.is_staff());

notify pgrst, 'reload schema';


-- ###########################################################################
-- ## 20260101000300_method.sql
-- ###########################################################################

-- ===========================================================================
-- InglishEasy — Método "Blocos e Situações"
--
-- Reorganiza o curso: em vez de módulos por tempo verbal, o curso passa a ser
-- 4 CANTOS (fases) x 13 CIRCUITOS (situações reais), 1 circuito por semana.
--
-- A unidade de aprendizado deixa de ser a regra gramatical e passa a ser o
-- CHUNK: um bloco de fala pronto, memorizado inteiro e reaproveitado trocando
-- peças. A gramática vira nota de rodapé ("por que funciona assim"), sempre
-- DEPOIS de o aluno já usar o bloco.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- circuits — uma situação real por semana
-- ---------------------------------------------------------------------------
create table if not exists public.circuits (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses (id) on delete cascade,
  module_id     uuid not null references public.modules (id) on delete cascade,
  number        integer not null check (number >= 1),
  title         text not null,
  -- A cena concreta em que o aluno vai usar isso na vida real.
  situation     text not null,
  -- O molde da semana: "Can I have ___?" — o que permite trocar as peças.
  pattern       text,
  pattern_note  text,
  -- Blocos prontos: [{ en, pt, when }]
  chunks        jsonb not null default '[]'::jsonb,
  -- Tarefa fora do app, no dia 7.
  mission       text,
  -- Trilha de mentalidade: hábito, vergonha de falar, consistência.
  mindset_note  text,
  -- Erro típico de brasileiro que este circuito ataca de frente.
  pitfall       text,
  -- Circuitos revisados na revisão espaçada do dia 6.
  review_circuits integer[] not null default '{}',
  level         public.cefr_level not null default 'A1',
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (course_id, number)
);

create index if not exists circuits_course_idx on public.circuits (course_id, number);
create index if not exists circuits_module_idx on public.circuits (module_id, number);

drop trigger if exists circuits_set_updated_at on public.circuits;
create trigger circuits_set_updated_at
  before update on public.circuits
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lessons — campos do novo método
-- ---------------------------------------------------------------------------
alter table public.lessons
  add column if not exists circuit_id   uuid references public.circuits (id) on delete set null,
  -- Blocos prontos trabalhados no dia: [{ en, pt, when }]
  add column if not exists chunks       jsonb not null default '[]'::jsonb,
  add column if not exists situation    text,
  add column if not exists pattern      text,
  add column if not exists mission      text,
  add column if not exists mindset_note text,
  -- Áudio de imersão: o aluno OUVE antes de ler (dia 1).
  add column if not exists immersion_script text,
  -- IDs de lições cujos chunks voltam na revisão espaçada deste dia.
  add column if not exists review_of    integer[] not null default '{}';

-- O índice por (circuit_id, circuit_day) entra na migration 20260101000500,
-- junto com a própria coluna `circuit_day`.
create index if not exists lessons_circuit_only_idx on public.lessons (circuit_id);

-- `grammar_focus` e `grammar_explanation` continuam existindo, mas mudam de
-- papel: agora são a nota curta "por que funciona assim", opcional, exibida
-- só depois de o bloco já ter sido praticado. Nunca titulam uma lição.
comment on column public.lessons.grammar_focus is
  'Nota curta "por que funciona assim" — nunca é o título nem o organizador da lição';
comment on column public.lessons.chunks is
  'Blocos de fala prontos trabalhados no dia: [{ en, pt, when }]';

-- ---------------------------------------------------------------------------
-- Os 7 papéis do dia reaproveitam o enum lesson_kind que já existe — não há
-- ALTER TYPE aqui de propósito, porque `alter type ... add value` não pode ser
-- usado no mesmo bloco transacional que o cria. O mapeamento é:
--
--   dia 1  Imersão            -> listening
--   dia 2  Blocos na boca     -> vocabulary
--   dia 3  Troca de peças     -> grammar
--   dia 4  Escuta ativa       -> dialogue
--   dia 5  Sua vez            -> speaking
--   dia 6  Revisão espaçada   -> review
--   dia 7  Missão real        -> assessment
--
-- Os rótulos exibidos ficam em src/lib/learning.ts (DAY_ROLE).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- RLS — mesma regra do catálogo: aluno ativo lê o publicado, staff escreve
-- ---------------------------------------------------------------------------
alter table public.circuits enable row level security;

drop policy if exists "circuits_select_published" on public.circuits;
create policy "circuits_select_published" on public.circuits
  for select to authenticated
  using (
    public.is_staff()
    or (
      is_published
      and public.is_active_account()
      and exists (select 1 from public.courses c where c.id = course_id and c.is_published)
    )
  );

drop policy if exists "circuits_staff_write" on public.circuits;
create policy "circuits_staff_write" on public.circuits
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

notify pgrst, 'reload schema';


-- ###########################################################################
-- ## 20260101000400_fluency.sql
-- ###########################################################################

-- ===========================================================================
-- InglishEasy — Do "se vira" à conversa livre
--
-- Esta migration existe porque 91 horas (15 min x 365 dias) não levam ninguém
-- a conversar sobre qualquer assunto com um nativo. As estimativas sérias
-- ficam na casa das 600-700 horas até B2.
--
-- O que muda:
--   1. TRILHAS DE RITMO. O curso passa a ter 3 ritmos com metas honestas.
--      O conteúdo é o mesmo; o que muda é quanto se faz por dia.
--   2. CIRCUITO DE 14 DIAS. A fase A (dias 1-7) adquire, a fase B (dias 8-14) consolida e aplica.
--      52 circuitos x 14 dias = 728 dias (2 anos).
--   3. REPETIÇÃO ESPAÇADA DE VERDADE. Cada chunk vira um item com agenda
--      individual por aluno (SM-2), não um rótulo no dia 6.
--   4. (o áudio saiu daqui: é sintetizado no navegador — ver migration 500)
--   5. CONVERSA AO VIVO. Sessões de voz em tempo real, registradas e avaliadas.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Trilhas de ritmo
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.study_track as enum ('essential', 'complete', 'intensive');
exception when duplicate_object then null; end $$;

alter table public.enrollments
  add column if not exists track public.study_track not null default 'complete';

alter table public.profiles
  add column if not exists preferred_track public.study_track not null default 'complete';

/**
 * Metas honestas por trilha. É daqui que a UI tira o que promete ao aluno —
 * nunca de um número inventado na landing page.
 */
create table if not exists public.track_targets (
  track            public.study_track primary key,
  label            text not null,
  daily_minutes    integer not null,
  total_hours      integer not null,
  cefr_target      public.cefr_level not null,
  promise          text not null,
  honest_limit     text not null
);

insert into public.track_targets (track, label, daily_minutes, total_hours, cefr_target, promise, honest_limit)
values
  ('essential', 'Essencial', 20, 243, 'A2',
   'Você se vira sozinho no dia a dia: pedir, resolver, se apresentar, falar de você.',
   'Não é fluência. Numa roda de americanos falando rápido entre si, você ainda vai perder o fio.'),
  ('complete', 'Completo', 60, 728, 'B2',
   'Você conversa sobre qualquer assunto com um nativo, sem ele precisar desacelerar por você.',
   'Ainda vai escapar gíria regional muito específica e humor de nicho — como escapa para qualquer estrangeiro.'),
  ('intensive', 'Intensivo', 100, 1213, 'C1',
   'Você discute, argumenta e trabalha em inglês com naturalidade, inclusive em grupo.',
   'Exige 1h40 por dia, todo dia. A maioria das pessoas não sustenta esse ritmo — e tudo bem.')
on conflict (track) do update
  set label = excluded.label,
      daily_minutes = excluded.daily_minutes,
      total_hours = excluded.total_hours,
      cefr_target = excluded.cefr_target,
      promise = excluded.promise,
      honest_limit = excluded.honest_limit;

-- ---------------------------------------------------------------------------
-- 2. Circuito de 14 dias + input autêntico
-- ---------------------------------------------------------------------------
alter table public.circuits
  -- O que a fase B (consolidação) faz com a situação da fase A.
  add column if not exists week_b_focus text,
  -- Material real do mundo, não do curso: [{ kind, title, url, why, minutes }]
  add column if not exists authentic_input jsonb not null default '[]'::jsonb,
  -- Roteiro da conversa ao vivo deste circuito.
  add column if not exists live_prompt text;

alter table public.lessons
  -- 'A' = aquisição (dias 1-7) · 'B' = consolidação (dias 8-14)
  add column if not exists phase char(1) not null default 'A',
  -- Atividades extras liberadas conforme a trilha do aluno.
  -- { shadowing: {...}, authentic_input: [...], live_prompt: "...", srs_target: n }
  add column if not exists extensions jsonb not null default '{}'::jsonb,
  -- Minutos do núcleo (comum a todas as trilhas) vs total com extensões.
  add column if not exists core_minutes integer not null default 15;

create index if not exists lessons_phase_idx on public.lessons (course_id, phase, day_number);

-- ---------------------------------------------------------------------------
-- 3. Repetição espaçada por chunk (SM-2)
-- ---------------------------------------------------------------------------
create table if not exists public.chunk_mastery (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  course_id      uuid not null references public.courses (id) on delete cascade,
  circuit_number integer not null,
  /** Identidade estável do bloco: slug do texto em inglês. */
  chunk_key      text not null,
  chunk_en       text not null,
  chunk_pt       text not null,
  -- Estado do SM-2
  ease_factor    numeric(4,2) not null default 2.50 check (ease_factor >= 1.30),
  interval_days  integer not null default 0,
  repetitions    integer not null default 0,
  lapses         integer not null default 0,
  due_date       date not null default current_date,
  last_grade     integer,
  last_reviewed_at timestamptz,
  -- Quantas vezes o aluno já PRODUZIU este bloco falando (não só reconheceu).
  spoken_count   integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, chunk_key)
);

create index if not exists chunk_mastery_due_idx  on public.chunk_mastery (user_id, due_date);
create index if not exists chunk_mastery_circ_idx on public.chunk_mastery (user_id, circuit_number);

drop trigger if exists chunk_mastery_set_updated_at on public.chunk_mastery;
create trigger chunk_mastery_set_updated_at
  before update on public.chunk_mastery
  for each row execute function public.set_updated_at();

/**
 * Matricula os chunks de um circuito na agenda do aluno.
 * Idempotente: rodar de novo não zera o progresso de quem já revisou.
 */
create or replace function public.enroll_circuit_chunks(
  p_course_id      uuid,
  p_circuit_number integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;

  insert into public.chunk_mastery (user_id, course_id, circuit_number, chunk_key, chunk_en, chunk_pt)
  select
    v_user,
    p_course_id,
    c.number,
    -- slug estável: minúsculas, só letras/números/hífen
    regexp_replace(lower(trim(chunk ->> 'en')), '[^a-z0-9]+', '-', 'g'),
    chunk ->> 'en',
    coalesce(chunk ->> 'pt', '')
  from public.circuits c,
       lateral jsonb_array_elements(c.chunks) as chunk
  where c.course_id = p_course_id
    and c.number = p_circuit_number
    and coalesce(trim(chunk ->> 'en'), '') <> ''
  on conflict (user_id, chunk_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

/**
 * Aplica uma revisão SM-2 a um chunk.
 * grade 0-5: <3 é falha (reinicia o intervalo), >=3 é acerto.
 */
create or replace function public.review_chunk(
  p_chunk_key text,
  p_grade     integer
)
returns public.chunk_mastery
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  public.chunk_mastery;
  v_ef   numeric(4,2);
  v_int  integer;
  v_reps integer;
begin
  select * into v_row
    from public.chunk_mastery
   where user_id = auth.uid() and chunk_key = p_chunk_key;

  if v_row.id is null then
    raise exception 'Chunk % não está na sua agenda', p_chunk_key;
  end if;

  if p_grade < 0 or p_grade > 5 then
    raise exception 'Nota deve estar entre 0 e 5';
  end if;

  -- Fator de facilidade do SM-2
  v_ef := greatest(
    1.30,
    v_row.ease_factor + (0.10 - (5 - p_grade) * (0.08 + (5 - p_grade) * 0.02))
  );

  if p_grade < 3 then
    -- Errou: volta para o começo, mas o EF penalizado permanece.
    v_reps := 0;
    v_int  := 1;
  else
    v_reps := v_row.repetitions + 1;
    v_int := case
               when v_reps = 1 then 1
               when v_reps = 2 then 6
               else greatest(1, round(v_row.interval_days * v_ef)::integer)
             end;
  end if;

  update public.chunk_mastery
     set ease_factor      = v_ef,
         repetitions      = v_reps,
         interval_days    = v_int,
         lapses           = v_row.lapses + case when p_grade < 3 then 1 else 0 end,
         due_date         = current_date + v_int,
         last_grade       = p_grade,
         last_reviewed_at = now()
   where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

/** Marca que o aluno PRODUZIU o bloco falando — vale mais que reconhecer. */
create or replace function public.mark_chunks_spoken(p_chunk_keys text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.chunk_mastery
     set spoken_count = spoken_count + 1
   where user_id = auth.uid()
     and chunk_key = any(p_chunk_keys);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Áudio
--
-- Não há tabela de áudio. A fala do curso é sintetizada no navegador a partir
-- do texto que já está em `lessons.immersion_script`, `lessons.listening_script`
-- e `lessons.chunks` — sem arquivo para armazenar e sem API envolvida.
-- Ver src/lib/speech.ts.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 5. Conversa ao vivo
-- ---------------------------------------------------------------------------
create table if not exists public.live_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  course_id      uuid references public.courses (id) on delete set null,
  lesson_id      uuid references public.lessons (id) on delete set null,
  circuit_number integer,
  scenario       text,
  model          text,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  duration_seconds integer not null default 0,
  turns          integer not null default 0,
  /** [{ role: 'user'|'model', text, at }] */
  transcript     jsonb not null default '[]'::jsonb,
  summary_pt     text,
  /** Mesma escala das gravações assíncronas, para o progresso ser comparável. */
  scores         jsonb,
  chunks_used    text[] not null default '{}',
  created_at     timestamptz not null default now()
);

create index if not exists live_sessions_user_idx on public.live_sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
alter table public.track_targets  enable row level security;
alter table public.chunk_mastery  enable row level security;
alter table public.live_sessions  enable row level security;

drop policy if exists "track_targets_read" on public.track_targets;
create policy "track_targets_read" on public.track_targets
  for select to authenticated using (true);

drop policy if exists "track_targets_admin_write" on public.track_targets;
create policy "track_targets_admin_write" on public.track_targets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "chunk_mastery_own" on public.chunk_mastery;
create policy "chunk_mastery_own" on public.chunk_mastery
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid());

drop policy if exists "live_sessions_own" on public.live_sessions;
create policy "live_sessions_own" on public.live_sessions
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid());

revoke all on function public.enroll_circuit_chunks(uuid, integer) from anon;
grant execute on function public.enroll_circuit_chunks(uuid, integer) to authenticated;
revoke all on function public.review_chunk(text, integer) from anon;
grant execute on function public.review_chunk(text, integer) to authenticated;
revoke all on function public.mark_chunks_spoken(text[]) from anon;
grant execute on function public.mark_chunks_spoken(text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Visão do dia: quantos chunks estão vencidos para revisar
-- ---------------------------------------------------------------------------
create or replace view public.chunk_review_queue
with (security_invoker = true) as
select
  user_id,
  count(*) filter (where due_date <= current_date)                as due_today,
  count(*) filter (where due_date <= current_date + 1)            as due_tomorrow,
  count(*)                                                        as total_chunks,
  count(*) filter (where repetitions >= 3 and ease_factor >= 2.3) as mastered,
  count(*) filter (where lapses >= 3)                             as struggling
from public.chunk_mastery
group by user_id;

notify pgrst, 'reload schema';


-- ###########################################################################
-- ## 20260101000500_local_content.sql
-- ###########################################################################

-- ===========================================================================
-- InglishEasy — Dias soltos do calendário + conteúdo 100% local
--
-- Duas mudanças de rumo:
--
--   1. O DIA DEIXA DE SER DIA DA SEMANA. O cronograma não é "segunda a
--      domingo": é "Dia 1, Dia 2, Dia 3…". Quem começa numa quinta-feira não
--      pode receber a lição de sexta como se fosse a segunda aula. A coluna
--      `weekday` (1..7) sai e entra `circuit_day` (1..14), que é o que
--      realmente importa — a posição do dia DENTRO do circuito.
--
--   2. O ÁUDIO SAI DA API. As lições e os áudios passam a ser conteúdo local,
--      escrito e versionado no repositório; a fala é sintetizada no próprio
--      navegador (Web Speech API). Não sobra nada para a tabela `lesson_audio`
--      guardar, então ela sai junto com o bucket.
--
-- Idempotente: pode rodar em banco novo ou em banco que já tem as migrations
-- anteriores aplicadas.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Dia do circuito no lugar do dia da semana
-- ---------------------------------------------------------------------------
alter table public.lessons
  add column if not exists circuit_day integer not null default 1;

do $$ begin
  alter table public.lessons
    add constraint lessons_circuit_day_range check (circuit_day between 1 and 14);
exception when duplicate_object then null; end $$;

/**
 * Backfill para bancos que já tinham lições: o dia do circuito é a posição
 * dentro do bloco de 14. Vale tanto para a grade antiga quanto para a nova.
 */
update public.lessons
   set circuit_day = ((day_number - 1) % 14) + 1
 where circuit_day = 1
   and day_number > 1;

drop index if exists public.lessons_circuit_idx;
create index if not exists lessons_circuit_idx
  on public.lessons (circuit_id, circuit_day);

alter table public.lessons drop column if exists weekday;

-- ---------------------------------------------------------------------------
-- 2. Áudio deixa de ser gerado por API
--
-- A fala do curso é sintetizada no navegador a partir do texto da lição, que
-- já está no banco. Não há arquivo para cachear nem chave de API envolvida.
-- ---------------------------------------------------------------------------
drop table if exists public.lesson_audio cascade;
drop type if exists public.audio_kind;

drop policy if exists "lesson_audio_public_read" on storage.objects;
drop policy if exists "lesson_audio_staff_upload" on storage.objects;

/**
 * O bucket sai, mas com cuidado.
 *
 * O Supabase instala um trigger (`storage.protect_delete`) que RECUSA
 * `delete from storage.objects` — apagar arquivo só pela Storage API. E como o
 * SQL Editor roda o script inteiro numa transação, um erro aqui reverteria
 * TODAS as migrations acima.
 *
 * Por isso: nunca tocamos em `storage.objects`, e a remoção do bucket vai
 * dentro de um bloco que engole a falha. Se o bucket tiver arquivos, ele
 * simplesmente permanece — inofensivo, já que nada mais aponta para ele.
 */
do $$ begin
  delete from storage.buckets where id = 'lesson-audio';
exception when others then
  raise notice 'Bucket "lesson-audio" não removido (%). Se ele existir e incomodar, apague em Storage no painel.', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Slug do bloco: alinhar SQL e TypeScript
--
-- A versão anterior de `enroll_circuit_chunks` gerava "hi-i-m-ana-" (com hífen
-- no fim, vindo do ponto final), enquanto `chunkKey()` em src/lib/srs.ts gera
-- "hi-i-m-ana". Resultado: `mark_chunks_spoken` nunca casava nenhum bloco e o
-- contador de produção falada ficava eternamente em zero — em silêncio.
--
-- Aqui as duas pontas passam a usar exatamente a mesma regra.
-- ---------------------------------------------------------------------------
create or replace function public.enroll_circuit_chunks(
  p_course_id      uuid,
  p_circuit_number integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;

  insert into public.chunk_mastery (user_id, course_id, circuit_number, chunk_key, chunk_en, chunk_pt)
  select
    v_user,
    p_course_id,
    c.number,
    -- minúsculas, só letras/números/hífen, SEM hífen nas pontas
    trim(both '-' from regexp_replace(lower(trim(chunk ->> 'en')), '[^a-z0-9]+', '-', 'g')),
    chunk ->> 'en',
    coalesce(chunk ->> 'pt', '')
  from public.circuits c,
       lateral jsonb_array_elements(c.chunks) as chunk
  where c.course_id = p_course_id
    and c.number = p_circuit_number
    and coalesce(trim(chunk ->> 'en'), '') <> ''
  on conflict (user_id, chunk_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.enroll_circuit_chunks(uuid, integer) from anon;
grant execute on function public.enroll_circuit_chunks(uuid, integer) to authenticated;

/** Corrige as chaves já gravadas com hífen sobrando. */
update public.chunk_mastery
   set chunk_key = trim(both '-' from chunk_key)
 where chunk_key <> trim(both '-' from chunk_key)
   and not exists (
     select 1 from public.chunk_mastery other
      where other.user_id = chunk_mastery.user_id
        and other.chunk_key = trim(both '-' from chunk_mastery.chunk_key)
   );

-- ---------------------------------------------------------------------------
-- 4. Procedência do conteúdo
--
-- `generated_by` guardava "gemini:<modelo>". Agora todo o conteúdo é redigido
-- e versionado no repositório, então o valor passa a ser 'authored'.
-- ---------------------------------------------------------------------------
update public.lessons
   set generated_by = 'authored'
 where generated_by is null
    or generated_by like 'gemini:%'
    or generated_by = 'handwritten';

notify pgrst, 'reload schema';


-- ###########################################################################
-- ## 20260101000600_auth_hardening.sql
-- ###########################################################################

-- ===========================================================================
-- InglishEasy — Duas brechas fechadas no banco
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


-- ###########################################################################
-- ## 20260101000700_billing.sql
-- ###########################################################################

-- ===========================================================================
-- InglishEasy — Cobrança no cadastro (Mercado Pago) e liberação de acesso
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
