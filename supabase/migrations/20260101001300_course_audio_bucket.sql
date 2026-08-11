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
