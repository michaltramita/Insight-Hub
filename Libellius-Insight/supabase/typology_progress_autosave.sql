-- Autosave support for in-progress typology tests.
-- Run in Supabase SQL Editor after security_hardening_typology_submit.sql.

create or replace function public.save_typology_progress(
  p_test_id uuid,
  p_answers jsonb
)
returns table (
  session_id uuid,
  saved_at timestamptz,
  answer_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_test_organization_id uuid;
  v_answer_count integer := 0;
  v_invalid_group_count integer := 0;
  v_session_id uuid;
  v_saved_at timestamptz := now();
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

  if v_answer_count <> (
    select count(*)::integer from jsonb_object_keys(p_answers)
  ) then
    raise exception 'invalid_progress_answers' using errcode = '22023';
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
      count(distinct answer_entries.score) as distinct_score_count
    from answer_entries
    join public.typology_questions tq on tq.id = answer_entries.question_id
    where tq.test_id = p_test_id
    group by tq.question_no
  )
  select count(*)
    into v_invalid_group_count
  from grouped_answers
  where grouped_answers.answer_count <> grouped_answers.distinct_score_count;

  if v_invalid_group_count > 0 then
    raise exception 'invalid_progress_answers' using errcode = '22023';
  end if;

  insert into public.typology_sessions (
    test_id,
    user_id,
    status,
    completed_at
  )
  values (
    p_test_id,
    v_user_id,
    'in_progress',
    null
  )
  on conflict on constraint typology_sessions_test_id_user_id_key do update
    set status = 'in_progress',
        completed_at = null
    where public.typology_sessions.status <> 'completed'
  returning public.typology_sessions.id into v_session_id;

  if v_session_id is null then
    raise exception 'typology_test_already_completed' using errcode = '23505';
  end if;

  delete from public.typology_answers ta
  using public.typology_questions tq
  where ta.question_id = tq.id
    and ta.session_id = v_session_id
    and tq.test_id = p_test_id
    and not exists (
      select 1
      from jsonb_each(p_answers) as answer_entries(key, value)
      where answer_entries.key::uuid = ta.question_id
    );

  insert into public.typology_answers (
    session_id,
    question_id,
    score
  )
  select
    v_session_id,
    answer_entries.key::uuid,
    (answer_entries.value #>> '{}')::integer
  from jsonb_each(p_answers) as answer_entries(key, value)
  join public.typology_questions tq on tq.id = answer_entries.key::uuid
  where tq.test_id = p_test_id
  on conflict on constraint typology_answers_session_id_question_id_key do update
    set score = excluded.score,
        updated_at = v_saved_at;

  return query select v_session_id, v_saved_at, v_answer_count;
end;
$$;

revoke all on function public.save_typology_progress(uuid, jsonb) from public;
revoke all on function public.save_typology_progress(uuid, jsonb) from anon;
grant execute on function public.save_typology_progress(uuid, jsonb) to authenticated;
