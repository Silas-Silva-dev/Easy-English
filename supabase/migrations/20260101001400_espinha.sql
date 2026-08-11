-- ===========================================================================
-- Easy English — A espinha do método, no banco
--
-- `content/metodo/PENDENCIAS.md` listou dezesseis coisas sem as quais algum
-- pedaço do método é inimplementável. Quatro foram resolvidas no conteúdo
-- (bucket de áudio, família do bloco, quatro movimentos, orçamento da
-- Essencial). Esta migration resolve as que moram no banco, e todas elas têm
-- o mesmo formato de defeito: uma regra que o produto descreve em prosa e que
-- nenhuma consulta sabe avaliar.
--
--   1. study_days.input_minutes ......... o portão pede "11 dos 14 dias com o
--                                          input registrado" e não existia
--                                          coluna de escuta em lugar nenhum
--   2. teto, sanguessuga e decaimento ... a fila era dívida que só crescia:
--                                          `lapses` era monotônico, então
--                                          nenhum dos 52 portões podia usá-lo
--   3. is_mastered() .................... três réguas para a mesma palavra
--   5. baralho por trilha ............... a Essencial recebia 1.193 blocos
--                                          para 9 cartões/dia de orçamento
--   6. circuit_gate_status .............. os 52 portões não tinham onde ser
--                                          calculados nem exibidos
--  10. listening_exposures ............. o portão de escuta vivia em useState:
--                                          um F5 zerava
--  16. goal_met por trilha ............. o aluno do Intensivo batia a meta
--                                          com 15 minutos
--
-- O QUE ESTA MIGRATION NÃO FAZ: trancar nada. O portão é diagnóstico, não
-- fechadura — é decisão de produto e está no cabeçalho de content/metodo.
-- `circuit_gate_status` existe para o aluno ver POR QUE passou ou não, e para
-- a quinzena seguinte saber o que repetir. Nenhuma consulta aqui nega acesso
-- a conteúdo pago.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. O dia de estudo passa a saber quanto INPUT houve
--
-- `minutes` soma minutos de qualquer atividade, vindos do cliente, num número
-- só. "O input da sessão foi registrado hoje" não tinha onde ser lido, e é
-- exatamente o que os 52 portões do Completo pedem — todos eles, inclusive os
-- quatro fechamentos.
--
-- `input_minutes` é escrita só pelo player de áudio, e só com a aba em
-- primeiro plano: minuto autodeclarado que destranca conteúdo ensina o aluno a
-- mentir. `queue_cleared` é o segundo sinal que faltava — os portões da
-- Essencial pedem "10 dos 14 dias com a fila zerada", e um dia sem fila
-- vencida conta como zerado.
-- ---------------------------------------------------------------------------
alter table public.study_days
  add column if not exists input_minutes integer not null default 0,
  add column if not exists queue_cleared boolean not null default false;

comment on column public.study_days.input_minutes is
  'Minutos de escuta medidos pelo player, com a aba em primeiro plano. Nunca autodeclarados.';
comment on column public.study_days.queue_cleared is
  'A fila de revisão terminou o dia zerada. Dia sem fila vencida conta como zerado.';

/**
 * Os minutos que a trilha do aluno promete.
 *
 * `track_targets` já é a fonte da verdade da promessa (20/60/100). O que
 * faltava era alguém consultá-la: `register_study_activity` comparava contra
 * `profiles.daily_goal_minutes` com fallback 15, e um aluno do Intensivo
 * fechava a meta do dia — e mantinha a ofensiva — com 15 dos 100 minutos que
 * comprou.
 */
create or replace function public.track_daily_minutes(p_track public.study_track)
returns integer
language sql
stable
set search_path = public
as $$
  select daily_minutes from public.track_targets where track = p_track;
$$;

revoke all    on function public.track_daily_minutes(public.study_track) from public, anon;
grant execute on function public.track_daily_minutes(public.study_track) to authenticated, service_role;

-- A versão de três argumentos sai antes: com um quarto parâmetro só com
-- `default`, as duas assinaturas coexistiriam e toda chamada de três
-- argumentos viraria "function is not unique" — erro em tempo de execução, na
-- conclusão de cada lição, para todo mundo ao mesmo tempo.
drop function if exists public.register_study_activity(uuid, integer, integer);

create or replace function public.register_study_activity(
  p_enrollment_id uuid,
  p_minutes       integer default 0,
  p_lessons_done  integer default 0,
  p_input_minutes integer default 0
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
  v_streak     integer;
begin
  select e.* into v_enrollment
    from public.enrollments e
   where e.id = p_enrollment_id
     and (e.user_id = auth.uid() or public.is_admin());

  if v_enrollment.id is null then
    raise exception 'Matricula nao encontrada ou acesso negado';
  end if;

  select p.timezone into v_tz
    from public.profiles p where p.id = v_enrollment.user_id;

  -- A meta agora vem da TRILHA, não do perfil. Ver track_daily_minutes.
  v_goal := coalesce(public.track_daily_minutes(v_enrollment.track), 20);

  v_today := (now() at time zone public.safe_timezone(v_tz))::date;

  insert into public.study_days (
    user_id, enrollment_id, study_date, minutes, input_minutes, lessons_done, goal_met
  )
  values (
    v_enrollment.user_id, p_enrollment_id, v_today,
    greatest(p_minutes, 0), greatest(p_input_minutes, 0), greatest(p_lessons_done, 0),
    greatest(p_minutes, 0) >= v_goal
  )
  on conflict (enrollment_id, study_date) do update
    set minutes       = public.study_days.minutes + greatest(excluded.minutes, 0),
        input_minutes = public.study_days.input_minutes + greatest(excluded.input_minutes, 0),
        lessons_done  = public.study_days.lessons_done + greatest(excluded.lessons_done, 0),
        goal_met      = (public.study_days.minutes + greatest(excluded.minutes, 0)) >= v_goal;

  -- Ofensiva = dias consecutivos com a meta batida, terminando hoje ou ontem.
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
           when (select last_day from anchor) is null       then 0
           when (select last_day from anchor) < v_today - 1 then 0
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

revoke all on function public.register_study_activity(uuid, integer, integer, integer) from public, anon;
grant execute on function public.register_study_activity(uuid, integer, integer, integer)
  to authenticated, service_role;

/**
 * O dia terminou com a fila zerada.
 *
 * Chamada pela tela de revisão quando não sobra nenhum bloco vencido — e
 * também quando não havia nenhum, que é o que a prosa dos portões manda
 * ("dia sem fila vencida conta como zerado"). Idempotente.
 */
create or replace function public.mark_queue_cleared()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enr   public.enrollments;
  v_tz    text;
  v_today date;
begin
  select e.* into v_enr
    from public.enrollments e
   where e.user_id = auth.uid() and e.status = 'active'
   order by e.created_at desc
   limit 1;

  if v_enr.id is null then
    return false;
  end if;

  select p.timezone into v_tz from public.profiles p where p.id = v_enr.user_id;
  v_today := (now() at time zone public.safe_timezone(v_tz))::date;

  insert into public.study_days (user_id, enrollment_id, study_date, queue_cleared)
  values (v_enr.user_id, v_enr.id, v_today, true)
  on conflict (enrollment_id, study_date) do update set queue_cleared = true;

  return true;
end;
$$;

revoke all on function public.mark_queue_cleared() from public, anon;
grant execute on function public.mark_queue_cleared() to authenticated;

/**
 * O "hoje" do aluno, e não o do servidor.
 *
 * A sessão do Postgres roda em UTC e os oito fusos que o app oferece são todos
 * de UTC−2 a UTC−5. `current_date` cru, portanto, vira o dia SEGUINTE entre 21h
 * e a meia-noite no Brasil — e é exatamente nesse intervalo que quem estuda
 * depois do jantar usa o produto.
 *
 * O estrago era de duas pontas. `review_chunk` agendava `current_date + 1` às
 * 22h e o cartão "de amanhã" já nascia com data de depois de amanhã na conta do
 * aluno. E a tela de revisão, que lê o dia no fuso do perfil, não achava
 * cartão nenhum às 22h — o que fazia a fila parecer zerada e dava crédito de
 * "dia com a fila zerada" ao portão da Essencial sem um cartão respondido.
 *
 * Consertar do lado do banco, e não do lado da tela, porque é o banco que
 * ESCREVE a data: uma tela em UTC concordaria com um banco em UTC, mas as duas
 * estariam erradas juntas sobre quando é o dia do aluno.
 */
create or replace function public.today_for(p_user uuid)
returns date
language sql
stable
set search_path = public
as $$
  select (
    now() at time zone public.safe_timezone(
      (select p.timezone from public.profiles p where p.id = p_user)
    )
  )::date;
$$;

revoke all    on function public.today_for(uuid) from public, anon;
grant execute on function public.today_for(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2 e 5. A fila deixa de ser dívida, e cada trilha recebe o próprio baralho
-- ---------------------------------------------------------------------------
alter table public.chunk_mastery
  -- Bloco do NÚCLEO: o recorte que a Essencial estuda. nucleo(N) =
  -- min(10, ceil(0,32 x blocosNovos(N))), que dá 359 dos 1.193 no curso
  -- inteiro. Conferido contra os 48 portões da Essencial, que citam esse
  -- denominador por extenso ("2 dos 3 blocos do núcleo deste circuito").
  add column if not exists is_core boolean not null default true,
  -- Acertos seguidos desde o último lapso. Existe para `lapses` poder DESCER.
  add column if not exists correct_streak smallint not null default 0,
  -- Sanguessuga: sai da agenda e volta como conteúdo. Ver review_chunk.
  add column if not exists suspended_at timestamptz;

comment on column public.chunk_mastery.is_core is
  'Bloco do núcleo — o baralho da trilha Essencial. min(10, ceil(0,32 x blocos novos do circuito)).';
comment on column public.chunk_mastery.correct_streak is
  'Acertos consecutivos desde o último lapso. Aos 3, um lapso é perdoado.';
comment on column public.chunk_mastery.suspended_at is
  'Sanguessuga: 8 lapsos tiraram o bloco da agenda. Ele volta como conteúdo da lição, não como cartão.';

-- O índice de fila passa a existir só para o que a fila realmente lê.
create index if not exists chunk_mastery_active_idx
  on public.chunk_mastery (user_id, due_date)
  where suspended_at is null;
create index if not exists chunk_mastery_core_idx
  on public.chunk_mastery (user_id, circuit_number)
  where is_core;

/**
 * Uma única definição de "dominado".
 *
 * Havia três, e elas discordavam: `masteryStage` em srs.ts pedia
 * `repetitions >= 4 and ease >= 2,3 and spoken_count >= 2`; a view
 * `chunk_review_queue` pedia `repetitions >= 3 and ease >= 2,3` e ignorava a
 * fala; e os 52 portões pediam uma terceira coisa. O app lia a view para os
 * agregados e a função TS para a tela do bloco, então o aluno via dois números
 * diferentes para a mesma palavra na mesma sessão.
 *
 * A cláusula de `ease_factor` só voltou a ser alcançável depois que
 * `gradeFromRecall` passou a devolver 4 no "hesitei" — o degrau neutro do
 * SM-2. Antes disso ela era catraca de mão única e "dominado" era impossível
 * para quem revisava todos os dias.
 *
 * A Essencial não cobra produção falada porque não grava: os 52 portões dela
 * dizem isso por extenso. Não é régua mais frouxa, é a régua do que a trilha
 * mede.
 */
create or replace function public.is_mastered(
  p_repetitions integer,
  p_ease        numeric,
  p_spoken      integer,
  p_track       public.study_track default 'complete'
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_repetitions, 0) >= 4
     and coalesce(p_ease, 0) >= 2.30
     and (p_track = 'essential' or coalesce(p_spoken, 0) >= 2);
$$;

-- `chunk_review_queue` e `security_invoker`, entao quem PRECISA do EXECUTE aqui
-- e o proprio aluno: sem o grant, toda consulta da fila morre em "permission
-- denied for function".
revoke all    on function public.is_mastered(integer, numeric, integer, public.study_track)
  from public, anon;
grant execute on function public.is_mastered(integer, numeric, integer, public.study_track)
  to authenticated, service_role;

-- Mesma razão do drop acima: `p_track` com default tornaria ambígua toda
-- chamada de dois argumentos enquanto a versão antiga existisse.
drop function if exists public.enroll_circuit_chunks(uuid, integer);

/**
 * Matricula os blocos de um circuito na agenda do aluno, respeitando a trilha.
 *
 * A versão anterior matriculava o circuito inteiro sem olhar a trilha. A
 * Essencial tem 3 minutos de Memória por dia — 9 cartões a 20 s — e 1.193
 * blocos exigem cerca de 33 por dia em regime: a fila dela estourava em três
 * meses e os 52 portões ficavam impossíveis pelo mesmo motivo que os do
 * Completo estavam.
 *
 * O núcleo é `min(10, ceil(0,32 x blocos novos do circuito))`, e a ordem do
 * recorte é a do próprio array de chunks do circuito — `with ordinality`, não
 * `random()`: dois alunos da mesma trilha precisam receber o MESMO núcleo, e o
 * portão cita o denominador por extenso.
 *
 * Continua idempotente: rodar de novo não zera o progresso de quem já revisou.
 */
create or replace function public.enroll_circuit_chunks(
  p_course_id      uuid,
  p_circuit_number integer,
  p_track          public.study_track default 'complete'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_total  integer := 0;
  v_nucleo integer := 0;
  v_count  integer := 0;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;

  select jsonb_array_length(c.chunks) into v_total
    from public.circuits c
   where c.course_id = p_course_id and c.number = p_circuit_number;

  if v_total is null or v_total = 0 then
    return 0;
  end if;

  v_nucleo := least(10, ceil(0.32 * v_total)::integer);

  insert into public.chunk_mastery (
    user_id, course_id, circuit_number, chunk_key, chunk_en, chunk_pt, is_core, due_date
  )
  select
    v_user,
    p_course_id,
    p_circuit_number,
    regexp_replace(lower(trim(item.chunk ->> 'en')), '[^a-z0-9]+', '-', 'g'),
    item.chunk ->> 'en',
    coalesce(item.chunk ->> 'pt', ''),
    item.pos <= v_nucleo,
    -- O default da coluna é `current_date`, que é UTC. Ver `today_for`.
    public.today_for(v_user)
  from public.circuits c,
       lateral jsonb_array_elements(c.chunks) with ordinality as item(chunk, pos)
  where c.course_id = p_course_id
    and c.number = p_circuit_number
    and coalesce(trim(item.chunk ->> 'en'), '') <> ''
    -- A Essencial recebe só o núcleo. As outras duas recebem tudo.
    and (p_track <> 'essential' or item.pos <= v_nucleo)
  on conflict (user_id, chunk_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.enroll_circuit_chunks(uuid, integer, public.study_track) from public, anon;
grant execute on function public.enroll_circuit_chunks(uuid, integer, public.study_track) to authenticated;

/**
 * SM-2 com duas regras que faltavam: o lapso perdoado e a sanguessuga.
 *
 * `lapses` era monotônico — só subia, nunca descia — e por isso era uma
 * condenação permanente em vez de um diagnóstico. Nenhum dos 52 portões podia
 * usá-lo, e `masteryStage` marcava como "Travado" quem tinha errado três vezes
 * em janeiro e acertado cem desde então.
 *
 *   PERDÃO: três acertos seguidos apagam um lapso. Três porque é o mesmo
 *   número de acertos que o SM-2 leva para sair do intervalo curto (1, 6,
 *   depois × ease): quem atravessou os três degraus reaprendeu o bloco.
 *
 *   SANGUESSUGA: aos 8 lapsos o bloco SAI DA AGENDA. Não é castigo, é
 *   aritmética: um bloco que falhou 8 vezes está consumindo revisão que outros
 *   1.192 blocos precisam, e mais uma passada dele não vai resolver. Ele volta
 *   como CONTEÚDO — a lição continua ensinando o bloco — mas para de aparecer
 *   como cartão. Oito é o que sobra depois do perdão: chegar lá exige errar
 *   oito vezes sem emendar três acertos.
 */
create or replace function public.review_chunk(
  p_chunk_key text,
  p_grade     integer
)
returns public.chunk_mastery
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     public.chunk_mastery;
  v_ef      numeric(4,2);
  v_int     integer;
  v_reps    integer;
  v_lapses  integer;
  v_streak  integer;
  v_susp    timestamptz;
begin
  select * into v_row
    from public.chunk_mastery
   where user_id = auth.uid() and chunk_key = p_chunk_key;

  if v_row.id is null then
    raise exception 'Chunk % não está na sua agenda', p_chunk_key;
  end if;

  if p_grade < 0 or p_grade > 5 then
    raise exception 'Nota deve estar entre 0 e 5';
  end if;

  v_ef := greatest(
    1.30,
    v_row.ease_factor + (0.10 - (5 - p_grade) * (0.08 + (5 - p_grade) * 0.02))
  );

  if p_grade < 3 then
    v_reps   := 0;
    v_int    := 1;
    v_lapses := v_row.lapses + 1;
    v_streak := 0;
  else
    v_reps   := v_row.repetitions + 1;
    v_int    := case
                  when v_reps = 1 then 1
                  when v_reps = 2 then 6
                  else greatest(1, round(v_row.interval_days * v_ef)::integer)
                end;
    v_streak := v_row.correct_streak + 1;
    v_lapses := v_row.lapses;

    -- Três acertos seguidos perdoam um lapso, e o contador recomeça.
    if v_streak >= 3 and v_lapses > 0 then
      v_lapses := v_lapses - 1;
      v_streak := 0;
    end if;
  end if;

  -- Sanguessuga. Um bloco já suspenso que volta a ser revisado (o aluno pode
  -- reencontrá-lo pelo conteúdo) sai da suspensão ao primeiro acerto.
  v_susp := case
              when v_lapses >= 8 then coalesce(v_row.suspended_at, now())
              when p_grade >= 3  then null
              else v_row.suspended_at
            end;

  update public.chunk_mastery
     set ease_factor      = v_ef,
         repetitions      = v_reps,
         interval_days    = v_int,
         lapses           = v_lapses,
         correct_streak   = v_streak,
         suspended_at     = v_susp,
         due_date         = public.today_for(auth.uid()) + v_int,
         last_grade       = p_grade,
         last_reviewed_at = now()
   where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.review_chunk(text, integer) from public, anon;
grant execute on function public.review_chunk(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- A visão do dia passa a falar a mesma língua que a tela do bloco
--
-- `mastered` usava `repetitions >= 3` e ignorava a fala; `masteryStage` usava
-- `>= 4` e exigia duas produções. Agora as duas chamam `is_mastered`, e o
-- recorte respeita a trilha do aluno. Os suspensos saem de `due_today` — eles
-- não são agenda — e ganham coluna própria, porque sumir sem aparecer em lugar
-- nenhum é como o aluno perde blocos sem saber.
-- ---------------------------------------------------------------------------
create or replace view public.chunk_review_queue
with (security_invoker = true) as
select
  m.user_id,
  count(*) filter (
    where m.due_date <= coalesce(t.hoje, current_date) and m.suspended_at is null
  )                                                                as due_today,
  count(*) filter (
    where m.due_date <= coalesce(t.hoje, current_date) + 1 and m.suspended_at is null
  )                                                                as due_tomorrow,
  count(*)                                                         as total_chunks,
  count(*) filter (
    where public.is_mastered(m.repetitions, m.ease_factor, m.spoken_count,
                             coalesce(t.track, 'complete'))
  )                                                                as mastered,
  count(*) filter (where m.lapses >= 3 and m.suspended_at is null) as struggling,
  count(*) filter (where m.suspended_at is not null)               as suspended
from public.chunk_mastery m
-- Uma junção lateral por ALUNO, e não uma chamada de função por bloco: a
-- forma anterior resolvia `today_for(m.user_id)` uma vez para cada uma das até
-- 1.193 linhas do acervo, sempre com a mesma resposta.
left join lateral (
  select e.track, public.today_for(m.user_id) as hoje
    from public.enrollments e
   where e.user_id = m.user_id
   order by e.created_at desc
   limit 1
) t on true
group by m.user_id;

-- ---------------------------------------------------------------------------
-- 10. O portão de escuta passa a existir fora do React
--
-- Ele vivia em `useState(0)`: um F5 zerava o contador e um botão "Mostrar o
-- texto agora" abria tudo em um clique. Portão com botão de pular é conselho
-- com animação — e o diagnóstico do próprio curso diz que ler antes de ouvir
-- instala fonema português sobre grafia inglesa, e que desfazer isso custa
-- caro.
--
-- `exposure_key` é `c{circuito}d{dia}:{papel}` para as peças e o próprio
-- `chunk_key` para os blocos, reusando a identidade estável que
-- `chunk_mastery` já tem.
-- ---------------------------------------------------------------------------
create table if not exists public.listening_exposures (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  exposure_key    text not null,
  required_plays  smallint not null,
  plays           smallint not null default 0,
  first_played_at timestamptz,
  last_played_at  timestamptz,
  unlocked_at     timestamptz,
  /** Aberto pela exceção de acessibilidade, não por escuta. */
  forced          boolean not null default false,
  created_at      timestamptz not null default now(),
  primary key (user_id, exposure_key)
);

create index if not exists listening_exposures_open_idx
  on public.listening_exposures (user_id)
  where unlocked_at is not null;

alter table public.listening_exposures enable row level security;

-- Leitura própria e nada mais. A escrita é exclusiva das duas funções abaixo,
-- que são `security definer`: sem isso o cliente daria um UPDATE em `plays` e
-- o portão viraria enfeite por outro caminho.
drop policy if exists "listening_exposures_read_own" on public.listening_exposures;
create policy "listening_exposures_read_own" on public.listening_exposures
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

revoke insert, update, delete on public.listening_exposures from anon, authenticated;
-- Explícito, e não herdado dos privilégios padrão do schema: a RLS acima só
-- protege quem já tem SELECT, e sem o grant a fila de exposições falharia em
-- "permission denied" em vez de vir vazia.
grant select on public.listening_exposures to authenticated;

/**
 * Quantas escutas o circuito exige antes de o texto abrir.
 *
 * 4 no Canto 1, 3 no Canto 2, 2 nos Cantos 3 e 4 — os números de
 * `content/metodo/orcamento.json`. A queda não é afrouxamento: no Canto 1 o
 * portão existe para impedir que o fonema português seja instalado sobre a
 * grafia inglesa; do Canto 3 em diante o aluno já decodifica de ouvido, e o
 * que resta é garantir uma passada cega antes da leitura. Duas é o mínimo que
 * ainda garante essa passada.
 */
create or replace function public.required_plays(p_circuit integer)
returns smallint
language sql
immutable
set search_path = public
as $$
  select case
           when coalesce(p_circuit, 1) <= 13 then 4
           when p_circuit <= 26              then 3
           else 2
         end::smallint;
$$;

revoke all    on function public.required_plays(integer) from public, anon;
grant execute on function public.required_plays(integer) to authenticated, service_role;

/**
 * Uma escuta completa a mais.
 *
 * O cliente NÃO manda quantas escutas faltam, e nem poderia: o número vem do
 * circuito, e o circuito vem da própria chave (`c14d4:escuta`) ou, para bloco,
 * de `chunk_mastery.circuit_number`. Um cliente hostil que chamasse esta
 * função com `required_plays = 1` não conseguiria nada.
 *
 * `p_min_seconds` é a duração do áudio, e serve para uma coisa só: duas
 * chamadas separadas por menos que isso não contam duas vezes. O piso de 5
 * segundos existe porque o parâmetro vem do cliente — sem ele, mandar zero
 * devolveria o defeito que esta migration está consertando.
 */
create or replace function public.count_listen(
  p_exposure_key text,
  p_min_seconds  integer default 0
)
returns public.listening_exposures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_circuit  integer;
  v_required smallint;
  v_janela   interval;
  v_row      public.listening_exposures;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;

  if coalesce(trim(p_exposure_key), '') = '' or length(p_exposure_key) > 200 then
    raise exception 'Chave de exposição inválida';
  end if;

  -- `c14d4:escuta` traz o circuito na própria chave.
  v_circuit := nullif(substring(p_exposure_key from '^c(\d+)d\d+:'), '')::integer;

  -- Bloco: a identidade é o chunk_key, e o circuito está na agenda do aluno.
  if v_circuit is null then
    select cm.circuit_number into v_circuit
      from public.chunk_mastery cm
     where cm.user_id = v_user and cm.chunk_key = p_exposure_key;
  end if;

  v_required := public.required_plays(coalesce(v_circuit, 1));
  v_janela   := make_interval(secs => least(greatest(coalesce(p_min_seconds, 0), 5), 600));

  insert into public.listening_exposures (
    user_id, exposure_key, required_plays, plays, first_played_at, last_played_at, unlocked_at
  )
  values (
    v_user, p_exposure_key, v_required, 1, now(), now(),
    case when v_required <= 1 then now() end
  )
  on conflict (user_id, exposure_key) do update
    set required_plays = v_required,
        plays = case
                  -- Escuta dentro da janela do áudio anterior: é a mesma.
                  when public.listening_exposures.last_played_at is not null
                   and now() - public.listening_exposures.last_played_at < v_janela
                  then public.listening_exposures.plays
                  else public.listening_exposures.plays + 1
                end,
        last_played_at = now(),
        first_played_at = coalesce(public.listening_exposures.first_played_at, now())
  returning * into v_row;

  -- Destrava uma vez, para sempre. Nunca volta a trancar.
  if v_row.unlocked_at is null and v_row.plays >= v_row.required_plays then
    update public.listening_exposures
       set unlocked_at = now()
     where user_id = v_user and exposure_key = p_exposure_key
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.count_listen(text, integer) from public, anon;
grant execute on function public.count_listen(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Quem já ouviu não ouve de novo
--
-- O portão nasce fechado para todo par (aluno, peça) que não tem linha. Sem
-- esta carga inicial, o aluno que concluiu o dia 1 semana passada reabriria a
-- lição hoje e encontraria a transcrição trancada atrás de quatro escutas — de
-- um diálogo que ele já ouviu, numa lição que ele já terminou, e agora sem o
-- botão "Mostrar o texto agora", que foi embora junto.
--
-- Isso não é o portão funcionando: é o portão cobrando duas vezes. O critério
-- da carga é conservador de propósito — só lição CONCLUÍDA, e só peça que de
-- fato tranca alguma coisa (`content.gated` não vazio). Quem parou no meio do
-- dia 1 continua tendo que ouvir, que é o certo.
--
-- `forced` fica em false: não foi dispensa de áudio, foi lição cumprida. E o
-- `on conflict do nothing` deixa a carga ser reaplicada sem apagar contagem de
-- ninguém.
-- ---------------------------------------------------------------------------
insert into public.listening_exposures (
  user_id, exposure_key, required_plays, plays, first_played_at, last_played_at, unlocked_at
)
select distinct
  lp.user_id,
  'c' || l.week_number || 'd'
      || case when l.immersion_script is not null then 1 else 4 end
      || case when l.immersion_script is not null then ':imersao' else ':escuta' end,
  public.required_plays(l.week_number),
  public.required_plays(l.week_number),
  lp.completed_at,
  lp.completed_at,
  lp.completed_at
from public.lesson_progress lp
join public.lessons l on l.id = lp.lesson_id
where lp.status = 'completed'
  and lp.completed_at is not null
  and (l.immersion_script is not null or l.listening_script is not null)
  and jsonb_array_length(coalesce(l.content -> 'gated', '[]'::jsonb)) > 0
on conflict (user_id, exposure_key) do nothing;

-- A exceção de acessibilidade deixa de ser um link em cada tela e vira uma
-- marca de perfil: aplicada uma vez, registrada, e válida para o curso todo.
alter table public.profiles
  add column if not exists audio_exempt boolean not null default false;

comment on column public.profiles.audio_exempt is
  'Aluno surdo ou com deficiência auditiva: as exposições abrem sem escuta. Marca de perfil, não botão de tela.';

-- ---------------------------------------------------------------------------
-- A dispensa de áudio não é auto-atribuível
--
-- `profiles_update_own` (rls.sql:737) libera a linha inteira para o dono, e a
-- API REST aceita PATCH em qualquer coluna que a policy alcance. Sem esta
-- guarda, `audio_exempt` seria o botão "Mostrar o texto agora" de volta — a
-- dois cliques de distância no inspetor, e sem nem o rótulo de acessibilidade
-- que justifica a exceção.
--
-- A guarda é o mesmo gatilho que já impede o aluno de mudar o próprio papel e
-- o próprio status: uma coluna a mais na mesma lista. `auth.uid() is null`
-- continua passando, que é como o service_role e o suporte marcam a dispensa
-- de quem de fato precisa dela.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Chamadas com service_role (scripts, admin API) e triggers do GoTrue têm
  -- auth.uid() nulo — é por aí que o bootstrap de admin funciona.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Nao e permitido alterar o proprio papel';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Nao e permitido alterar o proprio status de conta';
  end if;

  -- O e-mail do perfil é um espelho de auth.users, nunca um campo livre.
  if new.email is distinct from old.email
     and new.email is distinct from (select u.email from auth.users u where u.id = new.id)
  then
    raise exception 'E-mail e sincronizado a partir do cadastro, nao pode ser editado aqui';
  end if;

  if new.audio_exempt is distinct from old.audio_exempt then
    raise exception 'A dispensa de audio e concedida pelo suporte, nao pelo proprio aluno';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_privileges() from public, anon, authenticated;

/**
 * Abre uma exposição sem escuta, para quem não pode ouvir.
 *
 * Só funciona com `profiles.audio_exempt`. É o único caminho que existe para
 * abrir sem ouvir, e ele deixa rastro em `forced` — o botão "Mostrar o texto
 * agora", que qualquer aluno clicava, foi embora.
 */
create or replace function public.unlock_exposure(p_exposure_key text)
returns public.listening_exposures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_exempt boolean;
  v_row    public.listening_exposures;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;

  select p.audio_exempt into v_exempt from public.profiles p where p.id = v_user;

  if not coalesce(v_exempt, false) then
    raise exception 'Esta conta não tem a dispensa de áudio';
  end if;

  insert into public.listening_exposures (
    user_id, exposure_key, required_plays, plays, unlocked_at, forced
  )
  values (v_user, p_exposure_key, 0, 0, now(), true)
  on conflict (user_id, exposure_key) do update
    set unlocked_at = coalesce(public.listening_exposures.unlocked_at, now()),
        forced = true
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.unlock_exposure(text) from public, anon;
grant execute on function public.unlock_exposure(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Os 52 portões ganham onde ser calculados e exibidos
--
-- Eram a espinha do produto e não tinham tabela, view nem função: "passou o
-- circuito 14" era uma frase do briefing. O aluno não via por que passou ou
-- não, e nenhuma tela podia mostrar o que faltava.
--
-- `circuit_gates` guarda o CRITÉRIO, extraído da prosa de rampa.json por
-- content/metodo/portoes.ts e semeado por scripts/seed-curriculum.ts — a prosa
-- continua sendo a fonte, e é ela que vai para a tela em `prose`.
-- `circuit_gate_status` guarda a AVALIAÇÃO de um aluno, com o valor medido ao
-- lado do exigido em cada componente.
-- ---------------------------------------------------------------------------
create table if not exists public.circuit_gates (
  track          public.study_track not null,
  circuit_number integer not null,
  is_closing     boolean not null default false,
  /** [{ tipo, exigido, de, repeticoes, faladas, escopo, circuito, minimo }] */
  components     jsonb not null default '[]'::jsonb,
  /** A prosa original. É o que o aluno lê. */
  prose          text not null default '',
  updated_at     timestamptz not null default now(),
  primary key (track, circuit_number)
);

alter table public.circuit_gates enable row level security;

drop policy if exists "circuit_gates_read" on public.circuit_gates;
create policy "circuit_gates_read" on public.circuit_gates
  for select to authenticated using (true);

revoke insert, update, delete on public.circuit_gates from anon;
grant select on public.circuit_gates to authenticated;

drop policy if exists "circuit_gates_admin_write" on public.circuit_gates;
create policy "circuit_gates_admin_write" on public.circuit_gates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.circuit_gate_status (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  course_id      uuid not null references public.courses (id) on delete cascade,
  circuit_number integer not null,
  track          public.study_track not null,
  evaluated_at   timestamptz not null default now(),
  passed         boolean not null default false,
  /** [{ tipo, rotulo, exigido, medido, de, passou }] */
  components     jsonb not null default '[]'::jsonb,
  primary key (user_id, circuit_number)
);

create index if not exists circuit_gate_status_user_idx
  on public.circuit_gate_status (user_id, circuit_number);

alter table public.circuit_gate_status enable row level security;

drop policy if exists "circuit_gate_status_own" on public.circuit_gate_status;
create policy "circuit_gate_status_own" on public.circuit_gate_status
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- Escrita só pela função de avaliação: um portão que o cliente pode gravar não
-- diagnostica nada.
revoke insert, update, delete on public.circuit_gate_status from anon, authenticated;
grant select on public.circuit_gate_status to authenticated;

/**
 * Avalia o portão de um circuito e guarda o resultado.
 *
 * Cada componente vira uma linha do JSON com o valor MEDIDO ao lado do
 * EXIGIDO: é isso que permite a tela dizer "faltam 2 dos 14 dias com input" em
 * vez de "você não passou". `passed` é a conjunção de todos.
 *
 * Nada aqui tranca nada. Ver o cabeçalho desta migration.
 */
create or replace function public.evaluate_circuit_gate(
  p_course_id      uuid,
  p_circuit_number integer
)
returns public.circuit_gate_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_enr      public.enrollments;
  v_tz       text;
  v_gate     public.circuit_gates;
  v_comp     jsonb;
  v_saida    jsonb := '[]'::jsonb;
  v_medido   numeric;
  v_exigido  numeric;
  v_passou   boolean;
  v_todos    boolean := true;
  v_escopo   text;
  v_status   public.circuit_gate_status;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;

  select e.* into v_enr
    from public.enrollments e
   where e.user_id = v_user and e.course_id = p_course_id
   limit 1;

  if v_enr.id is null then
    raise exception 'Matrícula não encontrada';
  end if;

  select * into v_gate
    from public.circuit_gates
   where track = v_enr.track and circuit_number = p_circuit_number;

  if v_gate.circuit_number is null then
    raise exception 'Portão do circuito % não foi semeado para a trilha %',
      p_circuit_number, v_enr.track;
  end if;

  select p.timezone into v_tz from public.profiles p where p.id = v_user;

  for v_comp in select * from jsonb_array_elements(v_gate.components)
  loop
    v_escopo  := coalesce(v_comp ->> 'escopo', 'todos');
    v_exigido := coalesce((v_comp ->> 'exigido')::numeric, (v_comp ->> 'minimo')::numeric, 0);
    v_medido  := 0;

    case v_comp ->> 'tipo'

      -- Dias do circuito em que houve input medido. O elo entre `study_days`
      -- (que é por data) e o circuito (que é por dia de lição) é a data em que
      -- a lição foi concluída, no fuso do aluno.
      -- DISTINCT no dia, não na lição: o portão mede hábito espalhado por
      -- catorze dias, e quem faz catorze lições num sábado tem um dia de
      -- input, não catorze.
      when 'input' then
        select count(distinct sd.study_date) into v_medido
          from public.lesson_progress lp
          join public.lessons l on l.id = lp.lesson_id
          join public.study_days sd
            on sd.enrollment_id = v_enr.id
           and sd.study_date = (lp.completed_at at time zone public.safe_timezone(v_tz))::date
         where lp.enrollment_id = v_enr.id
           and l.course_id = p_course_id
           and l.week_number = p_circuit_number
           and lp.status = 'completed'
           and lp.completed_at is not null
           and sd.input_minutes > 0;

      when 'licao' then
        select count(*) into v_medido
          from public.lesson_progress lp
          join public.lessons l on l.id = lp.lesson_id
         where lp.enrollment_id = v_enr.id
           and l.course_id = p_course_id
           and l.week_number = p_circuit_number
           and lp.status = 'completed';

      when 'fila' then
        select count(distinct sd.study_date) into v_medido
          from public.lesson_progress lp
          join public.lessons l on l.id = lp.lesson_id
          join public.study_days sd
            on sd.enrollment_id = v_enr.id
           and sd.study_date = (lp.completed_at at time zone public.safe_timezone(v_tz))::date
         where lp.enrollment_id = v_enr.id
           and l.course_id = p_course_id
           and l.week_number = p_circuit_number
           and lp.status = 'completed'
           and lp.completed_at is not null
           and sd.queue_cleared;

      when 'novos', 'acumulado', 'defasado' then
        select count(*) into v_medido
          from public.chunk_mastery cm
         where cm.user_id = v_user
           and cm.course_id = p_course_id
           and cm.repetitions  >= coalesce((v_comp ->> 'repeticoes')::integer, 0)
           and cm.spoken_count >= coalesce((v_comp ->> 'faladas')::integer, 0)
           and (v_escopo <> 'nucleo' or cm.is_core)
           and case v_comp ->> 'tipo'
                 when 'novos'     then cm.circuit_number = p_circuit_number
                 when 'acumulado' then cm.circuit_number <= p_circuit_number
                 else cm.circuit_number = coalesce((v_comp ->> 'circuito')::integer, -1)
               end;

      -- A melhor nota do circuito, não a média: o portão pede evidência de que
      -- o aluno CONSEGUE, e uma gravação ruim no dia 2 não desfaz uma boa no
      -- dia 11.
      when 'nota' then
        select coalesce(max(f.overall_score), 0) into v_medido
          from public.speaking_feedback f
          join public.speaking_sessions s on s.id = f.session_id
          join public.lessons l on l.id = s.lesson_id
         where f.user_id = v_user
           and l.course_id = p_course_id
           and l.week_number = p_circuit_number;

      else
        -- Componente que esta versão do banco não sabe medir. Não reprova
        -- ninguém por ignorância própria: entra no JSON marcado e é isso.
        v_medido := 0;
        v_exigido := 0;
    end case;

    v_passou := v_medido >= v_exigido;
    if not v_passou then v_todos := false; end if;

    v_saida := v_saida || jsonb_build_object(
      'tipo',    v_comp ->> 'tipo',
      'exigido', v_exigido,
      'medido',  v_medido,
      'de',      (v_comp ->> 'de')::numeric,
      'passou',  v_passou
    );
  end loop;

  insert into public.circuit_gate_status (
    user_id, course_id, circuit_number, track, evaluated_at, passed, components
  )
  values (v_user, p_course_id, p_circuit_number, v_enr.track, now(), v_todos, v_saida)
  on conflict (user_id, circuit_number) do update
    set course_id    = excluded.course_id,
        track        = excluded.track,
        evaluated_at = excluded.evaluated_at,
        passed       = excluded.passed,
        components   = excluded.components
  returning * into v_status;

  return v_status;
end;
$$;

revoke all on function public.evaluate_circuit_gate(uuid, integer) from public, anon;
grant execute on function public.evaluate_circuit_gate(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
