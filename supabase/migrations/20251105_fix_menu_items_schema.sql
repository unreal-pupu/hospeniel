-- Fix menu_items table schema to match requirements
-- This migration ensures the table has the correct columns:
-- - title (instead of name)
-- - availability (boolean, default true)
-- - All other required columns

begin;

-- Step 1: Ensure menu_items table exists with basic structure
create table if not exists public.menu_items (
  id uuid default gen_random_uuid() primary key,
  vendor_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Step 2: Add or rename name column to title
do $$
begin
  -- Check if name column exists
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'menu_items' 
    and column_name = 'name'
  ) then
    -- Rename name to title if title doesn't exist
    if not exists (
      select 1 from information_schema.columns 
      where table_schema = 'public' 
      and table_name = 'menu_items' 
      and column_name = 'title'
    ) then
      alter table public.menu_items rename column name to title;
      raise notice 'Renamed name column to title';
    else
      -- If both exist, copy data from name to title and drop name
      update public.menu_items set title = name where title is null;
      alter table public.menu_items drop column name;
      raise notice 'Copied name to title and dropped name column';
    end if;
  elsif not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'menu_items' 
    and column_name = 'title'
  ) then
    -- Add title column if it doesn't exist
    alter table public.menu_items add column title text not null default '';
    raise notice 'Added title column';
  end if;
end $$;

-- Step 3: Add description column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'menu_items' 
    and column_name = 'description'
  ) then
    alter table public.menu_items add column description text;
    raise notice 'Added description column';
  end if;
end $$;

-- Step 4: Add price column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'menu_items' 
    and column_name = 'price'
  ) then
    alter table public.menu_items add column price numeric(10, 2) not null default 0;
    raise notice 'Added price column';
  end if;
end $$;

-- Step 5: Fix availability column - convert from text to boolean if needed
do $$
begin
  -- Check if availability column exists
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'menu_items' 
    and column_name = 'availability'
  ) then
    -- Check if it's text type
    if exists (
      select 1 from information_schema.columns 
      where table_schema = 'public' 
      and table_name = 'menu_items' 
      and column_name = 'availability'
      and data_type = 'text'
    ) then
      -- Convert text availability to boolean
      -- First, add a temporary column
      alter table public.menu_items add column availability_temp boolean default true;
      
      -- Convert values: 'available' -> true, 'out_of_stock' -> false, null -> true
      update public.menu_items 
      set availability_temp = case 
        when availability = 'available' then true
        when availability = 'out_of_stock' then false
        else true
      end;
      
      -- Drop the old column
      alter table public.menu_items drop column availability;
      
      -- Rename the temp column
      alter table public.menu_items rename column availability_temp to availability;
      
      -- Set default and not null
      alter table public.menu_items alter column availability set default true;
      alter table public.menu_items alter column availability set not null;
      
      raise notice 'Converted availability from text to boolean';
    else
      -- It's already boolean, just ensure default and constraints
      alter table public.menu_items alter column availability set default true;
      -- Make it not null if it isn't already
      alter table public.menu_items alter column availability set not null;
      raise notice 'Availability column is already boolean, updated constraints';
    end if;
  else
    -- Add availability column as boolean
    alter table public.menu_items add column availability boolean not null default true;
    raise notice 'Added availability column as boolean';
  end if;
end $$;

-- Step 6: Add image_url column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'menu_items' 
    and column_name = 'image_url'
  ) then
    alter table public.menu_items add column image_url text;
    raise notice 'Added image_url column';
  end if;
end $$;

-- Step 7: Ensure created_at has default
do $$
begin
  -- Check if created_at exists and doesn't have default
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'menu_items' 
    and column_name = 'created_at'
    and column_default is null
  ) then
    alter table public.menu_items 
    alter column created_at set default timezone('utc'::text, now());
    raise notice 'Set default for created_at';
  end if;
end $$;

-- Step 8: Grant permissions
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.menu_items to authenticated;

-- Step 9: Enable RLS (if not already enabled)
alter table if exists public.menu_items enable row level security;

commit;

-- Verification queries (run separately to confirm):
--
-- Check table structure:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'menu_items'
-- ORDER BY ordinal_position;
--
-- Expected columns:
-- - id (uuid, primary key)
-- - vendor_id (uuid, not null)
-- - title (text, not null)
-- - description (text, nullable)
-- - price (numeric, not null)
-- - availability (boolean, not null, default true)
-- - image_url (text, nullable)
-- - created_at (timestamp with time zone, not null, default now())


























