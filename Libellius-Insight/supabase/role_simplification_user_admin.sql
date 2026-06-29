-- Simplify application roles to participant/admin only for existing projects.
-- Run this before re-running the updated access-control SQL scripts.

update public.profiles
set role = 'participant'
where role in ('manager', 'consultant');

alter table public.profiles
  drop constraint if exists profiles_role_supported;

alter table public.profiles
  add constraint profiles_role_supported
  check (role in ('participant', 'admin'));
