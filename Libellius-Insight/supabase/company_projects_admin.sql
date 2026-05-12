-- Company projects for admin participant management.
-- Run after schema.sql / admin_access_management.sql.

create table if not exists public.company_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  name text not null,
  company_name text not null,
  description text,
  contact_person_name text,
  contact_person_email text,
  status text not null default 'active'
    check (status in ('active', 'completed', 'archived')),
  module_codes text[] not null default array[]::text[],
  result_access_date timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_projects_name_not_blank check (length(trim(name)) > 0),
  constraint company_projects_company_not_blank check (length(trim(company_name)) > 0),
  constraint company_projects_contact_email_format check (
    contact_person_email is null
    or contact_person_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  )
);

create table if not exists public.company_project_participants (
  project_id uuid not null references public.company_projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists company_projects_organization_id_idx
  on public.company_projects (organization_id);

create index if not exists company_projects_status_idx
  on public.company_projects (status);

create index if not exists company_projects_company_name_idx
  on public.company_projects (lower(company_name));

create index if not exists company_project_participants_user_id_idx
  on public.company_project_participants (user_id);

drop trigger if exists company_projects_touch_updated_at on public.company_projects;
create trigger company_projects_touch_updated_at
  before update on public.company_projects
  for each row execute function public.touch_updated_at();

alter table public.company_projects enable row level security;
alter table public.company_project_participants enable row level security;

drop policy if exists company_projects_select_admin_or_member on public.company_projects;
create policy company_projects_select_admin_or_member
  on public.company_projects for select to authenticated
  using (
    (select public.is_global_admin())
    or exists (
      select 1
      from public.company_project_participants cpp
      where cpp.project_id = company_projects.id
        and cpp.user_id = (select auth.uid())
    )
  );

drop policy if exists company_projects_write_admin on public.company_projects;
create policy company_projects_write_admin
  on public.company_projects for all to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

drop policy if exists company_project_participants_select_admin_or_self on public.company_project_participants;
create policy company_project_participants_select_admin_or_self
  on public.company_project_participants for select to authenticated
  using (
    (select public.is_global_admin())
    or user_id = (select auth.uid())
  );

drop policy if exists company_project_participants_write_admin on public.company_project_participants;
create policy company_project_participants_write_admin
  on public.company_project_participants for all to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

grant select, insert, update, delete on public.company_projects to authenticated;
grant select, insert, update, delete on public.company_project_participants to authenticated;
