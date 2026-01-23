-- Add vendor approval status to profiles
begin;

alter table if exists public.profiles
  add column if not exists approval_status text default 'approved';

-- Ensure existing rows have a value
update public.profiles
set approval_status = 'approved'
where approval_status is null;

-- Enforce valid values
alter table public.profiles
  drop constraint if exists profiles_approval_status_check;

alter table public.profiles
  add constraint profiles_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));

commit;
