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
