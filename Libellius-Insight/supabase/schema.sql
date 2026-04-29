-- Libellius InsightHub access-control and typology-test foundation.
-- Run this in Supabase SQL Editor after creating the project.

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('participant', 'manager', 'consultant', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'assignment_status') then
    create type public.assignment_status as enum ('active', 'completed', 'disabled');
  end if;

  if not exists (select 1 from pg_type where typname = 'test_status') then
    create type public.test_status as enum ('draft', 'active', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'session_status') then
    create type public.session_status as enum ('in_progress', 'completed');
  end if;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  email citext not null,
  full_name text,
  company_name text,
  role public.app_role not null default 'participant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email)
);

create table if not exists public.modules (
  code text primary key,
  title text not null,
  description text not null,
  sort_order integer not null default 100,
  is_active boolean not null default true
);

create table if not exists public.module_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  module_code text not null references public.modules(code) on delete cascade,
  status public.assignment_status not null default 'active',
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, module_code)
);

create table if not exists public.typology_tests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  title text not null default 'Test typológie pri vedení ľudí',
  description text,
  status public.test_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.typology_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.typology_tests(id) on delete cascade,
  question_no integer not null,
  option_key text not null check (option_key in ('a', 'b', 'c', 'd')),
  style_code text not null check (style_code in ('a', 'b', 'c', 'd')),
  statement text not null,
  sort_order integer not null default 0,
  points_min integer not null default 1,
  points_max integer not null default 4,
  unique (test_id, question_no, option_key)
);

create table if not exists public.typology_sessions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.typology_tests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.session_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (test_id, user_id)
);

create table if not exists public.typology_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.typology_sessions(id) on delete cascade,
  question_id uuid not null references public.typology_questions(id) on delete cascade,
  score integer not null check (score between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, question_id)
);

create table if not exists public.typology_results (
  session_id uuid primary key references public.typology_sessions(id) on delete cascade,
  scores jsonb not null default '{}'::jsonb,
  dominant_style text,
  calculated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists typology_tests_touch_updated_at on public.typology_tests;
create trigger typology_tests_touch_updated_at
  before update on public.typology_tests
  for each row execute function public.touch_updated_at();

drop trigger if exists typology_answers_touch_updated_at on public.typology_answers;
create trigger typology_answers_touch_updated_at
  before update on public.typology_answers
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.current_profile_role()
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select role
  from public.profiles
  where id = (select auth.uid())
$$;

create or replace function public.current_profile_organization_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id
  from public.profiles
  where id = (select auth.uid())
$$;

create or replace function public.is_admin_or_consultant()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_profile_role() in ('admin', 'consultant'), false)
$$;

create or replace function public.is_global_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_profile_role() = 'admin', false)
$$;

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
    select
      entry.key,
      entry.value
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
    or jsonb_object_length(p_answers) <> v_question_count
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
  where answer_count <> 4
    or score_sum <> 10
    or distinct_score_count <> 4;

  if v_invalid_group_count > 0 then
    raise exception 'invalid_answers_distribution' using errcode = '22023';
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
  on conflict (test_id, user_id) do update
    set status = 'in_progress',
        completed_at = null
  returning id into v_session_id;

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
  on conflict (session_id, question_id) do update
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
  values (
    v_session_id,
    v_scores,
    v_dominant_style,
    v_completed_at
  )
  on conflict (session_id) do update
    set scores = excluded.scores,
        dominant_style = excluded.dominant_style,
        calculated_at = excluded.calculated_at;

  update public.typology_sessions
  set status = 'completed',
      completed_at = v_completed_at
  where id = v_session_id;

  return query select v_session_id, v_completed_at;
end;
$$;

insert into public.modules (code, title, description, sort_order, is_active)
values
  (
    '360_FEEDBACK',
    'Analýza 360° spätnej väzby',
    'Vidieť rozdiely. Pochopiť súvislosti. Rozvíjať potenciál.',
    10,
    true
  ),
  (
    'ZAMESTNANECKA_SPOKOJNOST',
    'Analýza spokojnosti zamestnancov',
    'Vidieť nálady. Pochopiť súvislosti. Zlepšovať prostredie.',
    20,
    true
  ),
  (
    'TYPOLOGY_LEADERSHIP',
    'Test typológie pri vedení ľudí',
    'Spoznajte, ako sa rozhodujete, komunikujete a reagujete v spolupráci, pod tlakom aj pri zmene.',
    30,
    true
  )
on conflict (code) do update
  set title = excluded.title,
      description = excluded.description,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active;

create index if not exists profiles_organization_id_idx
  on public.profiles (organization_id);

create index if not exists module_assignments_user_id_idx
  on public.module_assignments (user_id);

create index if not exists module_assignments_organization_id_idx
  on public.module_assignments (organization_id);

create index if not exists module_assignments_active_user_idx
  on public.module_assignments (user_id, module_code)
  where status = 'active';

create index if not exists typology_tests_organization_id_idx
  on public.typology_tests (organization_id);

create index if not exists typology_questions_test_id_idx
  on public.typology_questions (test_id);

create index if not exists typology_sessions_test_id_idx
  on public.typology_sessions (test_id);

create index if not exists typology_sessions_user_id_idx
  on public.typology_sessions (user_id);

create index if not exists typology_answers_session_id_idx
  on public.typology_answers (session_id);

create index if not exists typology_answers_question_id_idx
  on public.typology_answers (question_id);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.modules enable row level security;
alter table public.module_assignments enable row level security;
alter table public.typology_tests enable row level security;
alter table public.typology_questions enable row level security;
alter table public.typology_sessions enable row level security;
alter table public.typology_answers enable row level security;
alter table public.typology_results enable row level security;

drop policy if exists organizations_select_own on public.organizations;
create policy organizations_select_own
  on public.organizations for select to authenticated
  using (
    id = (select public.current_profile_organization_id())
    or (select public.is_global_admin())
  );

drop policy if exists profiles_select_self_or_org_admin on public.profiles;
create policy profiles_select_self_or_org_admin
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_global_admin())
    or (
      (select public.current_profile_role()) = 'consultant'
      and organization_id = (select public.current_profile_organization_id())
    )
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists modules_select_active on public.modules;
create policy modules_select_active
  on public.modules for select to authenticated
  using (is_active = true);

drop policy if exists module_assignments_select_own_or_org_admin on public.module_assignments;
create policy module_assignments_select_own_or_org_admin
  on public.module_assignments for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_global_admin())
    or (
      (select public.current_profile_role()) = 'consultant'
      and organization_id = (select public.current_profile_organization_id())
    )
  );

drop policy if exists module_assignments_write_org_admin on public.module_assignments;
create policy module_assignments_write_org_admin
  on public.module_assignments for all to authenticated
  using (
    (select public.is_global_admin())
    or (
      (select public.current_profile_role()) = 'consultant'
      and organization_id = (select public.current_profile_organization_id())
    )
  )
  with check (
    (select public.is_global_admin())
    or (
      (select public.current_profile_role()) = 'consultant'
      and organization_id = (select public.current_profile_organization_id())
    )
  );

drop policy if exists typology_tests_select_assigned_or_org_admin on public.typology_tests;
create policy typology_tests_select_assigned_or_org_admin
  on public.typology_tests for select to authenticated
  using (
    exists (
      select 1
      from public.module_assignments ma
      where ma.user_id = (select auth.uid())
        and ma.module_code = 'TYPOLOGY_LEADERSHIP'
        and ma.status = 'active'
        and (ma.starts_at is null or ma.starts_at <= now())
        and (ma.ends_at is null or ma.ends_at >= now())
        and (ma.organization_id is null or ma.organization_id = typology_tests.organization_id)
    )
    or (select public.is_global_admin())
    or (
      (select public.current_profile_role()) = 'consultant'
      and organization_id = (select public.current_profile_organization_id())
    )
  );

drop policy if exists typology_tests_write_org_admin on public.typology_tests;
create policy typology_tests_write_org_admin
  on public.typology_tests for all to authenticated
  using (
    (select public.is_global_admin())
    or (
      (select public.current_profile_role()) = 'consultant'
      and organization_id = (select public.current_profile_organization_id())
    )
  )
  with check (
    (select public.is_global_admin())
    or (
      (select public.current_profile_role()) = 'consultant'
      and organization_id = (select public.current_profile_organization_id())
    )
  );

drop policy if exists typology_questions_select_assigned_or_org_admin on public.typology_questions;
create policy typology_questions_select_assigned_or_org_admin
  on public.typology_questions for select to authenticated
  using (
    exists (
      select 1
      from public.typology_tests tt
      where tt.id = typology_questions.test_id
        and (
          (select public.is_global_admin())
          or
          exists (
            select 1
            from public.module_assignments ma
            where ma.user_id = (select auth.uid())
              and ma.module_code = 'TYPOLOGY_LEADERSHIP'
              and ma.status = 'active'
              and (ma.starts_at is null or ma.starts_at <= now())
              and (ma.ends_at is null or ma.ends_at >= now())
              and (ma.organization_id is null or ma.organization_id = tt.organization_id)
          )
          or (
            (select public.current_profile_role()) = 'consultant'
            and tt.organization_id = (select public.current_profile_organization_id())
          )
        )
    )
  );

drop policy if exists typology_questions_write_org_admin on public.typology_questions;
create policy typology_questions_write_org_admin
  on public.typology_questions for all to authenticated
  using (
    exists (
      select 1
      from public.typology_tests tt
      where tt.id = typology_questions.test_id
        and (
          (select public.is_global_admin())
          or (
            (select public.current_profile_role()) = 'consultant'
            and tt.organization_id = (select public.current_profile_organization_id())
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.typology_tests tt
      where tt.id = typology_questions.test_id
        and (
          (select public.is_global_admin())
          or (
            (select public.current_profile_role()) = 'consultant'
            and tt.organization_id = (select public.current_profile_organization_id())
          )
        )
    )
  );

drop policy if exists typology_sessions_select_own_or_org_admin on public.typology_sessions;
create policy typology_sessions_select_own_or_org_admin
  on public.typology_sessions for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_global_admin())
    or (
      (select public.current_profile_role()) = 'consultant'
      and exists (
        select 1
        from public.profiles p
        where p.id = typology_sessions.user_id
          and p.organization_id = (select public.current_profile_organization_id())
      )
    )
  );

drop policy if exists typology_sessions_insert_own on public.typology_sessions;
create policy typology_sessions_insert_own
  on public.typology_sessions for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists typology_sessions_update_own_in_progress on public.typology_sessions;
create policy typology_sessions_update_own_in_progress
  on public.typology_sessions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists typology_answers_select_own_or_org_admin on public.typology_answers;
create policy typology_answers_select_own_or_org_admin
  on public.typology_answers for select to authenticated
  using (
    exists (
      select 1
      from public.typology_sessions ts
      left join public.profiles p on p.id = ts.user_id
      where ts.id = typology_answers.session_id
        and (
          ts.user_id = (select auth.uid())
          or (select public.is_global_admin())
          or (
            (select public.current_profile_role()) = 'consultant'
            and p.organization_id = (select public.current_profile_organization_id())
          )
        )
    )
  );

drop policy if exists typology_answers_insert_own on public.typology_answers;
create policy typology_answers_insert_own
  on public.typology_answers for insert to authenticated
  with check (
    exists (
      select 1
      from public.typology_sessions ts
      where ts.id = typology_answers.session_id
        and ts.user_id = (select auth.uid())
        and ts.status = 'in_progress'
    )
  );

drop policy if exists typology_answers_update_own on public.typology_answers;
create policy typology_answers_update_own
  on public.typology_answers for update to authenticated
  using (
    exists (
      select 1
      from public.typology_sessions ts
      where ts.id = typology_answers.session_id
        and ts.user_id = (select auth.uid())
        and ts.status = 'in_progress'
    )
  )
  with check (
    exists (
      select 1
      from public.typology_sessions ts
      where ts.id = typology_answers.session_id
        and ts.user_id = (select auth.uid())
        and ts.status = 'in_progress'
    )
  );

drop policy if exists typology_results_select_own_or_org_admin on public.typology_results;
drop policy if exists typology_results_select_org_admin on public.typology_results;
create policy typology_results_select_org_admin
  on public.typology_results for select to authenticated
  using (
    (select public.is_global_admin())
    or (
      (select public.current_profile_role()) = 'consultant'
      and exists (
        select 1
        from public.typology_sessions ts
        left join public.profiles p on p.id = ts.user_id
        where ts.id = typology_results.session_id
          and p.organization_id = (select public.current_profile_organization_id())
      )
    )
  );

drop policy if exists typology_results_write_own on public.typology_results;
drop policy if exists typology_results_insert_own on public.typology_results;
create policy typology_results_insert_own
  on public.typology_results for insert to authenticated
  with check (
    exists (
      select 1
      from public.typology_sessions ts
      where ts.id = typology_results.session_id
        and ts.user_id = (select auth.uid())
    )
  );

drop policy if exists typology_results_update_own on public.typology_results;
create policy typology_results_update_own
  on public.typology_results for update to authenticated
  using (
    exists (
      select 1
      from public.typology_sessions ts
      where ts.id = typology_results.session_id
        and ts.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.typology_sessions ts
      where ts.id = typology_results.session_id
        and ts.user_id = (select auth.uid())
    )
  );

drop policy if exists typology_results_write_own on public.typology_results;

grant usage on schema public to authenticated;
grant select on public.modules to authenticated;
grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, company_name) on public.profiles to authenticated;
grant select on public.organizations to authenticated;
grant select, insert, update on public.module_assignments to authenticated;
grant select, insert, update on public.typology_tests to authenticated;
grant select, insert, update on public.typology_questions to authenticated;
grant select on public.typology_sessions to authenticated;
grant select on public.typology_answers to authenticated;
grant select on public.typology_results to authenticated;

revoke insert, update on public.typology_sessions from authenticated;
revoke insert, update on public.typology_answers from authenticated;
revoke insert, update on public.typology_results from authenticated;

revoke all on function public.submit_typology_test(uuid, jsonb) from public;
revoke all on function public.submit_typology_test(uuid, jsonb) from anon;
grant execute on function public.submit_typology_test(uuid, jsonb) to authenticated;
