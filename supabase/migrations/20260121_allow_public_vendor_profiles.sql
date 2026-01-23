-- Allow public (anon) read access to vendor profiles for listings
-- Restrict to vendors only to avoid exposing user profiles

begin;

-- Ensure anon can select from profiles
grant select on public.profiles to anon;

-- Enable RLS if not already enabled
alter table if exists public.profiles enable row level security;

-- Drop existing public vendor listing policy if it exists
drop policy if exists "Public can view vendor profiles" on public.profiles;

-- Allow public read of vendor profiles only
create policy "Public can view vendor profiles"
  on public.profiles
  for select
  to public
  using (role = 'vendor');

commit;
