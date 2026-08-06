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
