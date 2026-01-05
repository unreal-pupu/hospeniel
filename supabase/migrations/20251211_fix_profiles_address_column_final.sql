-- Final fix for profiles table address column
-- This migration ensures the address column exists and handles all edge cases
-- Run this migration to guarantee the address column is present

begin;

-- ============================================
-- 1. Ensure address column exists in profiles
-- ============================================

do $$
begin
  -- Check if address column exists
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'address'
  ) then
    -- Add address column if it doesn't exist
    alter table public.profiles 
      add column address text;
    raise notice '✅ Added address column to profiles table';
  else
    raise notice 'ℹ️ address column already exists in profiles table';
  end if;
end $$;

-- ============================================
-- 2. Ensure phone_number column exists in profiles
-- ============================================

do $$
begin
  -- Check if phone_number column exists
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'phone_number'
  ) then
    -- Add phone_number column if it doesn't exist
    alter table public.profiles 
      add column phone_number text;
    raise notice '✅ Added phone_number column to profiles table';
  else
    raise notice 'ℹ️ phone_number column already exists in profiles table';
  end if;
end $$;

-- ============================================
-- 3. Ensure location column exists (for vendors)
-- ============================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'location'
  ) then
    alter table public.profiles 
      add column location text;
    raise notice '✅ Added location column to profiles table';
  else
    raise notice 'ℹ️ location column already exists in profiles table';
  end if;
end $$;

-- ============================================
-- 4. Ensure category column exists (for vendors)
-- ============================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'category'
  ) then
    alter table public.profiles 
      add column category text;
    raise notice '✅ Added category column to profiles table';
  else
    raise notice 'ℹ️ category column already exists in profiles table';
  end if;
end $$;

-- ============================================
-- 5. Create indexes for better query performance
-- ============================================

create index if not exists idx_profiles_address on public.profiles(address) where address is not null;
create index if not exists idx_profiles_phone_number on public.profiles(phone_number) where phone_number is not null;
create index if not exists idx_profiles_location on public.profiles(location) where location is not null;
create index if not exists idx_profiles_category on public.profiles(category) where category is not null;

commit;

-- ============================================
-- Verification queries (run separately to verify):
-- ============================================
--
-- 1. Check all profiles columns:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'profiles' 
--   AND column_name IN ('address', 'phone_number', 'location', 'category')
-- ORDER BY column_name;
--
-- 2. Check if columns exist:
-- SELECT 
--   column_name,
--   CASE WHEN column_name = 'address' THEN '✅ address exists' 
--        WHEN column_name = 'phone_number' THEN '✅ phone_number exists'
--        WHEN column_name = 'location' THEN '✅ location exists'
--        WHEN column_name = 'category' THEN '✅ category exists'
--   END as status
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'profiles' 
--   AND column_name IN ('address', 'phone_number', 'location', 'category');





