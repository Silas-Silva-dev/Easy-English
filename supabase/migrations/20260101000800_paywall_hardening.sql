-- ===========================================================================
-- Easy English — Fechando o paywall onde ele ainda vazava
--
-- Achado por teste de invasão contra o banco de produção
-- (`npm run check:seguranca`): um aluno com conta grátis, e-mail confirmado e
-- NENHUM pagamento conseguia extrair o conteúdo do curso por dois caminhos.
--
-- A migration 700 fechou `lessons`, `lesson_resources` e `knowledge_*`, mas
-- parou aí. O conteúdo, porém, não mora só nas lições.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. circuits — 364 blocos de fala abertos para qualquer cadastro
--
-- `circuits.chunks` É o produto. O método inteiro está escrito na migration
-- 300: "a unidade de aprendizado deixa de ser a regra gramatical e passa a ser
-- o CHUNK". A policy antiga exigia apenas conta ativa, então um `GET` no
-- PostgREST com a anon key (que é pública, vai no JavaScript de toda página)
-- mais um cadastro grátis devolvia os 52 circuitos inteiros: blocos, padrões,
-- missões e armadilhas.
-- ---------------------------------------------------------------------------
drop policy if exists "circuits_select_published" on public.circuits;
create policy "circuits_select_published" on public.circuits
  for select to authenticated
  using (
    public.is_staff()
    or (
      is_published
      and public.is_active_account()
      and public.has_course_access()
      and exists (select 1 from public.courses c where c.id = course_id and c.is_published)
    )
  );

-- ---------------------------------------------------------------------------
-- 2. enroll_circuit_chunks — a porta dos fundos para o mesmo conteúdo
--
-- Fechar a policy acima, sozinho, não resolveria nada.
--
-- Esta função é SECURITY DEFINER (roda como dona da tabela, portanto IGNORA
-- RLS) e está liberada para `authenticated`. Ela lê `circuits.chunks` e grava
-- `chunk_en`/`chunk_pt` em `chunk_mastery` — que o próprio aluno pode ler,
-- porque é a agenda dele.
--
-- Ou seja: bastava chamar a RPC 52 vezes, uma por circuito, e depois um
-- `select * from chunk_mastery` para levar o curso embora, com a policy de
-- circuits impecável. Toda função SECURITY DEFINER precisa repetir por conta
-- própria a autorização que a RLS faria por ela.
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

  if not public.has_course_access(v_user) then
    raise exception 'Acesso ao curso não liberado';
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

-- ---------------------------------------------------------------------------
-- 3. chunk_mastery — trava também na escrita direta
--
-- Camada extra: mesmo que apareça uma terceira rota para popular a agenda, um
-- `insert` vindo do PostgREST agora exige acesso liberado. Não afeta o app: as
-- únicas escritas passam pelas RPCs, que são SECURITY DEFINER.
-- ---------------------------------------------------------------------------
drop policy if exists "chunk_mastery_own" on public.chunk_mastery;
create policy "chunk_mastery_own" on public.chunk_mastery
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() and public.has_course_access());

-- ---------------------------------------------------------------------------
-- 4. Storage de áudio — hospedagem grátis para quem não pagou
--
-- A policy de upload exigia só conta ativa. Como o bucket aceita 25 MB por
-- arquivo, qualquer pessoa que criasse conta ganhava armazenamento ilimitado
-- na sua fatura do Supabase — sem nunca abrir uma lição.
--
-- A rota que sobe o áudio (`/api/speaking/analyze`) já exige pagamento desde a
-- migration anterior; isto fecha o acesso direto ao Storage, que não passa por
-- ela.
-- ---------------------------------------------------------------------------
drop policy if exists "speaking_audio_insert_own" on storage.objects;
create policy "speaking_audio_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'speaking-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_account()
    and public.has_course_access()
  );

-- ---------------------------------------------------------------------------
-- 5. live_sessions — mesma regra na escrita
-- ---------------------------------------------------------------------------
drop policy if exists "live_sessions_own" on public.live_sessions;
create policy "live_sessions_own" on public.live_sessions
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() and public.has_course_access());

drop policy if exists "speaking_sessions_own" on public.speaking_sessions;
create policy "speaking_sessions_own" on public.speaking_sessions
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check ((user_id = auth.uid() and public.has_course_access()) or public.is_admin());

/**
 * `courses` e `modules` FICAM abertos de propósito.
 *
 * Título, descrição, objetivos e "ao final deste canto você consegue" são
 * exatamente o texto que já está na página de vendas, visível para quem nem
 * conta tem. Trancá-los não protegeria nada e ainda quebraria qualquer tela de
 * catálogo antes da compra.
 */

notify pgrst, 'reload schema';
