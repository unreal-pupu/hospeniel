begin;

-- Sponsored banners displayed on homepage for vendors with `sponsored_banners` entitlement.

create table if not exists public.sponsored_banners (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  image_url text not null,
  link_url text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_sponsored_banners_vendor_id on public.sponsored_banners(vendor_id);
create index if not exists idx_sponsored_banners_status on public.sponsored_banners(status);
create index if not exists idx_sponsored_banners_created_at on public.sponsored_banners(created_at desc);

create or replace function update_sponsored_banners_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_sponsored_banners_updated_at on public.sponsored_banners;
create trigger trigger_update_sponsored_banners_updated_at
before update on public.sponsored_banners
for each row
execute function update_sponsored_banners_updated_at();

-- Banner tracking events (views/clicks/conversions)
create table if not exists public.sponsored_banner_events (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid not null references public.sponsored_banners(id) on delete cascade,
  vendor_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('view', 'click', 'conversion')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_sponsored_banner_events_banner_id on public.sponsored_banner_events(banner_id);
create index if not exists idx_sponsored_banner_events_vendor_id on public.sponsored_banner_events(vendor_id);
create index if not exists idx_sponsored_banner_events_created_at on public.sponsored_banner_events(created_at desc);

-- Enable RLS
alter table public.sponsored_banners enable row level security;
alter table public.sponsored_banner_events enable row level security;

-- Vendors can manage their own banners
drop policy if exists "Vendors can select own sponsored banners" on public.sponsored_banners;
create policy "Vendors can select own sponsored banners"
  on public.sponsored_banners
  for select
  to authenticated
  using (vendor_id = auth.uid());

drop policy if exists "Vendors can insert own sponsored banners" on public.sponsored_banners;
create policy "Vendors can insert own sponsored banners"
  on public.sponsored_banners
  for insert
  to authenticated
  with check (vendor_id = auth.uid());

drop policy if exists "Vendors can update own sponsored banners" on public.sponsored_banners;
create policy "Vendors can update own sponsored banners"
  on public.sponsored_banners
  for update
  to authenticated
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

drop policy if exists "Vendors can delete own sponsored banners" on public.sponsored_banners;
create policy "Vendors can delete own sponsored banners"
  on public.sponsored_banners
  for delete
  to authenticated
  using (vendor_id = auth.uid());

-- Public read: only active banners from vendors whose entitlement is active
drop policy if exists "Public can read active sponsored banners (via entitlement)" on public.sponsored_banners;
create policy "Public can read active sponsored banners (via entitlement)"
  on public.sponsored_banners
  for select
  to public
  using (
    status = 'active'
    and exists (
      select 1
      from public.vendor_entitlements ve
      join public.features f on f.id = ve.feature_id
      where ve.vendor_id = sponsored_banners.vendor_id
        and f.name = 'sponsored_banners'
        and ve.status = 'active'
        and (ve.expires_at is null or ve.expires_at > timezone('utc'::text, now()))
    )
  );

-- Vendors can view their own tracking events
drop policy if exists "Vendors can select own banner events" on public.sponsored_banner_events;
create policy "Vendors can select own banner events"
  on public.sponsored_banner_events
  for select
  to authenticated
  using (vendor_id = auth.uid());

-- Grants for service_role (API routes use service role)
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.sponsored_banners to service_role;
grant select, insert, update, delete on table public.sponsored_banner_events to service_role;

commit;

