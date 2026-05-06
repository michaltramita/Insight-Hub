-- Add per-analysis participant result availability.
-- Run after the base schema exists.

alter table public.typology_tests
  add column if not exists participant_results_available_at timestamptz null;

drop policy if exists typology_results_select_own_or_org_admin on public.typology_results;
drop policy if exists typology_results_select_org_admin on public.typology_results;
drop policy if exists typology_results_select_released_own on public.typology_results;

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

create policy typology_results_select_released_own
  on public.typology_results for select to authenticated
  using (
    exists (
      select 1
      from public.typology_sessions ts
      join public.typology_tests tt on tt.id = ts.test_id
      where ts.id = typology_results.session_id
        and ts.user_id = (select auth.uid())
        and tt.participant_results_available_at is not null
        and tt.participant_results_available_at <= now()
    )
  );

-- Backfill existing analyses so current participant-visible results stay released.
-- Set individual rows back to null later if an analysis should remain hidden.
update public.typology_tests
set participant_results_available_at = now()
where participant_results_available_at is null;
