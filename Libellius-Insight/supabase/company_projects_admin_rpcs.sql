-- Admin RPCs for company project participant assignment.
-- Run after company_projects_admin.sql.

create or replace function public.admin_assign_project_participant(
  p_project_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if not (select public.is_global_admin()) then
    raise exception 'admin_access_denied' using errcode = '42501';
  end if;

  if p_project_id is null or p_user_id is null then
    raise exception 'admin_project_participant_required' using errcode = '22023';
  end if;

  if not exists (select 1 from public.company_projects cp where cp.id = p_project_id) then
    raise exception 'admin_project_not_found' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'admin_target_user_not_found' using errcode = '22023';
  end if;

  insert into public.company_project_participants (
    project_id,
    user_id,
    added_by,
    added_at
  )
  values (
    p_project_id,
    p_user_id,
    v_actor_id,
    now()
  )
  on conflict (project_id, user_id) do update
    set added_by = excluded.added_by,
        added_at = excluded.added_at;

  insert into public.admin_audit_log (
    actor_id,
    action,
    target_user_id,
    details
  )
  values (
    v_actor_id,
    'admin_assign_project_participant',
    p_user_id,
    jsonb_build_object('project_id', p_project_id)
  );
end;
$$;

create or replace function public.admin_remove_project_participant(
  p_project_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if not (select public.is_global_admin()) then
    raise exception 'admin_access_denied' using errcode = '42501';
  end if;

  if p_project_id is null or p_user_id is null then
    raise exception 'admin_project_participant_required' using errcode = '22023';
  end if;

  delete from public.company_project_participants cpp
  where cpp.project_id = p_project_id
    and cpp.user_id = p_user_id;

  insert into public.admin_audit_log (
    actor_id,
    action,
    target_user_id,
    details
  )
  values (
    v_actor_id,
    'admin_remove_project_participant',
    p_user_id,
    jsonb_build_object('project_id', p_project_id)
  );
end;
$$;

grant execute on function public.admin_assign_project_participant(uuid, uuid) to authenticated;
grant execute on function public.admin_remove_project_participant(uuid, uuid) to authenticated;
