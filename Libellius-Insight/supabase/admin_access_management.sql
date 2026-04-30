-- Admin user/access management for Libellius InsightHub.
-- Run in Supabase SQL Editor after typology_progress_autosave.sql.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

drop policy if exists admin_audit_log_select_admin on public.admin_audit_log;
create policy admin_audit_log_select_admin
  on public.admin_audit_log for select to authenticated
  using ((select public.is_global_admin()));

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  full_name text,
  company_name text,
  role public.app_role,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  module_codes text[],
  typology_status text,
  typology_completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select public.is_global_admin()) then
    raise exception 'admin_access_denied' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.email::text,
    p.full_name,
    p.company_name,
    p.role,
    p.organization_id,
    o.name as organization_name,
    o.slug as organization_slug,
    coalesce(module_summary.module_codes, array[]::text[]) as module_codes,
    typology_summary.status as typology_status,
    typology_summary.completed_at as typology_completed_at,
    p.created_at,
    p.updated_at
  from public.profiles p
  left join public.organizations o on o.id = p.organization_id
  left join lateral (
    select array_agg(ma.module_code order by ma.module_code) as module_codes
    from public.module_assignments ma
    where ma.user_id = p.id
      and ma.status = 'active'
  ) module_summary on true
  left join lateral (
    select
      ts.status::text,
      ts.completed_at
    from public.typology_sessions ts
    where ts.user_id = p.id
    order by ts.completed_at desc nulls last, ts.started_at desc
    limit 1
  ) typology_summary on true
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_update_user_access(
  p_user_id uuid,
  p_full_name text,
  p_company_name text,
  p_role public.app_role,
  p_organization_id uuid,
  p_module_codes text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_module_codes text[] := array[]::text[];
  v_invalid_module_count integer := 0;
begin
  if not (select public.is_global_admin()) then
    raise exception 'admin_access_denied' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'admin_target_user_required' using errcode = '22023';
  end if;

  if p_user_id = v_actor_id and p_role <> 'admin' then
    raise exception 'admin_cannot_demote_self' using errcode = '42501';
  end if;

  if p_organization_id is not null and not exists (
    select 1 from public.organizations o where o.id = p_organization_id
  ) then
    raise exception 'admin_invalid_organization' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'admin_target_user_not_found' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct module_code), array[]::text[])
    into v_module_codes
  from (
    select nullif(trim(module_code), '') as module_code
    from unnest(coalesce(p_module_codes, array[]::text[])) as module_code
  ) normalized
  where module_code is not null;

  select count(*)
    into v_invalid_module_count
  from unnest(v_module_codes) as selected_code(module_code)
  left join public.modules m
    on m.code = selected_code.module_code
   and m.is_active = true
  where m.code is null;

  if v_invalid_module_count > 0 then
    raise exception 'admin_invalid_module' using errcode = '22023';
  end if;

  update public.profiles
  set
    full_name = nullif(trim(coalesce(p_full_name, '')), ''),
    company_name = nullif(trim(coalesce(p_company_name, '')), ''),
    role = p_role,
    organization_id = p_organization_id,
    updated_at = now()
  where id = p_user_id;

  update public.module_assignments
  set status = 'disabled'
  where user_id = p_user_id
    and not (module_code = any(v_module_codes));

  insert into public.module_assignments (
    user_id,
    organization_id,
    module_code,
    status,
    assigned_by,
    assigned_at
  )
  select
    p_user_id,
    p_organization_id,
    selected_code.module_code,
    'active',
    v_actor_id,
    now()
  from unnest(v_module_codes) as selected_code(module_code)
  on conflict (user_id, module_code) do update
    set organization_id = excluded.organization_id,
        status = 'active',
        assigned_by = excluded.assigned_by,
        assigned_at = excluded.assigned_at;

  insert into public.admin_audit_log (
    actor_id,
    action,
    target_user_id,
    details
  )
  values (
    v_actor_id,
    'admin_update_user_access',
    p_user_id,
    jsonb_build_object(
      'role', p_role,
      'organization_id', p_organization_id,
      'module_codes', to_jsonb(v_module_codes)
    )
  );
end;
$$;

create or replace function public.admin_reset_typology_session(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_deleted_count integer := 0;
begin
  if not (select public.is_global_admin()) then
    raise exception 'admin_access_denied' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'admin_target_user_required' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'admin_target_user_not_found' using errcode = '22023';
  end if;

  delete from public.typology_sessions ts
  where ts.user_id = p_user_id;

  get diagnostics v_deleted_count = row_count;

  insert into public.admin_audit_log (
    actor_id,
    action,
    target_user_id,
    details
  )
  values (
    v_actor_id,
    'admin_reset_typology_session',
    p_user_id,
    jsonb_build_object('deleted_sessions', v_deleted_count)
  );
end;
$$;

grant select on public.admin_audit_log to authenticated;

revoke all on function public.admin_list_users() from public;
revoke all on function public.admin_list_users() from anon;
grant execute on function public.admin_list_users() to authenticated;

revoke all on function public.admin_update_user_access(uuid, text, text, public.app_role, uuid, text[]) from public;
revoke all on function public.admin_update_user_access(uuid, text, text, public.app_role, uuid, text[]) from anon;
grant execute on function public.admin_update_user_access(uuid, text, text, public.app_role, uuid, text[]) to authenticated;

revoke all on function public.admin_reset_typology_session(uuid) from public;
revoke all on function public.admin_reset_typology_session(uuid) from anon;
grant execute on function public.admin_reset_typology_session(uuid) to authenticated;
