-- ===========================================================================
-- Easy English: schema completo (arquivo GERADO)
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
--   9. 20260101000800_paywall_hardening.sql
--   10. 20260101000900_profile_hardening.sql
--   11. 20260101001000_certificates.sql
--   12. 20260101001100_certificate_min_score.sql
--   13. 20260101001200_grant_hardening.sql
--   14. 20260101001300_course_audio_bucket.sql
--   15. 20260101001400_espinha.sql
-- ===========================================================================


-- ###########################################################################
-- ## 20260101000000_init.sql
-- ###########################################################################

-- ===========================================================================
-- Easy English — Schema base
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
-- Easy English — Row Level Security
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
-- Easy English — Buckets de Storage e respectivas policies
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
-- Easy English — Método "Blocos e Situações"
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
-- Easy English — Do "se vira" à conversa livre
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
-- Easy English — Dias soltos do calendário + conteúdo 100% local
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


-- ###########################################################################
-- ## 20260101000700_billing.sql
-- ###########################################################################

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


-- ###########################################################################
-- ## 20260101000800_paywall_hardening.sql
-- ###########################################################################

-- ===========================================================================
-- Easy English — Fechando o paywall onde ele ainda vazava
--
-- Achado por teste de invasão contra o banco de produção
-- (`npm run check:seguranca`): um aluno com conta grátis, e-mail confirmado e
-- NENHUM pagamento conseguia extrair o conteúdo do curso por dois caminhos.
--
-- A migration 700 fechou `lessons`, `lesson_resources` e `knowledge_*`, mas
-- parou aí. O conteúdo, porém, não mora só nas lições.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. circuits — 364 blocos de fala abertos para qualquer cadastro
--
-- `circuits.chunks` É o produto. O método inteiro está escrito na migration
-- 300: "a unidade de aprendizado deixa de ser a regra gramatical e passa a ser
-- o CHUNK". A policy antiga exigia apenas conta ativa, então um `GET` no
-- PostgREST com a anon key (que é pública, vai no JavaScript de toda página)
-- mais um cadastro grátis devolvia os 52 circuitos inteiros: blocos, padrões,
-- missões e armadilhas.
-- ---------------------------------------------------------------------------
drop policy if exists "circuits_select_published" on public.circuits;
create policy "circuits_select_published" on public.circuits
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

-- ---------------------------------------------------------------------------
-- 2. enroll_circuit_chunks — a porta dos fundos para o mesmo conteúdo
--
-- Fechar a policy acima, sozinho, não resolveria nada.
--
-- Esta função é SECURITY DEFINER (roda como dona da tabela, portanto IGNORA
-- RLS) e está liberada para `authenticated`. Ela lê `circuits.chunks` e grava
-- `chunk_en`/`chunk_pt` em `chunk_mastery` — que o próprio aluno pode ler,
-- porque é a agenda dele.
--
-- Ou seja: bastava chamar a RPC 52 vezes, uma por circuito, e depois um
-- `select * from chunk_mastery` para levar o curso embora, com a policy de
-- circuits impecável. Toda função SECURITY DEFINER precisa repetir por conta
-- própria a autorização que a RLS faria por ela.
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

  if not public.has_course_access(v_user) then
    raise exception 'Acesso ao curso não liberado';
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

-- ---------------------------------------------------------------------------
-- 3. chunk_mastery — trava também na escrita direta
--
-- Camada extra: mesmo que apareça uma terceira rota para popular a agenda, um
-- `insert` vindo do PostgREST agora exige acesso liberado. Não afeta o app: as
-- únicas escritas passam pelas RPCs, que são SECURITY DEFINER.
-- ---------------------------------------------------------------------------
drop policy if exists "chunk_mastery_own" on public.chunk_mastery;
create policy "chunk_mastery_own" on public.chunk_mastery
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() and public.has_course_access());

-- ---------------------------------------------------------------------------
-- 4. Storage de áudio — hospedagem grátis para quem não pagou
--
-- A policy de upload exigia só conta ativa. Como o bucket aceita 25 MB por
-- arquivo, qualquer pessoa que criasse conta ganhava armazenamento ilimitado
-- na sua fatura do Supabase — sem nunca abrir uma lição.
--
-- A rota que sobe o áudio (`/api/speaking/analyze`) já exige pagamento desde a
-- migration anterior; isto fecha o acesso direto ao Storage, que não passa por
-- ela.
-- ---------------------------------------------------------------------------
drop policy if exists "speaking_audio_insert_own" on storage.objects;
create policy "speaking_audio_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'speaking-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_account()
    and public.has_course_access()
  );

-- ---------------------------------------------------------------------------
-- 5. live_sessions — mesma regra na escrita
-- ---------------------------------------------------------------------------
drop policy if exists "live_sessions_own" on public.live_sessions;
create policy "live_sessions_own" on public.live_sessions
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() and public.has_course_access());

drop policy if exists "speaking_sessions_own" on public.speaking_sessions;
create policy "speaking_sessions_own" on public.speaking_sessions
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check ((user_id = auth.uid() and public.has_course_access()) or public.is_admin());

/**
 * `courses` e `modules` FICAM abertos de propósito.
 *
 * Título, descrição, objetivos e "ao final deste canto você consegue" são
 * exatamente o texto que já está na página de vendas, visível para quem nem
 * conta tem. Trancá-los não protegeria nada e ainda quebraria qualquer tela de
 * catálogo antes da compra.
 */

notify pgrst, 'reload schema';


-- ###########################################################################
-- ## 20260101000900_profile_hardening.sql
-- ###########################################################################

-- ===========================================================================
-- Easy English — Perfil: a foto sai da linha, o fuso deixa de matar a ofensiva
--
-- Dois problemas achados na revisão da tela de Perfil. Nenhum deles é brecha de
-- segurança: são custo silencioso e perda silenciosa de dados.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. avatar_url volta a ser o que o nome diz: uma URL
--
-- A tela gravava o data URL base64 inteiro (~40-60 KB de texto) DENTRO da
-- coluna. E `getSessionContext()` faz `select *` em profiles a cada requisição
-- autenticada, então essa foto viajava em toda navegação, toda Server Action e
-- toda rota de API — além de ser reimpressa inline no HTML de cada página, onde
-- nenhum CDN consegue cachear.
--
-- O bucket `avatars` já existia desde a migration 200 (público, limite de 2 MB,
-- policies de dono corretas) e nunca tinha sido usado.
--
-- ⚠️  O update abaixo APAGA as fotos que já estão em base64. Não há como
--     convertê-las para o Storage por SQL — quem já tinha foto precisa subir de
--     novo, uma vez. É a única perda desta migration, e é de propósito: manter
--     as linhas antigas significaria manter o custo por requisição para sempre.
-- ---------------------------------------------------------------------------
-- Limpa TUDO que a constraint abaixo rejeitaria, não só os data URLs. Um
-- `alter table` que falha no meio por causa de uma linha inesperada deixaria a
-- migration pela metade; assim ela roda igual em qualquer estado do banco.
update public.profiles
   set avatar_url = null
 where avatar_url is not null
   and (avatar_url !~ '^https://' or length(avatar_url) > 512);

alter table public.profiles
  drop constraint if exists profiles_avatar_url_check;

/**
 * A trava vale para o PostgREST também, não só para a Server Action.
 *
 * A policy `profiles_update_own` permite ao aluno editar a própria linha, então
 * validar apenas no servidor Next não fecha nada: bastava um PATCH direto com a
 * anon key para gravar uma string de qualquer tamanho. O limite de 512 é folga
 * larga para uma URL pública do Storage (~120 caracteres).
 *
 * Exige https:// porque hoje os dois únicos caminhos que escrevem aqui são o
 * upload para o bucket (público, https) e `handle_new_user`, que copia
 * `raw_user_meta_data->>'avatar_url'` — sempre nulo no cadastro por e-mail.
 * Se um dia entrar login social, confira o formato que o provedor devolve antes
 * de ligar, senão o cadastro quebra aqui.
 */
-- `add constraint` não tem "if not exists" em Postgres, e sem a guarda este
-- arquivo falha na segunda aplicação. O `do $$ ... exception` é o mesmo padrão
-- que a migration 000500 já usa para o check de `circuit_day`.
do $$ begin
  alter table public.profiles
    add constraint profiles_avatar_url_check
    check (
      avatar_url is null
      or (avatar_url ~ '^https://' and length(avatar_url) <= 512)
    );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Fuso horário inválido não pode mais parar a ofensiva
--
-- `register_study_activity` fazia `now() at time zone v_tz`. Com um fuso que o
-- Postgres não reconhece, isso levanta exceção — e quem chama a função
-- (`completeLessonAction`) só faz `console.error` e segue em frente.
--
-- O efeito era o pior possível: a lição continuava marcando como concluída, mas
-- minutos, meta batida, ofensiva e última atividade paravam de ser gravados
-- PARA SEMPRE, sem nenhum sinal para o aluno nem erro na tela.
--
-- O formulário agora manda um enum fechado, mas a Server Action é um endpoint
-- público como qualquer outro: a garantia tem que estar aqui embaixo também.
-- Fuso desconhecido cai no horário de Brasília em vez de derrubar a função.
-- ---------------------------------------------------------------------------
create or replace function public.safe_timezone(p_tz text)
returns text
language sql
stable
set search_path = public
as $$
  select case
           when p_tz is not null
            and exists (select 1 from pg_timezone_names z where z.name = p_tz)
           then p_tz
           else 'America/Sao_Paulo'
         end;
$$;

grant execute on function public.safe_timezone(text) to authenticated, service_role;

-- Mesma função da migration 000, com uma linha trocada: `v_tz` agora passa por
-- `safe_timezone()`. O resto é idêntico.
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

  v_today := (now() at time zone public.safe_timezone(v_tz))::date;

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

-- Conserta quem já esteja com um fuso que o Postgres não reconhece: sem isto,
-- a função passaria a funcionar mas o aluno seguiria em Brasília sem saber.
update public.profiles
   set timezone = 'America/Sao_Paulo'
 where not exists (select 1 from pg_timezone_names z where z.name = profiles.timezone);

notify pgrst, 'reload schema';


-- ###########################################################################
-- ## 20260101001000_certificates.sql
-- ###########################################################################

-- ===========================================================================
-- Migration: 20260101001000_certificates.sql
-- Sistema de Certificados de Conclusão com Validação Criptográfica (HMAC-SHA256)
-- ===========================================================================

create table if not exists public.certificates (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  course_id         uuid not null references public.courses (id) on delete cascade,
  enrollment_id     uuid references public.enrollments (id) on delete cascade,
  code              text not null unique,
  hash_signature    text not null,
  student_name      text not null,
  course_title      text not null,
  workload_hours    integer not null check (workload_hours > 0),
  average_score     numeric(4,2) not null default 10.0,
  completed_at      timestamptz not null default now(),
  issued_at         timestamptz not null default now(),
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists certificates_code_idx on public.certificates (code);
create index if not exists certificates_user_idx on public.certificates (user_id);
create index if not exists certificates_course_idx on public.certificates (course_id);

drop trigger if exists certificates_set_updated_at on public.certificates;
create trigger certificates_set_updated_at
  before update on public.certificates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: Security Policies
-- ---------------------------------------------------------------------------
alter table public.certificates enable row level security;

-- `drop ... if exists` antes de cada uma: `create policy` não aceita
-- "se não existir", e sem o drop este arquivo falha na segunda vez que for
-- aplicado — que é como ele é usado, porque `supabase/schema.sql` junta todas
-- as migrations e a instrução do projeto é colar o arquivo inteiro no SQL
-- Editor. As outras 65 policies do schema já seguiam este padrão; estas três
-- eram a exceção, e derrubavam a aplicação inteira antes de chegar ao fim.

-- Aluno pode visualizar seus próprios certificados
drop policy if exists certificates_select_own on public.certificates;
create policy certificates_select_own on public.certificates
  for select using (auth.uid() = user_id);

-- Admins têm acesso total
drop policy if exists certificates_admin_all on public.certificates;
create policy certificates_admin_all on public.certificates
  for all using (
    exists (
      select 1 from public.profiles
       where profiles.id = auth.uid()
         and profiles.role = 'admin'
    )
  );

-- Leitura pública (para qualquer visitante verificar por código)
drop policy if exists certificates_select_public_code on public.certificates;
create policy certificates_select_public_code on public.certificates
  for select using (true);


-- ###########################################################################
-- ## 20260101001100_certificate_min_score.sql
-- ###########################################################################

-- ===========================================================================
-- Migration: 20260101001100_certificate_min_score.sql
-- Nota minima de emissao do certificado, configuravel por curso
--
-- Antes o corte ficava fixo em 7.0 dentro do codigo: mudar exigia deploy.
-- Agora e coluna do curso e o admin ajusta pelo painel de certificados.
-- ===========================================================================

alter table public.courses
  add column if not exists min_certificate_score numeric(3,1) not null default 7.0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'courses_min_certificate_score_range'
  ) then
    alter table public.courses
      add constraint courses_min_certificate_score_range
      check (min_certificate_score >= 0 and min_certificate_score <= 10);
  end if;
end $$;

comment on column public.courses.min_certificate_score is
  'Media minima nas avaliacoes de fala exigida para emitir o certificado (0 a 10).';


-- ###########################################################################
-- ## 20260101001200_grant_hardening.sql
-- ###########################################################################

-- ===========================================================================
-- Easy English — fecha o EXECUTE que ficou aberto por PUBLIC
-- ===========================================================================
-- O linter do Supabase acusou doze funcoes SECURITY DEFINER chamaveis pelo
-- papel `anon` via /rest/v1/rpc — inclusive gatilhos, que nao deveriam ser
-- chamaveis por ninguem.
--
-- A causa e uma so, e esta nas migrations anteriores:
--
--     revoke all on function ... from anon;
--
-- O Postgres concede EXECUTE a PUBLIC em toda funcao criada, e `anon` herda
-- desse PUBLIC. Revogar do papel nao desfaz a heranca; so revogar de PUBLIC
-- desfaz. A prova esta no proprio relatorio: `grant_course_access` e
-- `revoke_course_access` sao as unicas revogadas com `... from anon,
-- authenticated, public`, e sao exatamente as unicas ausentes da lista.
--
-- POR QUE ISTO NAO DERRUBA O APP
-- Policy de RLS e avaliada com o privilegio de quem consulta: se
-- `authenticated` perdesse o EXECUTE de `is_admin()`, toda consulta do aluno
-- morreria em "permission denied for function". Por isso cada revogacao aqui
-- vem seguida do grant explicito a `authenticated`.
-- E `anon` nao perde nada: as unicas duas policies que alcancam `public`
-- (avatars e course-assets) testam apenas `bucket_id`, sem chamar funcao.
--
-- PARA REVERTER: `grant execute on function <nome> to public;` devolve o
-- estado anterior de cada linha.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Gatilhos — ninguem chama pela API
-- ---------------------------------------------------------------------------
-- Chamar um destes por RPC ja falhava ("trigger functions can only be called
-- as triggers"), entao o que se fecha aqui e a superficie, nao um buraco.
--
-- O gatilho continua disparando normalmente: o Postgres checa EXECUTE na
-- CRIACAO do gatilho, nao a cada disparo. E as quatro sao SECURITY DEFINER,
-- portanto rodam como o dono, independente de quem provocou o INSERT.
revoke all on function public.set_updated_at()                from public, anon, authenticated;
revoke all on function public.handle_new_user()               from public, anon, authenticated;
revoke all on function public.handle_user_email_confirmed()   from public, anon, authenticated;
revoke all on function public.guard_profile_privileges()      from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Auxiliares de RLS — `authenticated` PRECISA continuar podendo executar
-- ---------------------------------------------------------------------------
revoke all    on function public.auth_role() from public, anon;
grant execute on function public.auth_role() to authenticated, service_role;

revoke all    on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

revoke all    on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;

revoke all    on function public.is_active_account() from public, anon;
grant execute on function public.is_active_account() to authenticated, service_role;

-- Esta aceita um uuid arbitrario: por `anon` era uma sonda de "fulano pagou?".
revoke all    on function public.has_course_access(uuid) from public, anon;
grant execute on function public.has_course_access(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RPCs do aluno — resolvem tudo por auth.uid(), so fazem sentido logado
-- ---------------------------------------------------------------------------
revoke all    on function public.enroll_circuit_chunks(uuid, integer) from public, anon;
grant execute on function public.enroll_circuit_chunks(uuid, integer) to authenticated, service_role;

revoke all    on function public.mark_chunks_spoken(text[]) from public, anon;
grant execute on function public.mark_chunks_spoken(text[]) to authenticated, service_role;

revoke all    on function public.review_chunk(text, integer) from public, anon;
grant execute on function public.review_chunk(text, integer) to authenticated, service_role;

revoke all    on function public.register_study_activity(uuid, integer, integer) from public, anon;
grant execute on function public.register_study_activity(uuid, integer, integer) to authenticated, service_role;

-- Nao e SECURITY DEFINER, entao o linter nao a acusa — mas a revogacao dela
-- tinha o mesmo defeito, e busca vetorial por `anon` e CPU de graca.
revoke all    on function public.match_knowledge(vector, integer, uuid, float) from public, anon;
grant execute on function public.match_knowledge(vector, integer, uuid, float) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. search_path fixo nas duas funcoes que ficaram sem
-- ---------------------------------------------------------------------------
-- Sem search_path fixo, quem conseguir criar um objeto num schema que venha
-- antes na busca pode sequestrar a resolucao de `now()` ou dos operadores de
-- vetor. `alter` em vez de recriar: nao encosta no corpo das funcoes.
alter function public.set_updated_at() set search_path = public;
alter function public.match_knowledge(vector, integer, uuid, float) set search_path = public;

-- ---------------------------------------------------------------------------
-- 5. Buckets publicos — parar de deixar LISTAR o acervo inteiro
-- ---------------------------------------------------------------------------
-- Bucket com `public = true` serve o arquivo por /object/public/... sem passar
-- por RLS. A policy larga de SELECT nao era necessaria para as imagens
-- aparecerem — ela so habilitava enumerar tudo o que existe no bucket.

-- avatars: o app LISTA a propria pasta (removeStaleAvatars, para nao deixar
-- foto orfa a cada troca), entao aqui a leitura e reduzida ao dono, e nao
-- removida.
drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_read_own"    on storage.objects;
create policy "avatars_read_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- course-assets: nada no app lista este bucket, e o staff continua com SELECT
-- pela policy "course_assets_staff_write", que e `for all`.
drop policy if exists "course_assets_public_read" on storage.objects;


-- ###########################################################################
-- ## 20260101001300_course_audio_bucket.sql
-- ###########################################################################

-- ===========================================================================
-- Easy English — onde o áudio do curso passa a morar
-- ===========================================================================
--
-- O áudio das lições vivia em `public/audio/<id>.mp3`, versionado no git: 500
-- arquivos e 56 MB. Isso funcionou enquanto o curso tinha 364 blocos.
--
-- A reconstrução do método pede 1.193 blocos base com família de formas, o que
-- dá cerca de 13 mil arquivos e 314 MB versionados. Repositório não é servidor
-- de mídia: clonar o projeto passaria a baixar um terço de gigabyte de mp3, e
-- cada regeração de conteúdo somaria mais uma cópia ao histórico, para sempre.
--
-- Bucket próprio, e não `course-assets`, por um motivo prático: o áudio é a
-- única coisa aqui que se regenera em lote. Separado, dá para esvaziar e
-- repovoar sem tocar em capa de curso nem em anexo de lição.
--
-- PÚBLICO, e vale dizer por quê. O player resolve a URL de forma SÍNCRONA a
-- partir do texto (`src/lib/audio-id.ts`), dentro do gesto do usuário — é o que
-- mantém o áudio tocando no Safari. URL assinada exigiria uma ida ao servidor
-- antes de cada play e quebraria exatamente isso. Então o mp3 é público para
-- quem tiver o endereço, que é o hash do texto. O que o paywall protege é o
-- curso: a agenda de revisão, a tutora, a conversa ao vivo, a progressão. Não
-- os arquivos de voz sintetizada.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('course-audio', 'course-audio', true, 10485760, array['audio/mpeg'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Escrita: só o service_role, que é quem roda `scripts/upload-audio.ts`.
--
-- Não há policy de leitura, e a ausência é deliberada: bucket público serve por
-- `/object/public/...` sem consultar RLS. Uma policy de SELECT aqui só
-- habilitaria LISTAR o conteúdo pela API, que é justamente o que não se quer —
-- o aluno busca o arquivo que ele já sabe o nome, não o catálogo inteiro.
-- ---------------------------------------------------------------------------

drop policy if exists "course_audio_admin_write" on storage.objects;
create policy "course_audio_admin_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'course-audio' and public.is_admin());

drop policy if exists "course_audio_admin_update" on storage.objects;
create policy "course_audio_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'course-audio' and public.is_admin());

drop policy if exists "course_audio_admin_delete" on storage.objects;
create policy "course_audio_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'course-audio' and public.is_admin());


-- ###########################################################################
-- ## 20260101001400_espinha.sql
-- ###########################################################################

-- ===========================================================================
-- Easy English — A espinha do método, no banco
--
-- `content/metodo/PENDENCIAS.md` listou dezesseis coisas sem as quais algum
-- pedaço do método é inimplementável. Quatro foram resolvidas no conteúdo
-- (bucket de áudio, família do bloco, quatro movimentos, orçamento da
-- Essencial). Esta migration resolve as que moram no banco, e todas elas têm
-- o mesmo formato de defeito: uma regra que o produto descreve em prosa e que
-- nenhuma consulta sabe avaliar.
--
--   1. study_days.input_minutes ......... o portão pede "11 dos 14 dias com o
--                                          input registrado" e não existia
--                                          coluna de escuta em lugar nenhum
--   2. teto, sanguessuga e decaimento ... a fila era dívida que só crescia:
--                                          `lapses` era monotônico, então
--                                          nenhum dos 52 portões podia usá-lo
--   3. is_mastered() .................... três réguas para a mesma palavra
--   5. baralho por trilha ............... a Essencial recebia 1.193 blocos
--                                          para 9 cartões/dia de orçamento
--   6. circuit_gate_status .............. os 52 portões não tinham onde ser
--                                          calculados nem exibidos
--  10. listening_exposures ............. o portão de escuta vivia em useState:
--                                          um F5 zerava
--  16. goal_met por trilha ............. o aluno do Intensivo batia a meta
--                                          com 15 minutos
--
-- O QUE ESTA MIGRATION NÃO FAZ: trancar nada. O portão é diagnóstico, não
-- fechadura — é decisão de produto e está no cabeçalho de content/metodo.
-- `circuit_gate_status` existe para o aluno ver POR QUE passou ou não, e para
-- a quinzena seguinte saber o que repetir. Nenhuma consulta aqui nega acesso
-- a conteúdo pago.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. O dia de estudo passa a saber quanto INPUT houve
--
-- `minutes` soma minutos de qualquer atividade, vindos do cliente, num número
-- só. "O input da sessão foi registrado hoje" não tinha onde ser lido, e é
-- exatamente o que os 52 portões do Completo pedem — todos eles, inclusive os
-- quatro fechamentos.
--
-- `input_minutes` é escrita só pelo player de áudio, e só com a aba em
-- primeiro plano: minuto autodeclarado que destranca conteúdo ensina o aluno a
-- mentir. `queue_cleared` é o segundo sinal que faltava — os portões da
-- Essencial pedem "10 dos 14 dias com a fila zerada", e um dia sem fila
-- vencida conta como zerado.
-- ---------------------------------------------------------------------------
alter table public.study_days
  add column if not exists input_minutes integer not null default 0,
  add column if not exists queue_cleared boolean not null default false;

comment on column public.study_days.input_minutes is
  'Minutos de escuta medidos pelo player, com a aba em primeiro plano. Nunca autodeclarados.';
comment on column public.study_days.queue_cleared is
  'A fila de revisão terminou o dia zerada. Dia sem fila vencida conta como zerado.';

/**
 * Os minutos que a trilha do aluno promete.
 *
 * `track_targets` já é a fonte da verdade da promessa (20/60/100). O que
 * faltava era alguém consultá-la: `register_study_activity` comparava contra
 * `profiles.daily_goal_minutes` com fallback 15, e um aluno do Intensivo
 * fechava a meta do dia — e mantinha a ofensiva — com 15 dos 100 minutos que
 * comprou.
 */
create or replace function public.track_daily_minutes(p_track public.study_track)
returns integer
language sql
stable
set search_path = public
as $$
  select daily_minutes from public.track_targets where track = p_track;
$$;

revoke all    on function public.track_daily_minutes(public.study_track) from public, anon;
grant execute on function public.track_daily_minutes(public.study_track) to authenticated, service_role;

-- A versão de três argumentos sai antes: com um quarto parâmetro só com
-- `default`, as duas assinaturas coexistiriam e toda chamada de três
-- argumentos viraria "function is not unique" — erro em tempo de execução, na
-- conclusão de cada lição, para todo mundo ao mesmo tempo.
drop function if exists public.register_study_activity(uuid, integer, integer);

create or replace function public.register_study_activity(
  p_enrollment_id uuid,
  p_minutes       integer default 0,
  p_lessons_done  integer default 0,
  p_input_minutes integer default 0
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
  v_streak     integer;
begin
  select e.* into v_enrollment
    from public.enrollments e
   where e.id = p_enrollment_id
     and (e.user_id = auth.uid() or public.is_admin());

  if v_enrollment.id is null then
    raise exception 'Matricula nao encontrada ou acesso negado';
  end if;

  select p.timezone into v_tz
    from public.profiles p where p.id = v_enrollment.user_id;

  -- A meta agora vem da TRILHA, não do perfil. Ver track_daily_minutes.
  v_goal := coalesce(public.track_daily_minutes(v_enrollment.track), 20);

  v_today := (now() at time zone public.safe_timezone(v_tz))::date;

  insert into public.study_days (
    user_id, enrollment_id, study_date, minutes, input_minutes, lessons_done, goal_met
  )
  values (
    v_enrollment.user_id, p_enrollment_id, v_today,
    greatest(p_minutes, 0), greatest(p_input_minutes, 0), greatest(p_lessons_done, 0),
    greatest(p_minutes, 0) >= v_goal
  )
  on conflict (enrollment_id, study_date) do update
    set minutes       = public.study_days.minutes + greatest(excluded.minutes, 0),
        input_minutes = public.study_days.input_minutes + greatest(excluded.input_minutes, 0),
        lessons_done  = public.study_days.lessons_done + greatest(excluded.lessons_done, 0),
        goal_met      = (public.study_days.minutes + greatest(excluded.minutes, 0)) >= v_goal;

  -- Ofensiva = dias consecutivos com a meta batida, terminando hoje ou ontem.
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
           when (select last_day from anchor) is null       then 0
           when (select last_day from anchor) < v_today - 1 then 0
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

revoke all on function public.register_study_activity(uuid, integer, integer, integer) from public, anon;
grant execute on function public.register_study_activity(uuid, integer, integer, integer)
  to authenticated, service_role;

/**
 * O dia terminou com a fila zerada.
 *
 * Chamada pela tela de revisão quando não sobra nenhum bloco vencido — e
 * também quando não havia nenhum, que é o que a prosa dos portões manda
 * ("dia sem fila vencida conta como zerado"). Idempotente.
 */
create or replace function public.mark_queue_cleared()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enr   public.enrollments;
  v_tz    text;
  v_today date;
begin
  select e.* into v_enr
    from public.enrollments e
   where e.user_id = auth.uid() and e.status = 'active'
   order by e.created_at desc
   limit 1;

  if v_enr.id is null then
    return false;
  end if;

  select p.timezone into v_tz from public.profiles p where p.id = v_enr.user_id;
  v_today := (now() at time zone public.safe_timezone(v_tz))::date;

  insert into public.study_days (user_id, enrollment_id, study_date, queue_cleared)
  values (v_enr.user_id, v_enr.id, v_today, true)
  on conflict (enrollment_id, study_date) do update set queue_cleared = true;

  return true;
end;
$$;

revoke all on function public.mark_queue_cleared() from public, anon;
grant execute on function public.mark_queue_cleared() to authenticated;

/**
 * O "hoje" do aluno, e não o do servidor.
 *
 * A sessão do Postgres roda em UTC e os oito fusos que o app oferece são todos
 * de UTC−2 a UTC−5. `current_date` cru, portanto, vira o dia SEGUINTE entre 21h
 * e a meia-noite no Brasil — e é exatamente nesse intervalo que quem estuda
 * depois do jantar usa o produto.
 *
 * O estrago era de duas pontas. `review_chunk` agendava `current_date + 1` às
 * 22h e o cartão "de amanhã" já nascia com data de depois de amanhã na conta do
 * aluno. E a tela de revisão, que lê o dia no fuso do perfil, não achava
 * cartão nenhum às 22h — o que fazia a fila parecer zerada e dava crédito de
 * "dia com a fila zerada" ao portão da Essencial sem um cartão respondido.
 *
 * Consertar do lado do banco, e não do lado da tela, porque é o banco que
 * ESCREVE a data: uma tela em UTC concordaria com um banco em UTC, mas as duas
 * estariam erradas juntas sobre quando é o dia do aluno.
 */
create or replace function public.today_for(p_user uuid)
returns date
language sql
stable
set search_path = public
as $$
  select (
    now() at time zone public.safe_timezone(
      (select p.timezone from public.profiles p where p.id = p_user)
    )
  )::date;
$$;

revoke all    on function public.today_for(uuid) from public, anon;
grant execute on function public.today_for(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2 e 5. A fila deixa de ser dívida, e cada trilha recebe o próprio baralho
-- ---------------------------------------------------------------------------
alter table public.chunk_mastery
  -- Bloco do NÚCLEO: o recorte que a Essencial estuda. nucleo(N) =
  -- min(10, ceil(0,32 x blocosNovos(N))), que dá 359 dos 1.193 no curso
  -- inteiro. Conferido contra os 48 portões da Essencial, que citam esse
  -- denominador por extenso ("2 dos 3 blocos do núcleo deste circuito").
  add column if not exists is_core boolean not null default true,
  -- Acertos seguidos desde o último lapso. Existe para `lapses` poder DESCER.
  add column if not exists correct_streak smallint not null default 0,
  -- Sanguessuga: sai da agenda e volta como conteúdo. Ver review_chunk.
  add column if not exists suspended_at timestamptz;

comment on column public.chunk_mastery.is_core is
  'Bloco do núcleo — o baralho da trilha Essencial. min(10, ceil(0,32 x blocos novos do circuito)).';
comment on column public.chunk_mastery.correct_streak is
  'Acertos consecutivos desde o último lapso. Aos 3, um lapso é perdoado.';
comment on column public.chunk_mastery.suspended_at is
  'Sanguessuga: 8 lapsos tiraram o bloco da agenda. Ele volta como conteúdo da lição, não como cartão.';

-- O índice de fila passa a existir só para o que a fila realmente lê.
create index if not exists chunk_mastery_active_idx
  on public.chunk_mastery (user_id, due_date)
  where suspended_at is null;
create index if not exists chunk_mastery_core_idx
  on public.chunk_mastery (user_id, circuit_number)
  where is_core;

/**
 * Uma única definição de "dominado".
 *
 * Havia três, e elas discordavam: `masteryStage` em srs.ts pedia
 * `repetitions >= 4 and ease >= 2,3 and spoken_count >= 2`; a view
 * `chunk_review_queue` pedia `repetitions >= 3 and ease >= 2,3` e ignorava a
 * fala; e os 52 portões pediam uma terceira coisa. O app lia a view para os
 * agregados e a função TS para a tela do bloco, então o aluno via dois números
 * diferentes para a mesma palavra na mesma sessão.
 *
 * A cláusula de `ease_factor` só voltou a ser alcançável depois que
 * `gradeFromRecall` passou a devolver 4 no "hesitei" — o degrau neutro do
 * SM-2. Antes disso ela era catraca de mão única e "dominado" era impossível
 * para quem revisava todos os dias.
 *
 * A Essencial não cobra produção falada porque não grava: os 52 portões dela
 * dizem isso por extenso. Não é régua mais frouxa, é a régua do que a trilha
 * mede.
 */
create or replace function public.is_mastered(
  p_repetitions integer,
  p_ease        numeric,
  p_spoken      integer,
  p_track       public.study_track default 'complete'
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_repetitions, 0) >= 4
     and coalesce(p_ease, 0) >= 2.30
     and (p_track = 'essential' or coalesce(p_spoken, 0) >= 2);
$$;

-- `chunk_review_queue` e `security_invoker`, entao quem PRECISA do EXECUTE aqui
-- e o proprio aluno: sem o grant, toda consulta da fila morre em "permission
-- denied for function".
revoke all    on function public.is_mastered(integer, numeric, integer, public.study_track)
  from public, anon;
grant execute on function public.is_mastered(integer, numeric, integer, public.study_track)
  to authenticated, service_role;

-- Mesma razão do drop acima: `p_track` com default tornaria ambígua toda
-- chamada de dois argumentos enquanto a versão antiga existisse.
drop function if exists public.enroll_circuit_chunks(uuid, integer);

/**
 * Matricula os blocos de um circuito na agenda do aluno, respeitando a trilha.
 *
 * A versão anterior matriculava o circuito inteiro sem olhar a trilha. A
 * Essencial tem 3 minutos de Memória por dia — 9 cartões a 20 s — e 1.193
 * blocos exigem cerca de 33 por dia em regime: a fila dela estourava em três
 * meses e os 52 portões ficavam impossíveis pelo mesmo motivo que os do
 * Completo estavam.
 *
 * O núcleo é `min(10, ceil(0,32 x blocos novos do circuito))`, e a ordem do
 * recorte é a do próprio array de chunks do circuito — `with ordinality`, não
 * `random()`: dois alunos da mesma trilha precisam receber o MESMO núcleo, e o
 * portão cita o denominador por extenso.
 *
 * Continua idempotente: rodar de novo não zera o progresso de quem já revisou.
 */
create or replace function public.enroll_circuit_chunks(
  p_course_id      uuid,
  p_circuit_number integer,
  p_track          public.study_track default 'complete'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_total  integer := 0;
  v_nucleo integer := 0;
  v_count  integer := 0;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;

  select jsonb_array_length(c.chunks) into v_total
    from public.circuits c
   where c.course_id = p_course_id and c.number = p_circuit_number;

  if v_total is null or v_total = 0 then
    return 0;
  end if;

  v_nucleo := least(10, ceil(0.32 * v_total)::integer);

  insert into public.chunk_mastery (
    user_id, course_id, circuit_number, chunk_key, chunk_en, chunk_pt, is_core, due_date
  )
  select
    v_user,
    p_course_id,
    p_circuit_number,
    regexp_replace(lower(trim(item.chunk ->> 'en')), '[^a-z0-9]+', '-', 'g'),
    item.chunk ->> 'en',
    coalesce(item.chunk ->> 'pt', ''),
    item.pos <= v_nucleo,
    -- O default da coluna é `current_date`, que é UTC. Ver `today_for`.
    public.today_for(v_user)
  from public.circuits c,
       lateral jsonb_array_elements(c.chunks) with ordinality as item(chunk, pos)
  where c.course_id = p_course_id
    and c.number = p_circuit_number
    and coalesce(trim(item.chunk ->> 'en'), '') <> ''
    -- A Essencial recebe só o núcleo. As outras duas recebem tudo.
    and (p_track <> 'essential' or item.pos <= v_nucleo)
  on conflict (user_id, chunk_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.enroll_circuit_chunks(uuid, integer, public.study_track) from public, anon;
grant execute on function public.enroll_circuit_chunks(uuid, integer, public.study_track) to authenticated;

/**
 * SM-2 com duas regras que faltavam: o lapso perdoado e a sanguessuga.
 *
 * `lapses` era monotônico — só subia, nunca descia — e por isso era uma
 * condenação permanente em vez de um diagnóstico. Nenhum dos 52 portões podia
 * usá-lo, e `masteryStage` marcava como "Travado" quem tinha errado três vezes
 * em janeiro e acertado cem desde então.
 *
 *   PERDÃO: três acertos seguidos apagam um lapso. Três porque é o mesmo
 *   número de acertos que o SM-2 leva para sair do intervalo curto (1, 6,
 *   depois × ease): quem atravessou os três degraus reaprendeu o bloco.
 *
 *   SANGUESSUGA: aos 8 lapsos o bloco SAI DA AGENDA. Não é castigo, é
 *   aritmética: um bloco que falhou 8 vezes está consumindo revisão que outros
 *   1.192 blocos precisam, e mais uma passada dele não vai resolver. Ele volta
 *   como CONTEÚDO — a lição continua ensinando o bloco — mas para de aparecer
 *   como cartão. Oito é o que sobra depois do perdão: chegar lá exige errar
 *   oito vezes sem emendar três acertos.
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
  v_row     public.chunk_mastery;
  v_ef      numeric(4,2);
  v_int     integer;
  v_reps    integer;
  v_lapses  integer;
  v_streak  integer;
  v_susp    timestamptz;
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

  v_ef := greatest(
    1.30,
    v_row.ease_factor + (0.10 - (5 - p_grade) * (0.08 + (5 - p_grade) * 0.02))
  );

  if p_grade < 3 then
    v_reps   := 0;
    v_int    := 1;
    v_lapses := v_row.lapses + 1;
    v_streak := 0;
  else
    v_reps   := v_row.repetitions + 1;
    v_int    := case
                  when v_reps = 1 then 1
                  when v_reps = 2 then 6
                  else greatest(1, round(v_row.interval_days * v_ef)::integer)
                end;
    v_streak := v_row.correct_streak + 1;
    v_lapses := v_row.lapses;

    -- Três acertos seguidos perdoam um lapso, e o contador recomeça.
    if v_streak >= 3 and v_lapses > 0 then
      v_lapses := v_lapses - 1;
      v_streak := 0;
    end if;
  end if;

  -- Sanguessuga. Um bloco já suspenso que volta a ser revisado (o aluno pode
  -- reencontrá-lo pelo conteúdo) sai da suspensão ao primeiro acerto.
  v_susp := case
              when v_lapses >= 8 then coalesce(v_row.suspended_at, now())
              when p_grade >= 3  then null
              else v_row.suspended_at
            end;

  update public.chunk_mastery
     set ease_factor      = v_ef,
         repetitions      = v_reps,
         interval_days    = v_int,
         lapses           = v_lapses,
         correct_streak   = v_streak,
         suspended_at     = v_susp,
         due_date         = public.today_for(auth.uid()) + v_int,
         last_grade       = p_grade,
         last_reviewed_at = now()
   where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.review_chunk(text, integer) from public, anon;
grant execute on function public.review_chunk(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- A visão do dia passa a falar a mesma língua que a tela do bloco
--
-- `mastered` usava `repetitions >= 3` e ignorava a fala; `masteryStage` usava
-- `>= 4` e exigia duas produções. Agora as duas chamam `is_mastered`, e o
-- recorte respeita a trilha do aluno. Os suspensos saem de `due_today` — eles
-- não são agenda — e ganham coluna própria, porque sumir sem aparecer em lugar
-- nenhum é como o aluno perde blocos sem saber.
-- ---------------------------------------------------------------------------
create or replace view public.chunk_review_queue
with (security_invoker = true) as
select
  m.user_id,
  count(*) filter (
    where m.due_date <= coalesce(t.hoje, current_date) and m.suspended_at is null
  )                                                                as due_today,
  count(*) filter (
    where m.due_date <= coalesce(t.hoje, current_date) + 1 and m.suspended_at is null
  )                                                                as due_tomorrow,
  count(*)                                                         as total_chunks,
  count(*) filter (
    where public.is_mastered(m.repetitions, m.ease_factor, m.spoken_count,
                             coalesce(t.track, 'complete'))
  )                                                                as mastered,
  count(*) filter (where m.lapses >= 3 and m.suspended_at is null) as struggling,
  count(*) filter (where m.suspended_at is not null)               as suspended
from public.chunk_mastery m
-- Uma junção lateral por ALUNO, e não uma chamada de função por bloco: a
-- forma anterior resolvia `today_for(m.user_id)` uma vez para cada uma das até
-- 1.193 linhas do acervo, sempre com a mesma resposta.
left join lateral (
  select e.track, public.today_for(m.user_id) as hoje
    from public.enrollments e
   where e.user_id = m.user_id
   order by e.created_at desc
   limit 1
) t on true
group by m.user_id;

-- ---------------------------------------------------------------------------
-- 10. O portão de escuta passa a existir fora do React
--
-- Ele vivia em `useState(0)`: um F5 zerava o contador e um botão "Mostrar o
-- texto agora" abria tudo em um clique. Portão com botão de pular é conselho
-- com animação — e o diagnóstico do próprio curso diz que ler antes de ouvir
-- instala fonema português sobre grafia inglesa, e que desfazer isso custa
-- caro.
--
-- `exposure_key` é `c{circuito}d{dia}:{papel}` para as peças e o próprio
-- `chunk_key` para os blocos, reusando a identidade estável que
-- `chunk_mastery` já tem.
-- ---------------------------------------------------------------------------
create table if not exists public.listening_exposures (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  exposure_key    text not null,
  required_plays  smallint not null,
  plays           smallint not null default 0,
  first_played_at timestamptz,
  last_played_at  timestamptz,
  unlocked_at     timestamptz,
  /** Aberto pela exceção de acessibilidade, não por escuta. */
  forced          boolean not null default false,
  created_at      timestamptz not null default now(),
  primary key (user_id, exposure_key)
);

create index if not exists listening_exposures_open_idx
  on public.listening_exposures (user_id)
  where unlocked_at is not null;

alter table public.listening_exposures enable row level security;

-- Leitura própria e nada mais. A escrita é exclusiva das duas funções abaixo,
-- que são `security definer`: sem isso o cliente daria um UPDATE em `plays` e
-- o portão viraria enfeite por outro caminho.
drop policy if exists "listening_exposures_read_own" on public.listening_exposures;
create policy "listening_exposures_read_own" on public.listening_exposures
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

revoke insert, update, delete on public.listening_exposures from anon, authenticated;
-- Explícito, e não herdado dos privilégios padrão do schema: a RLS acima só
-- protege quem já tem SELECT, e sem o grant a fila de exposições falharia em
-- "permission denied" em vez de vir vazia.
grant select on public.listening_exposures to authenticated;

/**
 * Quantas escutas o circuito exige antes de o texto abrir.
 *
 * 4 no Canto 1, 3 no Canto 2, 2 nos Cantos 3 e 4 — os números de
 * `content/metodo/orcamento.json`. A queda não é afrouxamento: no Canto 1 o
 * portão existe para impedir que o fonema português seja instalado sobre a
 * grafia inglesa; do Canto 3 em diante o aluno já decodifica de ouvido, e o
 * que resta é garantir uma passada cega antes da leitura. Duas é o mínimo que
 * ainda garante essa passada.
 */
create or replace function public.required_plays(p_circuit integer)
returns smallint
language sql
immutable
set search_path = public
as $$
  select case
           when coalesce(p_circuit, 1) <= 13 then 4
           when p_circuit <= 26              then 3
           else 2
         end::smallint;
$$;

revoke all    on function public.required_plays(integer) from public, anon;
grant execute on function public.required_plays(integer) to authenticated, service_role;

/**
 * Uma escuta completa a mais.
 *
 * O cliente NÃO manda quantas escutas faltam, e nem poderia: o número vem do
 * circuito, e o circuito vem da própria chave (`c14d4:escuta`) ou, para bloco,
 * de `chunk_mastery.circuit_number`. Um cliente hostil que chamasse esta
 * função com `required_plays = 1` não conseguiria nada.
 *
 * `p_min_seconds` é a duração do áudio, e serve para uma coisa só: duas
 * chamadas separadas por menos que isso não contam duas vezes. O piso de 5
 * segundos existe porque o parâmetro vem do cliente — sem ele, mandar zero
 * devolveria o defeito que esta migration está consertando.
 */
create or replace function public.count_listen(
  p_exposure_key text,
  p_min_seconds  integer default 0
)
returns public.listening_exposures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_circuit  integer;
  v_required smallint;
  v_janela   interval;
  v_row      public.listening_exposures;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;

  if coalesce(trim(p_exposure_key), '') = '' or length(p_exposure_key) > 200 then
    raise exception 'Chave de exposição inválida';
  end if;

  -- `c14d4:escuta` traz o circuito na própria chave.
  v_circuit := nullif(substring(p_exposure_key from '^c(\d+)d\d+:'), '')::integer;

  -- Bloco: a identidade é o chunk_key, e o circuito está na agenda do aluno.
  if v_circuit is null then
    select cm.circuit_number into v_circuit
      from public.chunk_mastery cm
     where cm.user_id = v_user and cm.chunk_key = p_exposure_key;
  end if;

  v_required := public.required_plays(coalesce(v_circuit, 1));
  v_janela   := make_interval(secs => least(greatest(coalesce(p_min_seconds, 0), 5), 600));

  insert into public.listening_exposures (
    user_id, exposure_key, required_plays, plays, first_played_at, last_played_at, unlocked_at
  )
  values (
    v_user, p_exposure_key, v_required, 1, now(), now(),
    case when v_required <= 1 then now() end
  )
  on conflict (user_id, exposure_key) do update
    set required_plays = v_required,
        plays = case
                  -- Escuta dentro da janela do áudio anterior: é a mesma.
                  when public.listening_exposures.last_played_at is not null
                   and now() - public.listening_exposures.last_played_at < v_janela
                  then public.listening_exposures.plays
                  else public.listening_exposures.plays + 1
                end,
        last_played_at = now(),
        first_played_at = coalesce(public.listening_exposures.first_played_at, now())
  returning * into v_row;

  -- Destrava uma vez, para sempre. Nunca volta a trancar.
  if v_row.unlocked_at is null and v_row.plays >= v_row.required_plays then
    update public.listening_exposures
       set unlocked_at = now()
     where user_id = v_user and exposure_key = p_exposure_key
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.count_listen(text, integer) from public, anon;
grant execute on function public.count_listen(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Quem já ouviu não ouve de novo
--
-- O portão nasce fechado para todo par (aluno, peça) que não tem linha. Sem
-- esta carga inicial, o aluno que concluiu o dia 1 semana passada reabriria a
-- lição hoje e encontraria a transcrição trancada atrás de quatro escutas — de
-- um diálogo que ele já ouviu, numa lição que ele já terminou, e agora sem o
-- botão "Mostrar o texto agora", que foi embora junto.
--
-- Isso não é o portão funcionando: é o portão cobrando duas vezes. O critério
-- da carga é conservador de propósito — só lição CONCLUÍDA, e só peça que de
-- fato tranca alguma coisa (`content.gated` não vazio). Quem parou no meio do
-- dia 1 continua tendo que ouvir, que é o certo.
--
-- `forced` fica em false: não foi dispensa de áudio, foi lição cumprida. E o
-- `on conflict do nothing` deixa a carga ser reaplicada sem apagar contagem de
-- ninguém.
-- ---------------------------------------------------------------------------
insert into public.listening_exposures (
  user_id, exposure_key, required_plays, plays, first_played_at, last_played_at, unlocked_at
)
select distinct
  lp.user_id,
  'c' || l.week_number || 'd'
      || case when l.immersion_script is not null then 1 else 4 end
      || case when l.immersion_script is not null then ':imersao' else ':escuta' end,
  public.required_plays(l.week_number),
  public.required_plays(l.week_number),
  lp.completed_at,
  lp.completed_at,
  lp.completed_at
from public.lesson_progress lp
join public.lessons l on l.id = lp.lesson_id
where lp.status = 'completed'
  and lp.completed_at is not null
  and (l.immersion_script is not null or l.listening_script is not null)
  and jsonb_array_length(coalesce(l.content -> 'gated', '[]'::jsonb)) > 0
on conflict (user_id, exposure_key) do nothing;

-- A exceção de acessibilidade deixa de ser um link em cada tela e vira uma
-- marca de perfil: aplicada uma vez, registrada, e válida para o curso todo.
alter table public.profiles
  add column if not exists audio_exempt boolean not null default false;

comment on column public.profiles.audio_exempt is
  'Aluno surdo ou com deficiência auditiva: as exposições abrem sem escuta. Marca de perfil, não botão de tela.';

-- ---------------------------------------------------------------------------
-- A dispensa de áudio não é auto-atribuível
--
-- `profiles_update_own` (rls.sql:737) libera a linha inteira para o dono, e a
-- API REST aceita PATCH em qualquer coluna que a policy alcance. Sem esta
-- guarda, `audio_exempt` seria o botão "Mostrar o texto agora" de volta — a
-- dois cliques de distância no inspetor, e sem nem o rótulo de acessibilidade
-- que justifica a exceção.
--
-- A guarda é o mesmo gatilho que já impede o aluno de mudar o próprio papel e
-- o próprio status: uma coluna a mais na mesma lista. `auth.uid() is null`
-- continua passando, que é como o service_role e o suporte marcam a dispensa
-- de quem de fato precisa dela.
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

  if new.audio_exempt is distinct from old.audio_exempt then
    raise exception 'A dispensa de audio e concedida pelo suporte, nao pelo proprio aluno';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_privileges() from public, anon, authenticated;

/**
 * Abre uma exposição sem escuta, para quem não pode ouvir.
 *
 * Só funciona com `profiles.audio_exempt`. É o único caminho que existe para
 * abrir sem ouvir, e ele deixa rastro em `forced` — o botão "Mostrar o texto
 * agora", que qualquer aluno clicava, foi embora.
 */
create or replace function public.unlock_exposure(p_exposure_key text)
returns public.listening_exposures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_exempt boolean;
  v_row    public.listening_exposures;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;

  select p.audio_exempt into v_exempt from public.profiles p where p.id = v_user;

  if not coalesce(v_exempt, false) then
    raise exception 'Esta conta não tem a dispensa de áudio';
  end if;

  insert into public.listening_exposures (
    user_id, exposure_key, required_plays, plays, unlocked_at, forced
  )
  values (v_user, p_exposure_key, 0, 0, now(), true)
  on conflict (user_id, exposure_key) do update
    set unlocked_at = coalesce(public.listening_exposures.unlocked_at, now()),
        forced = true
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.unlock_exposure(text) from public, anon;
grant execute on function public.unlock_exposure(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Os 52 portões ganham onde ser calculados e exibidos
--
-- Eram a espinha do produto e não tinham tabela, view nem função: "passou o
-- circuito 14" era uma frase do briefing. O aluno não via por que passou ou
-- não, e nenhuma tela podia mostrar o que faltava.
--
-- `circuit_gates` guarda o CRITÉRIO, extraído da prosa de rampa.json por
-- content/metodo/portoes.ts e semeado por scripts/seed-curriculum.ts — a prosa
-- continua sendo a fonte, e é ela que vai para a tela em `prose`.
-- `circuit_gate_status` guarda a AVALIAÇÃO de um aluno, com o valor medido ao
-- lado do exigido em cada componente.
-- ---------------------------------------------------------------------------
create table if not exists public.circuit_gates (
  track          public.study_track not null,
  circuit_number integer not null,
  is_closing     boolean not null default false,
  /** [{ tipo, exigido, de, repeticoes, faladas, escopo, circuito, minimo }] */
  components     jsonb not null default '[]'::jsonb,
  /** A prosa original. É o que o aluno lê. */
  prose          text not null default '',
  updated_at     timestamptz not null default now(),
  primary key (track, circuit_number)
);

alter table public.circuit_gates enable row level security;

drop policy if exists "circuit_gates_read" on public.circuit_gates;
create policy "circuit_gates_read" on public.circuit_gates
  for select to authenticated using (true);

revoke insert, update, delete on public.circuit_gates from anon;
grant select on public.circuit_gates to authenticated;

drop policy if exists "circuit_gates_admin_write" on public.circuit_gates;
create policy "circuit_gates_admin_write" on public.circuit_gates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.circuit_gate_status (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  course_id      uuid not null references public.courses (id) on delete cascade,
  circuit_number integer not null,
  track          public.study_track not null,
  evaluated_at   timestamptz not null default now(),
  passed         boolean not null default false,
  /** [{ tipo, rotulo, exigido, medido, de, passou }] */
  components     jsonb not null default '[]'::jsonb,
  primary key (user_id, circuit_number)
);

create index if not exists circuit_gate_status_user_idx
  on public.circuit_gate_status (user_id, circuit_number);

alter table public.circuit_gate_status enable row level security;

drop policy if exists "circuit_gate_status_own" on public.circuit_gate_status;
create policy "circuit_gate_status_own" on public.circuit_gate_status
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- Escrita só pela função de avaliação: um portão que o cliente pode gravar não
-- diagnostica nada.
revoke insert, update, delete on public.circuit_gate_status from anon, authenticated;
grant select on public.circuit_gate_status to authenticated;

/**
 * Avalia o portão de um circuito e guarda o resultado.
 *
 * Cada componente vira uma linha do JSON com o valor MEDIDO ao lado do
 * EXIGIDO: é isso que permite a tela dizer "faltam 2 dos 14 dias com input" em
 * vez de "você não passou". `passed` é a conjunção de todos.
 *
 * Nada aqui tranca nada. Ver o cabeçalho desta migration.
 */
create or replace function public.evaluate_circuit_gate(
  p_course_id      uuid,
  p_circuit_number integer
)
returns public.circuit_gate_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_enr      public.enrollments;
  v_tz       text;
  v_gate     public.circuit_gates;
  v_comp     jsonb;
  v_saida    jsonb := '[]'::jsonb;
  v_medido   numeric;
  v_exigido  numeric;
  v_passou   boolean;
  v_todos    boolean := true;
  v_escopo   text;
  v_status   public.circuit_gate_status;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;

  select e.* into v_enr
    from public.enrollments e
   where e.user_id = v_user and e.course_id = p_course_id
   limit 1;

  if v_enr.id is null then
    raise exception 'Matrícula não encontrada';
  end if;

  select * into v_gate
    from public.circuit_gates
   where track = v_enr.track and circuit_number = p_circuit_number;

  if v_gate.circuit_number is null then
    raise exception 'Portão do circuito % não foi semeado para a trilha %',
      p_circuit_number, v_enr.track;
  end if;

  select p.timezone into v_tz from public.profiles p where p.id = v_user;

  for v_comp in select * from jsonb_array_elements(v_gate.components)
  loop
    v_escopo  := coalesce(v_comp ->> 'escopo', 'todos');
    v_exigido := coalesce((v_comp ->> 'exigido')::numeric, (v_comp ->> 'minimo')::numeric, 0);
    v_medido  := 0;

    case v_comp ->> 'tipo'

      -- Dias do circuito em que houve input medido. O elo entre `study_days`
      -- (que é por data) e o circuito (que é por dia de lição) é a data em que
      -- a lição foi concluída, no fuso do aluno.
      -- DISTINCT no dia, não na lição: o portão mede hábito espalhado por
      -- catorze dias, e quem faz catorze lições num sábado tem um dia de
      -- input, não catorze.
      when 'input' then
        select count(distinct sd.study_date) into v_medido
          from public.lesson_progress lp
          join public.lessons l on l.id = lp.lesson_id
          join public.study_days sd
            on sd.enrollment_id = v_enr.id
           and sd.study_date = (lp.completed_at at time zone public.safe_timezone(v_tz))::date
         where lp.enrollment_id = v_enr.id
           and l.course_id = p_course_id
           and l.week_number = p_circuit_number
           and lp.status = 'completed'
           and lp.completed_at is not null
           and sd.input_minutes > 0;

      when 'licao' then
        select count(*) into v_medido
          from public.lesson_progress lp
          join public.lessons l on l.id = lp.lesson_id
         where lp.enrollment_id = v_enr.id
           and l.course_id = p_course_id
           and l.week_number = p_circuit_number
           and lp.status = 'completed';

      when 'fila' then
        select count(distinct sd.study_date) into v_medido
          from public.lesson_progress lp
          join public.lessons l on l.id = lp.lesson_id
          join public.study_days sd
            on sd.enrollment_id = v_enr.id
           and sd.study_date = (lp.completed_at at time zone public.safe_timezone(v_tz))::date
         where lp.enrollment_id = v_enr.id
           and l.course_id = p_course_id
           and l.week_number = p_circuit_number
           and lp.status = 'completed'
           and lp.completed_at is not null
           and sd.queue_cleared;

      when 'novos', 'acumulado', 'defasado' then
        select count(*) into v_medido
          from public.chunk_mastery cm
         where cm.user_id = v_user
           and cm.course_id = p_course_id
           and cm.repetitions  >= coalesce((v_comp ->> 'repeticoes')::integer, 0)
           and cm.spoken_count >= coalesce((v_comp ->> 'faladas')::integer, 0)
           and (v_escopo <> 'nucleo' or cm.is_core)
           and case v_comp ->> 'tipo'
                 when 'novos'     then cm.circuit_number = p_circuit_number
                 when 'acumulado' then cm.circuit_number <= p_circuit_number
                 else cm.circuit_number = coalesce((v_comp ->> 'circuito')::integer, -1)
               end;

      -- A melhor nota do circuito, não a média: o portão pede evidência de que
      -- o aluno CONSEGUE, e uma gravação ruim no dia 2 não desfaz uma boa no
      -- dia 11.
      when 'nota' then
        select coalesce(max(f.overall_score), 0) into v_medido
          from public.speaking_feedback f
          join public.speaking_sessions s on s.id = f.session_id
          join public.lessons l on l.id = s.lesson_id
         where f.user_id = v_user
           and l.course_id = p_course_id
           and l.week_number = p_circuit_number;

      else
        -- Componente que esta versão do banco não sabe medir. Não reprova
        -- ninguém por ignorância própria: entra no JSON marcado e é isso.
        v_medido := 0;
        v_exigido := 0;
    end case;

    v_passou := v_medido >= v_exigido;
    if not v_passou then v_todos := false; end if;

    v_saida := v_saida || jsonb_build_object(
      'tipo',    v_comp ->> 'tipo',
      'exigido', v_exigido,
      'medido',  v_medido,
      'de',      (v_comp ->> 'de')::numeric,
      'passou',  v_passou
    );
  end loop;

  insert into public.circuit_gate_status (
    user_id, course_id, circuit_number, track, evaluated_at, passed, components
  )
  values (v_user, p_course_id, p_circuit_number, v_enr.track, now(), v_todos, v_saida)
  on conflict (user_id, circuit_number) do update
    set course_id    = excluded.course_id,
        track        = excluded.track,
        evaluated_at = excluded.evaluated_at,
        passed       = excluded.passed,
        components   = excluded.components
  returning * into v_status;

  return v_status;
end;
$$;

revoke all on function public.evaluate_circuit_gate(uuid, integer) from public, anon;
grant execute on function public.evaluate_circuit_gate(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
