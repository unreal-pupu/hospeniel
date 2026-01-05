-- Add categories support to menu_items
-- This migration adds a categories table and category_id to menu_items

begin;

-- Create categories table
create table if not exists public.categories (
  id uuid default gen_random_uuid() primary key,
  vendor_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(vendor_id, name)
);

-- Add category_id to menu_items if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'menu_items' 
    and column_name = 'category_id'
  ) then
    alter table public.menu_items 
      add column category_id uuid references public.categories(id) on delete set null;
    raise notice 'Added category_id column to menu_items table';
  end if;
end $$;

-- Add availability status to menu_items if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'menu_items' 
    and column_name = 'availability'
  ) then
    alter table public.menu_items 
      add column availability text default 'available' check (availability in ('available', 'out_of_stock'));
    raise notice 'Added availability column to menu_items table';
  end if;
end $$;

-- Grant permissions
grant select, insert, update, delete on public.categories to authenticated;

-- Enable RLS on categories
alter table if exists public.categories enable row level security;

-- Drop existing policies if any
drop policy if exists "Vendors can view own categories" on public.categories;
drop policy if exists "Vendors can manage own categories" on public.categories;

-- Policy 1: Vendors can view their own categories
create policy "Vendors can view own categories"
  on public.categories
  for select
  to authenticated
  using (vendor_id = auth.uid());

-- Policy 2: Vendors can insert, update, and delete their own categories
create policy "Vendors can manage own categories"
  on public.categories
  for all
  to authenticated
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

commit;











