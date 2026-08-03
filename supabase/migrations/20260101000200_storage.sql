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
