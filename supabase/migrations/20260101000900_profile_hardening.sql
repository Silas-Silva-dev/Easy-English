-- ===========================================================================
-- Easy English — Perfil: a foto sai da linha, o fuso deixa de matar a ofensiva
--
-- Dois problemas achados na revisão da tela de Perfil. Nenhum deles é brecha de
-- segurança: são custo silencioso e perda silenciosa de dados.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. avatar_url volta a ser o que o nome diz: uma URL
--
-- A tela gravava o data URL base64 inteiro (~40-60 KB de texto) DENTRO da
-- coluna. E `getSessionContext()` faz `select *` em profiles a cada requisição
-- autenticada, então essa foto viajava em toda navegação, toda Server Action e
-- toda rota de API — além de ser reimpressa inline no HTML de cada página, onde
-- nenhum CDN consegue cachear.
--
-- O bucket `avatars` já existia desde a migration 200 (público, limite de 2 MB,
-- policies de dono corretas) e nunca tinha sido usado.
--
-- ⚠️  O update abaixo APAGA as fotos que já estão em base64. Não há como
--     convertê-las para o Storage por SQL — quem já tinha foto precisa subir de
--     novo, uma vez. É a única perda desta migration, e é de propósito: manter
--     as linhas antigas significaria manter o custo por requisição para sempre.
-- ---------------------------------------------------------------------------
-- Limpa TUDO que a constraint abaixo rejeitaria, não só os data URLs. Um
-- `alter table` que falha no meio por causa de uma linha inesperada deixaria a
-- migration pela metade; assim ela roda igual em qualquer estado do banco.
update public.profiles
   set avatar_url = null
 where avatar_url is not null
   and (avatar_url !~ '^https://' or length(avatar_url) > 512);

alter table public.profiles
  drop constraint if exists profiles_avatar_url_check;

/**
 * A trava vale para o PostgREST também, não só para a Server Action.
 *
 * A policy `profiles_update_own` permite ao aluno editar a própria linha, então
 * validar apenas no servidor Next não fecha nada: bastava um PATCH direto com a
 * anon key para gravar uma string de qualquer tamanho. O limite de 512 é folga
 * larga para uma URL pública do Storage (~120 caracteres).
 *
 * Exige https:// porque hoje os dois únicos caminhos que escrevem aqui são o
 * upload para o bucket (público, https) e `handle_new_user`, que copia
 * `raw_user_meta_data->>'avatar_url'` — sempre nulo no cadastro por e-mail.
 * Se um dia entrar login social, confira o formato que o provedor devolve antes
 * de ligar, senão o cadastro quebra aqui.
 */
alter table public.profiles
  add constraint profiles_avatar_url_check
  check (
    avatar_url is null
    or (avatar_url ~ '^https://' and length(avatar_url) <= 512)
  );

-- ---------------------------------------------------------------------------
-- 2. Fuso horário inválido não pode mais parar a ofensiva
--
-- `register_study_activity` fazia `now() at time zone v_tz`. Com um fuso que o
-- Postgres não reconhece, isso levanta exceção — e quem chama a função
-- (`completeLessonAction`) só faz `console.error` e segue em frente.
--
-- O efeito era o pior possível: a lição continuava marcando como concluída, mas
-- minutos, meta batida, ofensiva e última atividade paravam de ser gravados
-- PARA SEMPRE, sem nenhum sinal para o aluno nem erro na tela.
--
-- O formulário agora manda um enum fechado, mas a Server Action é um endpoint
-- público como qualquer outro: a garantia tem que estar aqui embaixo também.
-- Fuso desconhecido cai no horário de Brasília em vez de derrubar a função.
-- ---------------------------------------------------------------------------
create or replace function public.safe_timezone(p_tz text)
returns text
language sql
stable
set search_path = public
as $$
  select case
           when p_tz is not null
            and exists (select 1 from pg_timezone_names z where z.name = p_tz)
           then p_tz
           else 'America/Sao_Paulo'
         end;
$$;

grant execute on function public.safe_timezone(text) to authenticated, service_role;

-- Mesma função da migration 000, com uma linha trocada: `v_tz` agora passa por
-- `safe_timezone()`. O resto é idêntico.
create or replace function public.register_study_activity(
  p_enrollment_id uuid,
  p_minutes       integer default 0,
  p_lessons_done  integer default 0
)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.enrollments;
  v_today      date;
  v_tz         text;
  v_goal       integer;
  v_minutes    integer;
  v_streak     integer;
begin
  select e.* into v_enrollment
    from public.enrollments e
   where e.id = p_enrollment_id
     and (e.user_id = auth.uid() or public.is_admin());

  if v_enrollment.id is null then
    raise exception 'Matricula nao encontrada ou acesso negado';
  end if;

  select p.timezone, p.daily_goal_minutes into v_tz, v_goal
    from public.profiles p where p.id = v_enrollment.user_id;

  v_today := (now() at time zone public.safe_timezone(v_tz))::date;

  insert into public.study_days (user_id, enrollment_id, study_date, minutes, lessons_done, goal_met)
  values (v_enrollment.user_id, p_enrollment_id, v_today, greatest(p_minutes, 0), greatest(p_lessons_done, 0),
          greatest(p_minutes, 0) >= coalesce(v_goal, 15))
  on conflict (enrollment_id, study_date) do update
    set minutes      = public.study_days.minutes + greatest(excluded.minutes, 0),
        lessons_done = public.study_days.lessons_done + greatest(excluded.lessons_done, 0),
        goal_met     = (public.study_days.minutes + greatest(excluded.minutes, 0)) >= coalesce(v_goal, 15)
  returning minutes into v_minutes;

  -- Ofensiva = dias consecutivos com a meta batida, terminando hoje ou ontem.
  -- (Se o aluno ainda nao bateu a meta de hoje, a ofensiva de ontem e preservada;
  --  se o ultimo dia valido for anterior a ontem, a ofensiva foi perdida.)
  with ordered as (
    select study_date,
           row_number() over (order by study_date desc) as rn
      from public.study_days
     where enrollment_id = p_enrollment_id
       and goal_met
       and study_date <= v_today
  ),
  anchor as (
    select study_date as last_day from ordered where rn = 1
  )
  select case
           when (select last_day from anchor) is null          then 0
           when (select last_day from anchor) < v_today - 1    then 0
           else (
             select count(*)::int
               from ordered, anchor
              where ordered.study_date = anchor.last_day - (ordered.rn - 1)
           )
         end
    into v_streak;

  update public.enrollments
     set minutes_total      = minutes_total + greatest(p_minutes, 0),
         lessons_completed  = lessons_completed + greatest(p_lessons_done, 0),
         last_activity_date = v_today,
         streak_current     = coalesce(v_streak, 0),
         streak_longest     = greatest(streak_longest, coalesce(v_streak, 0))
   where id = p_enrollment_id
  returning * into v_enrollment;

  return v_enrollment;
end;
$$;

-- Conserta quem já esteja com um fuso que o Postgres não reconhece: sem isto,
-- a função passaria a funcionar mas o aluno seguiria em Brasília sem saber.
update public.profiles
   set timezone = 'America/Sao_Paulo'
 where not exists (select 1 from pg_timezone_names z where z.name = profiles.timezone);

notify pgrst, 'reload schema';
