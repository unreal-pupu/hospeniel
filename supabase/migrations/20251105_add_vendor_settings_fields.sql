-- Add additional fields to vendors table for vendor settings page
-- This migration adds: phone_number, category, email, is_open, delivery_enabled, pickup_enabled

begin;

-- Step 1: Add phone_number column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'phone_number'
  ) then
    alter table public.vendors 
      add column phone_number text;
    raise notice 'Added phone_number column to vendors table';
  else
    raise notice 'phone_number column already exists in vendors table';
  end if;
end $$;

-- Step 2: Add category column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'category'
  ) then
    alter table public.vendors 
      add column category text;
    raise notice 'Added category column to vendors table';
  else
    raise notice 'category column already exists in vendors table';
  end if;
end $$;

-- Step 3: Add email column if it doesn't exist (separate from auth.users email)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'email'
  ) then
    alter table public.vendors 
      add column email text;
    raise notice 'Added email column to vendors table';
  else
    raise notice 'email column already exists in vendors table';
  end if;
end $$;

-- Step 4: Add is_open column (boolean) if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'is_open'
  ) then
    alter table public.vendors 
      add column is_open boolean default true;
    raise notice 'Added is_open column to vendors table';
  else
    raise notice 'is_open column already exists in vendors table';
  end if;
end $$;

-- Step 5: Add delivery_enabled column (boolean) if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'delivery_enabled'
  ) then
    alter table public.vendors 
      add column delivery_enabled boolean default true;
    raise notice 'Added delivery_enabled column to vendors table';
  else
    raise notice 'delivery_enabled column already exists in vendors table';
  end if;
end $$;

-- Step 6: Add pickup_enabled column (boolean) if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'pickup_enabled'
  ) then
    alter table public.vendors 
      add column pickup_enabled boolean default true;
    raise notice 'Added pickup_enabled column to vendors table';
  else
    raise notice 'pickup_enabled column already exists in vendors table';
  end if;
end $$;

-- Step 7: Ensure image_url column exists (for profile/logo images)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'image_url'
  ) then
    alter table public.vendors 
      add column image_url text;
    raise notice 'Added image_url column to vendors table';
  else
    raise notice 'image_url column already exists in vendors table';
  end if;
end $$;

-- Step 8: Ensure description column exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'description'
  ) then
    alter table public.vendors 
      add column description text;
    raise notice 'Added description column to vendors table';
  else
    raise notice 'description column already exists in vendors table';
  end if;
end $$;

-- Step 9: Create indexes for better query performance
create index if not exists idx_vendors_category on public.vendors(category) where category is not null;
create index if not exists idx_vendors_is_open on public.vendors(is_open) where is_open is not null;

commit;

-- Verification queries (run separately to confirm):
--
-- 1. Check all columns in vendors table:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'vendors'
-- ORDER BY ordinal_position;
--
-- 2. Check indexes:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'vendors' 
--   AND schemaname = 'public';






