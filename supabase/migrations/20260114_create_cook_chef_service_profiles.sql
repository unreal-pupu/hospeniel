-- Create cook_chef_profiles table for Home Cook and Chef service management
-- This table stores specialties, pricing models, and service modes for cooks/chefs

begin;

-- Create cook_chef_profiles table
create table if not exists public.cook_chef_profiles (
  id uuid default gen_random_uuid() primary key,
  vendor_id uuid references auth.users(id) on delete cascade not null unique,
  specialties text[] default '{}' not null, -- Array of dishes/cuisines (e.g., ["Jollof Rice", "Vegan Meals"])
  pricing_model text not null check (pricing_model in ('per_meal', 'per_hour', 'per_job')),
  base_price numeric(10, 2) not null, -- Base price for the selected pricing model
  service_mode text[] default '{}' not null, -- Array of service modes (e.g., ["cook & deliver", "cook at customer location"])
  bio text, -- Optional bio/description
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create index for faster lookups
create index if not exists idx_cook_chef_profiles_vendor_id on public.cook_chef_profiles(vendor_id);

-- Create function to update updated_at timestamp
create or replace function update_cook_chef_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
drop trigger if exists update_cook_chef_profiles_updated_at on public.cook_chef_profiles;
create trigger update_cook_chef_profiles_updated_at
  before update on public.cook_chef_profiles
  for each row
  execute function update_cook_chef_profiles_updated_at();

-- Enable RLS
alter table public.cook_chef_profiles enable row level security;

-- RLS Policy: Vendors can view and update their own profile
create policy "Vendors can view their own cook/chef profile"
  on public.cook_chef_profiles
  for select
  to authenticated
  using (auth.uid() = vendor_id);

create policy "Vendors can insert their own cook/chef profile"
  on public.cook_chef_profiles
  for insert
  to authenticated
  with check (auth.uid() = vendor_id);

create policy "Vendors can update their own cook/chef profile"
  on public.cook_chef_profiles
  for update
  to authenticated
  using (auth.uid() = vendor_id);

-- Grant permissions
grant usage on schema public to authenticated;
grant select, insert, update on public.cook_chef_profiles to authenticated;

commit;
