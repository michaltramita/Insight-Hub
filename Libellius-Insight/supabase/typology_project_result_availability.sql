-- Switch participant result release from global typology_test level to project level.
-- Run after company_projects_admin.sql.

drop policy if exists typology_results_select_released_own on public.typology_results;

create policy typology_results_select_released_own
  on public.typology_results for select to authenticated
  using (
    exists (
      select 1
      from public.typology_sessions ts
      where ts.id = typology_results.session_id
        and ts.user_id = (select auth.uid())
        and exists (
          select 1
          from public.company_project_participants cpp
          join public.company_projects cp on cp.id = cpp.project_id
          where cpp.user_id = ts.user_id
            and coalesce(cp.module_codes, array[]::text[]) @> array['TYPOLOGY_LEADERSHIP']::text[]
        )
        and not exists (
          select 1
          from public.company_project_participants cpp
          join public.company_projects cp on cp.id = cpp.project_id
          where cpp.user_id = ts.user_id
            and coalesce(cp.module_codes, array[]::text[]) @> array['TYPOLOGY_LEADERSHIP']::text[]
            and (
              cp.result_access_date is null
              or cp.result_access_date > now()
            )
        )
    )
  );
