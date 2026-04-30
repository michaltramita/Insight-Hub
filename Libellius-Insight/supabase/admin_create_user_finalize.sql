-- Admin account creation finalizer.
-- Run this in Supabase SQL Editor if the app reports:
-- "permission denied for table profiles" while creating a user in the admin UI.

create or replace function public.admin_finalize_created_user(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_company_name text,
  p_organization_id uuid,
  p_module_codes text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_organization_id uuid := p_organization_id;
  v_module_codes text[] := array[]::text[];
  v_invalid_module_count integer := 0;
begin
  if v_actor_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not (select public.is_global_admin()) then
    raise exception 'admin_access_denied' using errcode = '42501';
  end if;

  if p_user_id is null or nullif(trim(coalesce(p_email, '')), '') is null then
    raise exception 'admin_created_user_required' using errcode = '22023';
  end if;

  if v_organization_id is null then
    select o.id
      into v_organization_id
    from public.organizations o
    where o.slug = 'libellius'
    limit 1;
  elsif not exists (
    select 1 from public.organizations o where o.id = v_organization_id
  ) then
    raise exception 'admin_invalid_organization' using errcode = '22023';
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

  insert into public.profiles (
    id,
    email,
    full_name,
    company_name,
    role,
    organization_id
  )
  values (
    p_user_id,
    lower(trim(p_email)),
    nullif(trim(coalesce(p_full_name, '')), ''),
    nullif(trim(coalesce(p_company_name, '')), ''),
    'participant',
    v_organization_id
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        company_name = excluded.company_name,
        role = 'participant',
        organization_id = excluded.organization_id,
        updated_at = now();

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
    v_organization_id,
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
    'admin_create_user',
    p_user_id,
    jsonb_build_object(
      'email', lower(trim(p_email)),
      'organization_id', v_organization_id,
      'module_codes', to_jsonb(v_module_codes)
    )
  );

  return v_organization_id;
end;
$$;

revoke all on function public.admin_finalize_created_user(uuid, text, text, text, uuid, text[]) from public;
revoke all on function public.admin_finalize_created_user(uuid, text, text, text, uuid, text[]) from anon;
grant execute on function public.admin_finalize_created_user(uuid, text, text, text, uuid, text[]) to authenticated;
