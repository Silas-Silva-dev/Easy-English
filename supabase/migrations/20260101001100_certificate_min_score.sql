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
