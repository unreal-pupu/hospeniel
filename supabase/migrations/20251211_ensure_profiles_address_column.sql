-- Ensure profiles table has address and phone_number columns
-- This migration ensures the address column exists for both users and vendors
-- and that phone_number exists for users

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
    raise notice 'Added address column to profiles table';
  else
    raise notice 'address column already exists in profiles table';
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
    raise notice 'Added phone_number column to profiles table';
  else
    raise notice 'phone_number column already exists in profiles table';
  end if;
end $$;

-- ============================================
-- 3. Create index on address for better query performance (optional)
-- ============================================

create index if not exists idx_profiles_address on public.profiles(address) where address is not null;

-- ============================================
-- 4. Create index on phone_number for better query performance (optional)
-- ============================================

create index if not exists idx_profiles_phone_number on public.profiles(phone_number) where phone_number is not null;

commit;

-- Verification query (run separately):
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'profiles' 
--   AND column_name IN ('address', 'phone_number');





