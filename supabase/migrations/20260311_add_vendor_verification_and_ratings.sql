-- Add vendor verification flag and vendor ratings table

begin;

-- Add verified flag to vendors table (default false)
alter table if exists public.vendors
  add column if not exists verified boolean default false;

-- Create vendor_ratings table
create table if not exists public.vendor_ratings (
  id uuid primary key default gen_random_uuid(),
  vendor_id bigint not null references public.vendors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  review text,
  created_at timestamptz not null default now()
);

-- Prevent duplicate ratings per vendor/user
create unique index if not exists vendor_ratings_vendor_user_unique
  on public.vendor_ratings (vendor_id, user_id);

create index if not exists vendor_ratings_vendor_id_idx
  on public.vendor_ratings (vendor_id);

create index if not exists vendor_ratings_created_at_idx
  on public.vendor_ratings (created_at desc);

-- Enable RLS
alter table if exists public.vendor_ratings enable row level security;

-- Grant permissions to authenticated role
grant usage on schema public to authenticated;
grant select, insert, update on public.vendor_ratings to authenticated;

-- Public can read vendor ratings
drop policy if exists "Public can view vendor ratings" on public.vendor_ratings;
create policy "Public can view vendor ratings"
  on public.vendor_ratings
  for select
  to public
  using (true);

-- Authenticated users can insert their own rating for a vendor
drop policy if exists "Users can rate vendors" on public.vendor_ratings;
create policy "Users can rate vendors"
  on public.vendor_ratings
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Authenticated users can update their own rating
drop policy if exists "Users can update own vendor ratings" on public.vendor_ratings;
create policy "Users can update own vendor ratings"
  on public.vendor_ratings
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;
