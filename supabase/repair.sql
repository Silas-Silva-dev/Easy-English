-- ===========================================================================
-- InglishEasy — Reparo idempotente
--
-- Cole ESTE ARQUIVO INTEIRO no SQL Editor do Supabase e clique em Run.
-- Pode rodar quantas vezes quiser: nada é duplicado nem apagado.
--
-- Resolve os dois pontos que o `npm run check` costuma acusar:
--   1. RPC match_knowledge ausente do schema cache do PostgREST
--   2. Buckets de storage não criados (migration 3 não aplicada)
--
-- Ao final, a última consulta mostra um relatório do que ficou no lugar.
-- ===========================================================================

-- Guarda: este arquivo REPARA um schema existente, não cria o schema do zero.
-- Se o banco ainda estiver vazio, pare aqui e rode supabase/schema.sql antes.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'knowledge_chunks'
  ) then
    raise exception
      'Schema base ausente. Rode supabase/schema.sql PRIMEIRO (ou as 3 migrations na ordem), depois volte aqui.';
  end if;
end $$;

create extension if not exists "vector";

-- ---------------------------------------------------------------------------
-- 1. Busca semântica usada pela tutora (RAG)
-- ---------------------------------------------------------------------------
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

revoke all on function public.match_knowledge(vector, integer, uuid, float) from anon;
grant execute on function public.match_knowledge(vector, integer, uuid, float)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Buckets de storage
-- ---------------------------------------------------------------------------
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

-- speaking-audio (privado): cada aluno só enxerga a própria pasta
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

-- avatars (leitura pública, escrita do dono)
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

-- course-assets (leitura pública, escrita da equipe)
drop policy if exists "course_assets_public_read" on storage.objects;
create policy "course_assets_public_read" on storage.objects
  for select to public
  using (bucket_id = 'course-assets');

drop policy if exists "course_assets_staff_write" on storage.objects;
create policy "course_assets_staff_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'course-assets' and public.is_staff())
  with check (bucket_id = 'course-assets' and public.is_staff());

-- ---------------------------------------------------------------------------
-- 3. Força o PostgREST a reler as assinaturas das funções
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 4. Relatório
-- ---------------------------------------------------------------------------
select 'match_knowledge' as item,
       case when exists (
         select 1 from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'match_knowledge'
       ) then 'OK' else 'AUSENTE' end as situacao
union all
select 'extensao vector',
       case when exists (select 1 from pg_extension where extname = 'vector')
            then 'OK' else 'AUSENTE' end
union all
select 'bucket ' || id, 'OK' from storage.buckets
 where id in ('speaking-audio', 'avatars', 'course-assets')
union all
select 'tabelas public', count(*)::text || ' tabelas'
  from information_schema.tables
 where table_schema = 'public' and table_type = 'BASE TABLE'
union all
select 'tabelas com RLS', count(*)::text
  from pg_tables
 where schemaname = 'public' and rowsecurity = true
order by item;
