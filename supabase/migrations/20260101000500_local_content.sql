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
