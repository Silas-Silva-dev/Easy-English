-- ===========================================================================
-- InglishEasy — Row Level Security
--
-- Regras gerais:
--   * admin      -> acesso total a tudo
--   * instructor -> gerencia catalogo e revisa alunos, sem tocar em papeis
--   * student    -> le apenas conteudo publicado e escreve apenas o proprio dado
--   * conta so acessa conteudo se status = 'active' (e-mail verificado)
-- ===========================================================================

alter table public.profiles            enable row level security;
alter table public.admin_allowlist     enable row level security;
alter table public.courses             enable row level security;
alter table public.modules             enable row level security;
alter table public.lessons             enable row level security;
alter table public.lesson_resources    enable row level security;
alter table public.enrollments         enable row level security;
alter table public.lesson_progress     enable row level security;
alter table public.study_days          enable row level security;
alter table public.speaking_sessions   enable row level security;
alter table public.speaking_feedback   enable row level security;
alter table public.tutor_threads       enable row level security;
alter table public.tutor_messages      enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks    enable row level security;
alter table public.audit_log           enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Trava de escalonamento de privilegio: um usuario comum nao muda o proprio
-- papel nem o proprio status, mesmo passando pela policy de update acima.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Chamadas com service_role (scripts/admin API) tem auth.uid() nulo.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Nao e permitido alterar o proprio papel';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Nao e permitido alterar o proprio status de conta';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ---------------------------------------------------------------------------
-- admin_allowlist — somente admin
-- ---------------------------------------------------------------------------
drop policy if exists "allowlist_admin_all" on public.admin_allowlist;
create policy "allowlist_admin_all" on public.admin_allowlist
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- courses / modules / lessons / resources
-- ---------------------------------------------------------------------------
drop policy if exists "courses_select_published" on public.courses;
create policy "courses_select_published" on public.courses
  for select to authenticated
  using ((is_published and public.is_active_account()) or public.is_staff());

drop policy if exists "courses_staff_write" on public.courses;
create policy "courses_staff_write" on public.courses
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "modules_select_published" on public.modules;
create policy "modules_select_published" on public.modules
  for select to authenticated
  using (
    public.is_staff()
    or (
      is_published
      and public.is_active_account()
      and exists (select 1 from public.courses c where c.id = course_id and c.is_published)
    )
  );

drop policy if exists "modules_staff_write" on public.modules;
create policy "modules_staff_write" on public.modules
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "lessons_select_published" on public.lessons;
create policy "lessons_select_published" on public.lessons
  for select to authenticated
  using (
    public.is_staff()
    or (
      is_published
      and public.is_active_account()
      and exists (select 1 from public.courses c where c.id = course_id and c.is_published)
    )
  );

drop policy if exists "lessons_staff_write" on public.lessons;
create policy "lessons_staff_write" on public.lessons
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "lesson_resources_select" on public.lesson_resources;
create policy "lesson_resources_select" on public.lesson_resources
  for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.lessons l
       where l.id = lesson_id and l.is_published and public.is_active_account()
    )
  );

drop policy if exists "lesson_resources_staff_write" on public.lesson_resources;
create policy "lesson_resources_staff_write" on public.lesson_resources
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- enrollments / progresso / dias de estudo
-- ---------------------------------------------------------------------------
drop policy if exists "enrollments_own_select" on public.enrollments;
create policy "enrollments_own_select" on public.enrollments
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "enrollments_own_insert" on public.enrollments;
create policy "enrollments_own_insert" on public.enrollments
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_account());

drop policy if exists "enrollments_own_update" on public.enrollments;
create policy "enrollments_own_update" on public.enrollments
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "enrollments_admin_delete" on public.enrollments;
create policy "enrollments_admin_delete" on public.enrollments
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "lesson_progress_own" on public.lesson_progress;
create policy "lesson_progress_own" on public.lesson_progress
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "study_days_own" on public.study_days;
create policy "study_days_own" on public.study_days
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Tutor de conversacao
-- ---------------------------------------------------------------------------
drop policy if exists "speaking_sessions_own" on public.speaking_sessions;
create policy "speaking_sessions_own" on public.speaking_sessions
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "speaking_feedback_own_select" on public.speaking_feedback;
create policy "speaking_feedback_own_select" on public.speaking_feedback
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "speaking_feedback_admin_write" on public.speaking_feedback;
create policy "speaking_feedback_admin_write" on public.speaking_feedback
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "tutor_threads_own" on public.tutor_threads;
create policy "tutor_threads_own" on public.tutor_threads
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid());

drop policy if exists "tutor_messages_own" on public.tutor_messages;
create policy "tutor_messages_own" on public.tutor_messages
  for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Base de conhecimento — leitura para alunos ativos, escrita so por staff
-- ---------------------------------------------------------------------------
drop policy if exists "knowledge_documents_read" on public.knowledge_documents;
create policy "knowledge_documents_read" on public.knowledge_documents
  for select to authenticated
  using (public.is_active_account() or public.is_staff());

drop policy if exists "knowledge_documents_staff_write" on public.knowledge_documents;
create policy "knowledge_documents_staff_write" on public.knowledge_documents
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "knowledge_chunks_read" on public.knowledge_chunks;
create policy "knowledge_chunks_read" on public.knowledge_chunks
  for select to authenticated
  using (public.is_active_account() or public.is_staff());

drop policy if exists "knowledge_chunks_staff_write" on public.knowledge_chunks;
create policy "knowledge_chunks_staff_write" on public.knowledge_chunks
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Auditoria — leitura de admin; escrita apenas via service_role
-- ---------------------------------------------------------------------------
drop policy if exists "audit_log_admin_read" on public.audit_log;
create policy "audit_log_admin_read" on public.audit_log
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Revogacoes explicitas
-- ---------------------------------------------------------------------------
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

revoke all on function public.register_study_activity(uuid, integer, integer) from anon;
grant execute on function public.register_study_activity(uuid, integer, integer) to authenticated;

revoke all on function public.match_knowledge(vector, integer, uuid, float) from anon;
grant execute on function public.match_knowledge(vector, integer, uuid, float) to authenticated, service_role;
