-- Security hardening for module assignment organization scope.
-- Run after confirming this returns 0 rows:
--   select * from public.module_assignments where organization_id is null;

do $$
begin
  if exists (
    select 1
    from public.module_assignments
    where organization_id is null
  ) then
    raise exception 'module_assignments_with_null_organization_exist'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.typology_tests
    where status = 'active'
      and organization_id is null
  ) then
    raise exception 'active_typology_tests_with_null_organization_exist'
      using errcode = '23514';
  end if;
end $$;

alter table public.module_assignments
  alter column organization_id set not null;

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
        and ma.organization_id = typology_tests.organization_id
    )
    or (select public.is_global_admin())
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
              and ma.organization_id = tt.organization_id
          )
          or (
            (select public.current_profile_role()) = 'consultant'
            and tt.organization_id = (select public.current_profile_organization_id())
          )
        )
    )
  );
