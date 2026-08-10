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
