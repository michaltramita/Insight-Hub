-- Security hardening for typology submissions.
-- Run in Supabase SQL Editor after the base schema exists.

create or replace function public.submit_typology_test(
  p_test_id uuid,
  p_answers jsonb
)
returns table (
  session_id uuid,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_test_organization_id uuid;
  v_question_count integer;
  v_answer_count integer;
  v_invalid_group_count integer;
  v_session_id uuid;
  v_scores jsonb;
  v_dominant_style text;
  v_completed_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception 'invalid_answers_payload' using errcode = '22023';
  end if;

  select tt.organization_id
    into v_test_organization_id
  from public.typology_tests tt
  where tt.id = p_test_id
    and tt.status = 'active';

  if not found then
    raise exception 'typology_test_not_available' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.typology_sessions ts
    where ts.test_id = p_test_id
      and ts.user_id = v_user_id
      and ts.status = 'completed'
  ) then
    raise exception 'typology_test_already_completed' using errcode = '23505';
  end if;

  if not (
    (select public.is_global_admin())
    or (
      (select public.current_profile_role()) = 'consultant'
      and exists (
        select 1
        from public.profiles p
        where p.id = v_user_id
          and p.organization_id = v_test_organization_id
      )
    )
    or exists (
      select 1
      from public.module_assignments ma
      where ma.user_id = v_user_id
        and ma.module_code = 'TYPOLOGY_LEADERSHIP'
        and ma.status = 'active'
        and (ma.starts_at is null or ma.starts_at <= now())
        and (ma.ends_at is null or ma.ends_at >= now())
        and (
          ma.organization_id is null
          or ma.organization_id = v_test_organization_id
        )
    )
  ) then
    raise exception 'typology_access_denied' using errcode = '42501';
  end if;

  select count(*)
    into v_question_count
  from public.typology_questions tq
  where tq.test_id = p_test_id;

  if v_question_count <= 0 then
    raise exception 'typology_test_has_no_questions' using errcode = '22023';
  end if;

  with answer_entries as (
    select entry.key, entry.value
    from jsonb_each(p_answers) as entry(key, value)
  ),
  valid_answers as (
    select
      answer_entries.key::uuid as question_id,
      (answer_entries.value #>> '{}')::integer as score
    from answer_entries
    where answer_entries.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and jsonb_typeof(answer_entries.value) = 'number'
      and (answer_entries.value #>> '{}') ~ '^[1-4]$'
  )
  select count(*)
    into v_answer_count
  from valid_answers va
  join public.typology_questions tq on tq.id = va.question_id
  where tq.test_id = p_test_id;

  if v_answer_count <> v_question_count
    or (
      select count(*)::integer from jsonb_object_keys(p_answers)
    ) <> v_question_count
  then
    raise exception 'invalid_answers_count' using errcode = '22023';
  end if;

  with answer_entries as (
    select
      entry.key::uuid as question_id,
      (entry.value #>> '{}')::integer as score
    from jsonb_each(p_answers) as entry(key, value)
  ),
  grouped_answers as (
    select
      tq.question_no,
      count(*) as answer_count,
      sum(answer_entries.score) as score_sum,
      count(distinct answer_entries.score) as distinct_score_count
    from answer_entries
    join public.typology_questions tq on tq.id = answer_entries.question_id
    where tq.test_id = p_test_id
    group by tq.question_no
  )
  select count(*)
    into v_invalid_group_count
  from grouped_answers
  where grouped_answers.answer_count <> 4
    or grouped_answers.score_sum <> 10
    or grouped_answers.distinct_score_count <> 4;

  if v_invalid_group_count > 0 then
    raise exception 'invalid_answers_distribution' using errcode = '22023';
  end if;

  insert into public.typology_sessions (test_id, user_id, status, completed_at)
  values (p_test_id, v_user_id, 'in_progress', null)
  on conflict on constraint typology_sessions_test_id_user_id_key do update
    set status = 'in_progress',
        completed_at = null
  returning public.typology_sessions.id into v_session_id;

  insert into public.typology_answers (session_id, question_id, score)
  select
    v_session_id,
    answer_entries.key::uuid,
    (answer_entries.value #>> '{}')::integer
  from jsonb_each(p_answers) as answer_entries(key, value)
  join public.typology_questions tq on tq.id = answer_entries.key::uuid
  where tq.test_id = p_test_id
  on conflict on constraint typology_answers_session_id_question_id_key do update
    set score = excluded.score,
        updated_at = now();

  select jsonb_build_object(
      'a', coalesce(sum(ta.score) filter (where tq.style_code = 'a'), 0),
      'b', coalesce(sum(ta.score) filter (where tq.style_code = 'b'), 0),
      'c', coalesce(sum(ta.score) filter (where tq.style_code = 'c'), 0),
      'd', coalesce(sum(ta.score) filter (where tq.style_code = 'd'), 0)
    )
    into v_scores
  from public.typology_answers ta
  join public.typology_questions tq on tq.id = ta.question_id
  where ta.session_id = v_session_id
    and tq.test_id = p_test_id;

  select style_entry.key
    into v_dominant_style
  from jsonb_each_text(v_scores) as style_entry(key, value)
  order by style_entry.value::integer desc, style_entry.key asc
  limit 1;

  insert into public.typology_results (
    session_id,
    scores,
    dominant_style,
    calculated_at
  )
  values (v_session_id, v_scores, v_dominant_style, v_completed_at)
  on conflict on constraint typology_results_pkey do update
    set scores = excluded.scores,
        dominant_style = excluded.dominant_style,
        calculated_at = excluded.calculated_at;

  update public.typology_sessions
  set status = 'completed',
      completed_at = v_completed_at
  where public.typology_sessions.id = v_session_id;

  return query select v_session_id, v_completed_at;
end;
$$;

drop policy if exists typology_results_write_own on public.typology_results;
drop policy if exists typology_results_insert_own on public.typology_results;
drop policy if exists typology_results_update_own on public.typology_results;

revoke update on public.profiles from authenticated;
grant update (full_name, company_name) on public.profiles to authenticated;

grant select on public.typology_sessions to authenticated;
grant select on public.typology_answers to authenticated;
grant select on public.typology_results to authenticated;

revoke insert, update on public.typology_sessions from authenticated;
revoke insert, update on public.typology_answers from authenticated;
revoke insert, update on public.typology_results from authenticated;

revoke all on function public.submit_typology_test(uuid, jsonb) from public;
revoke all on function public.submit_typology_test(uuid, jsonb) from anon;
grant execute on function public.submit_typology_test(uuid, jsonb) to authenticated;
