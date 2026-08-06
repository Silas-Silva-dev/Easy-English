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

-- Aluno pode visualizar seus próprios certificados
create policy certificates_select_own on public.certificates
  for select using (auth.uid() = user_id);

-- Admins têm acesso total
create policy certificates_admin_all on public.certificates
  for all using (
    exists (
      select 1 from public.profiles
       where profiles.id = auth.uid()
         and profiles.role = 'admin'
    )
  );

-- Leitura pública (para qualquer visitante verificar por código)
create policy certificates_select_public_code on public.certificates
  for select using (true);
