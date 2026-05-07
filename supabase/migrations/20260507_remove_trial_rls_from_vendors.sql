-- Remove outdated trial/subscription restrictive RLS from vendors table.
-- Keep RLS enabled and enforce ownership-only writes for authenticated users.

begin;

-- Remove legacy restrictive gate that blocks valid vendor updates/inserts.
drop policy if exists "Vendor trial must be active" on public.vendors;

-- Ensure vendors table stays protected by RLS.
alter table if exists public.vendors enable row level security;

-- Ensure authenticated users can write only their own vendor row.
drop policy if exists "Vendors can insert own record" on public.vendors;
create policy "Vendors can insert own record"
  on public.vendors
  for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "Vendors can update own record" on public.vendors;
create policy "Vendors can update own record"
  on public.vendors
  for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

commit;
