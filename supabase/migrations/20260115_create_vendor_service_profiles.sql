-- Create vendor_service_profiles table for Chef and Home Cook vendors
-- This table stores service-related fields for vendors whose category is 'chef' or 'home_cook'
-- Links to vendors via profile_id (which references auth.users(id))

begin;

-- Step 1: Create the vendor_service_profiles table
-- DO NOT assume it exists - create it first
create table if not exists public.vendor_service_profiles (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references auth.users(id) on delete cascade not null unique,
  -- profile_id links to the vendor's auth.users(id), which matches vendors.profile_id
  specialties text[] default '{}' not null,
  -- Array of dishes/cuisines (e.g., ["Jollof Rice", "Vegan Meals"])
  pricing_model text not null check (pricing_model in ('per_meal', 'per_hour', 'per_job')),
  base_price numeric(10, 2) not null default 0.00,
  service_mode text[] default '{}' not null,
  -- Array of service modes: ['cook_and_deliver', 'cook_at_customer_location']
  bio text,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Step 2: Create index for faster lookups
create index if not exists idx_vendor_service_profiles_profile_id 
  on public.vendor_service_profiles(profile_id);

-- Step 3: Create function to update updated_at timestamp
create or replace function update_vendor_service_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Step 4: Create trigger to automatically update updated_at
drop trigger if exists update_vendor_service_profiles_updated_at 
  on public.vendor_service_profiles;
create trigger update_vendor_service_profiles_updated_at
  before update on public.vendor_service_profiles
  for each row
  execute function update_vendor_service_profiles_updated_at();

-- Step 5: Enable RLS
alter table public.vendor_service_profiles enable row level security;

-- Step 6: Drop existing policies if they exist (to recreate them)
drop policy if exists "Vendors can view their own service profile" 
  on public.vendor_service_profiles;
drop policy if exists "Vendors can insert their own service profile" 
  on public.vendor_service_profiles;
drop policy if exists "Vendors can update their own service profile" 
  on public.vendor_service_profiles;
drop policy if exists "Public can view service profiles" 
  on public.vendor_service_profiles;

-- Step 7: RLS Policy - Vendors can view and update their own profile
create policy "Vendors can view their own service profile"
  on public.vendor_service_profiles
  for select
  to authenticated
  using (auth.uid() = profile_id);

create policy "Vendors can insert their own service profile"
  on public.vendor_service_profiles
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

create policy "Vendors can update their own service profile"
  on public.vendor_service_profiles
  for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Step 8: RLS Policy - Public can view service profiles (for explore page)
-- Only show profiles for vendors with category 'chef' or 'home_cook'
create policy "Public can view service profiles"
  on public.vendor_service_profiles
  for select
  to public
  using (
    exists (
      select 1 from public.vendors v
      where v.profile_id = vendor_service_profiles.profile_id
      and v.category in ('chef', 'home_cook')
    )
  );

-- Step 9: Grant permissions
grant usage on schema public to authenticated;
grant select, insert, update on public.vendor_service_profiles to authenticated;
grant select on public.vendor_service_profiles to public;

commit;

-- Verification queries (run separately if needed):
--
-- Check if table exists:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name = 'vendor_service_profiles';
--
-- Check columns:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'vendor_service_profiles';
--
-- Check RLS policies:
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'vendor_service_profiles';
