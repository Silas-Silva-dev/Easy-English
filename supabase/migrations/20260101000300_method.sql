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
