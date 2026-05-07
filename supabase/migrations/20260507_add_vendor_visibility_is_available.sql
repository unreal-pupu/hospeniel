-- Add a dedicated Explore visibility flag for vendors.
-- This is separate from is_open (accepting orders) and delivery/pickup toggles.

begin;

alter table if exists public.vendors
  add column if not exists is_available boolean default true;

update public.vendors
set is_available = true
where is_available is null;

alter table if exists public.vendors
  alter column is_available set default true;

create index if not exists idx_vendors_is_available
  on public.vendors(is_available)
  where is_available is not null;

commit;
