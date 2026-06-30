-- Persisted 360 feedback reports and participant access.
-- Run after schema.sql and company_projects_admin.sql.

create table if not exists public.feedback360_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  project_id uuid references public.company_projects(id) on delete set null,
  title text not null,
  company_name text not null,
  survey_name text,
  report_date date,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  payload jsonb not null,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedback360_reports_title_not_blank check (length(trim(title)) > 0),
  constraint feedback360_reports_company_not_blank check (length(trim(company_name)) > 0)
);

create table if not exists public.feedback360_report_access (
  report_id uuid not null references public.feedback360_reports(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

create index if not exists feedback360_reports_organization_id_idx
  on public.feedback360_reports (organization_id);

create index if not exists feedback360_reports_project_id_idx
  on public.feedback360_reports (project_id);

create index if not exists feedback360_reports_created_by_idx
  on public.feedback360_reports (created_by);

create index if not exists feedback360_reports_published_idx
  on public.feedback360_reports (status, published_at)
  where status = 'published';

create index if not exists feedback360_report_access_user_id_idx
  on public.feedback360_report_access (user_id);

drop trigger if exists feedback360_reports_touch_updated_at on public.feedback360_reports;
create trigger feedback360_reports_touch_updated_at
  before update on public.feedback360_reports
  for each row execute function public.touch_updated_at();

create or replace function public.has_active_360_feedback_assignment(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.module_assignments ma
    where ma.user_id = (select auth.uid())
      and ma.module_code = '360_FEEDBACK'
      and ma.status = 'active'
      and (ma.starts_at is null or ma.starts_at <= now())
      and (ma.ends_at is null or ma.ends_at >= now())
      and (p_organization_id is null or ma.organization_id = p_organization_id)
  );
$$;

alter table public.feedback360_reports enable row level security;
alter table public.feedback360_report_access enable row level security;

drop policy if exists feedback360_reports_select_admin_or_assigned on public.feedback360_reports;
create policy feedback360_reports_select_admin_or_assigned
  on public.feedback360_reports for select to authenticated
  using (
    (select public.is_global_admin())
    or (
      status = 'published'
      and (select public.has_active_360_feedback_assignment(feedback360_reports.organization_id))
      and (
        exists (
          select 1
          from public.feedback360_report_access fra
          where fra.report_id = feedback360_reports.id
            and fra.user_id = (select auth.uid())
        )
        or (
          feedback360_reports.project_id is not null
          and exists (
            select 1
            from public.company_project_participants cpp
            where cpp.project_id = feedback360_reports.project_id
              and cpp.user_id = (select auth.uid())
          )
        )
      )
    )
  );

drop policy if exists feedback360_reports_write_admin on public.feedback360_reports;
create policy feedback360_reports_write_admin
  on public.feedback360_reports for all to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

drop policy if exists feedback360_report_access_select_admin_or_self on public.feedback360_report_access;
create policy feedback360_report_access_select_admin_or_self
  on public.feedback360_report_access for select to authenticated
  using (
    (select public.is_global_admin())
    or user_id = (select auth.uid())
  );

drop policy if exists feedback360_report_access_write_admin on public.feedback360_report_access;
create policy feedback360_report_access_write_admin
  on public.feedback360_report_access for all to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

grant select, insert, update, delete on public.feedback360_reports to authenticated;
grant select, insert, update, delete on public.feedback360_report_access to authenticated;
