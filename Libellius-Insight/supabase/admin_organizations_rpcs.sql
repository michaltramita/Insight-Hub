-- Admin RPCs for organization create/delete.
-- Run after admin_access_management.sql.

create or replace function public.admin_create_organization(p_name text)
returns table (
  id uuid,
  name text,
  slug text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_name text := nullif(btrim(p_name), '');
  v_base_slug text;
  v_final_slug text;
  v_suffix int := 1;
  v_inserted public.organizations%rowtype;
begin
  if not (select public.is_global_admin()) then
    raise exception 'admin_access_denied' using errcode = '42501';
  end if;

  if v_name is null then
    raise exception 'admin_organization_name_required' using errcode = '22023';
  end if;

  v_base_slug := regexp_replace(
    regexp_replace(
      translate(
        lower(v_name),
        'áäčďéěíľĺňóôöŕřšťúůüýžàâãåæçèêëìîïñòõøùûÿ',
        'aacdeeillnoooorrstuuuyzaaaaaceeeiiinoooury'
      ),
      '[^a-z0-9]+', '-', 'g'
    ),
    '(^-+)|(-+$)', '', 'g'
  );
  v_base_slug := left(coalesce(nullif(v_base_slug, ''), 'org'), 64);
  v_final_slug := v_base_slug;

  while exists (
    select 1 from public.organizations o where o.slug = v_final_slug
  ) loop
    v_suffix := v_suffix + 1;
    v_final_slug := left(v_base_slug, 60) || '-' || v_suffix;
  end loop;

  insert into public.organizations (name, slug)
  values (v_name, v_final_slug)
  returning * into v_inserted;

  insert into public.admin_audit_log (
    actor_id,
    action,
    target_user_id,
    details
  )
  values (
    v_actor_id,
    'admin_create_organization',
    null,
    jsonb_build_object(
      'organization_id', v_inserted.id,
      'organization_name', v_inserted.name,
      'organization_slug', v_inserted.slug
    )
  );

  return query
  select v_inserted.id, v_inserted.name, v_inserted.slug;
end;
$$;

create or replace function public.admin_delete_organization(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_organization public.organizations%rowtype;
  v_linked_profiles int;
  v_linked_projects int;
  v_linked_tests int;
begin
  if not (select public.is_global_admin()) then
    raise exception 'admin_access_denied' using errcode = '42501';
  end if;

  if p_organization_id is null then
    raise exception 'admin_organization_id_required' using errcode = '22023';
  end if;

  select * into v_organization
  from public.organizations
  where id = p_organization_id;

  if not found then
    raise exception 'admin_organization_not_found' using errcode = '22023';
  end if;

  select count(*) into v_linked_profiles
  from public.profiles where organization_id = p_organization_id;

  select count(*) into v_linked_projects
  from public.company_projects where organization_id = p_organization_id;

  select count(*) into v_linked_tests
  from public.typology_tests where organization_id = p_organization_id;

  if v_linked_profiles > 0 or v_linked_projects > 0 or v_linked_tests > 0 then
    raise exception 'admin_organization_has_dependencies:%:%:%',
      v_linked_profiles, v_linked_projects, v_linked_tests
      using errcode = '23503';
  end if;

  delete from public.organizations where id = p_organization_id;

  insert into public.admin_audit_log (
    actor_id,
    action,
    target_user_id,
    details
  )
  values (
    v_actor_id,
    'admin_delete_organization',
    null,
    jsonb_build_object(
      'organization_id', v_organization.id,
      'organization_name', v_organization.name,
      'organization_slug', v_organization.slug
    )
  );
end;
$$;

revoke all on function public.admin_create_organization(text) from public;
revoke all on function public.admin_create_organization(text) from anon;
grant execute on function public.admin_create_organization(text) to authenticated;

revoke all on function public.admin_delete_organization(uuid) from public;
revoke all on function public.admin_delete_organization(uuid) from anon;
grant execute on function public.admin_delete_organization(uuid) to authenticated;
