-- Create cook_chef_availability table for managing availability calendar
-- This allows cooks/chefs to set available time slots

begin;

-- Create cook_chef_availability table
create table if not exists public.cook_chef_availability (
  id uuid default gen_random_uuid() primary key,
  vendor_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  is_available boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(vendor_id, date, start_time, end_time)
);

-- Create indexes for better query performance
create index if not exists idx_cook_chef_availability_vendor_id on public.cook_chef_availability(vendor_id);
create index if not exists idx_cook_chef_availability_date on public.cook_chef_availability(date);
create index if not exists idx_cook_chef_availability_vendor_date on public.cook_chef_availability(vendor_id, date);

-- Create function to update updated_at timestamp
create or replace function update_cook_chef_availability_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
drop trigger if exists update_cook_chef_availability_updated_at on public.cook_chef_availability;
create trigger update_cook_chef_availability_updated_at
  before update on public.cook_chef_availability
  for each row
  execute function update_cook_chef_availability_updated_at();

-- Enable RLS
alter table public.cook_chef_availability enable row level security;

-- RLS Policy: Vendors can manage their own availability
create policy "Vendors can view their own availability"
  on public.cook_chef_availability
  for select
  to authenticated
  using (auth.uid() = vendor_id);

create policy "Vendors can insert their own availability"
  on public.cook_chef_availability
  for insert
  to authenticated
  with check (auth.uid() = vendor_id);

create policy "Vendors can update their own availability"
  on public.cook_chef_availability
  for update
  to authenticated
  using (auth.uid() = vendor_id);

create policy "Vendors can delete their own availability"
  on public.cook_chef_availability
  for delete
  to authenticated
  using (auth.uid() = vendor_id);

-- RLS Policy: Users can view availability of cooks/chefs (for booking)
create policy "Users can view cook/chef availability"
  on public.cook_chef_availability
  for select
  to authenticated
  using (
    is_available = true
    and exists (
      select 1 from public.profiles p
      where p.id = vendor_id
      and p.category in ('chef', 'home_cook')
    )
  );

-- Grant permissions
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.cook_chef_availability to authenticated;

commit;
