-- Vendor feature entitlement system for premium tools.
-- Non-destructive: extends existing payments table and adds feature/entitlement tables.

begin;

-- Extend payments for vendor feature purchases (safe additive changes)
alter table public.payments
  add column if not exists vendor_id uuid references public.profiles(id) on delete set null,
  add column if not exists amount numeric(10, 2),
  add column if not exists payment_type text default 'order',
  add column if not exists payment_metadata jsonb default '{}'::jsonb,
  add column if not exists processed_at timestamptz;

-- Backfill amount from total_amount where needed
update public.payments
set amount = total_amount
where amount is null;

create index if not exists idx_payments_vendor_id on public.payments(vendor_id);
create index if not exists idx_payments_payment_type on public.payments(payment_type);
create index if not exists idx_payments_reference_status on public.payments(payment_reference, status);

-- Canonical feature catalog
create table if not exists public.features (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Vendor entitlements table
create table if not exists public.vendor_entitlements (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.profiles(id) on delete cascade,
  feature_id uuid not null references public.features(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive')),
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (vendor_id, feature_id)
);

create index if not exists idx_vendor_entitlements_vendor_id on public.vendor_entitlements(vendor_id);
create index if not exists idx_vendor_entitlements_feature_id on public.vendor_entitlements(feature_id);
create index if not exists idx_vendor_entitlements_status_expires on public.vendor_entitlements(status, expires_at);

create or replace function update_vendor_entitlements_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_vendor_entitlements_updated_at on public.vendor_entitlements;
create trigger trigger_update_vendor_entitlements_updated_at
  before update on public.vendor_entitlements
  for each row
  execute function update_vendor_entitlements_updated_at();

alter table public.features enable row level security;
alter table public.vendor_entitlements enable row level security;

-- Vendors can read their own entitlements
drop policy if exists "Vendors can select own entitlements" on public.vendor_entitlements;
create policy "Vendors can select own entitlements"
  on public.vendor_entitlements
  for select
  to authenticated
  using (vendor_id = auth.uid());

-- Admin visibility for entitlements
drop policy if exists "Admins can select all entitlements" on public.vendor_entitlements;
create policy "Admins can select all entitlements"
  on public.vendor_entitlements
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and (role = 'admin' or is_admin = true)
    )
  );

-- Everyone authenticated can read features catalog
drop policy if exists "Authenticated can read features catalog" on public.features;
create policy "Authenticated can read features catalog"
  on public.features
  for select
  to authenticated
  using (true);

grant select on public.features to authenticated;
grant select on public.vendor_entitlements to authenticated;

-- Seed known premium-tool features
insert into public.features (name, description)
values
  ('featured_placement', 'Top placement on home and explore pages'),
  ('priority_location_boost', 'Top listing when customers filter by location'),
  ('sponsored_banners', 'Homepage promotional banner slots'),
  ('brand_promotion', 'Additional brand awareness promotions'),
  ('marketing_tools', 'Cross-channel marketing campaigns'),
  ('analytical_marketing', 'Advanced performance and customer insights')
on conflict (name) do nothing;

commit;
