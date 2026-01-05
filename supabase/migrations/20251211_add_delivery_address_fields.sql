-- Add delivery address fields to profiles and orders tables
-- This enables marketplace-style delivery functionality

begin;

-- ============================================
-- 1. Add delivery address fields to profiles table
-- ============================================

-- Add delivery address fields to profiles if they don't exist
do $$
begin
  -- Country
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'delivery_country'
  ) then
    alter table public.profiles 
      add column delivery_country text;
    raise notice 'Added delivery_country column to profiles table';
  end if;
  
  -- State
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'delivery_state'
  ) then
    alter table public.profiles 
      add column delivery_state text;
    raise notice 'Added delivery_state column to profiles table';
  end if;
  
  -- City
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'delivery_city'
  ) then
    alter table public.profiles 
      add column delivery_city text;
    raise notice 'Added delivery_city column to profiles table';
  end if;
  
  -- Address
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'delivery_address'
  ) then
    alter table public.profiles 
      add column delivery_address text;
    raise notice 'Added delivery_address column to profiles table';
  end if;
  
  -- Phone Number (if not exists as phone_number)
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'phone_number'
  ) then
    alter table public.profiles 
      add column phone_number text;
    raise notice 'Added phone_number column to profiles table';
  end if;
  
  -- Postal Code
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'postal_code'
  ) then
    alter table public.profiles 
      add column postal_code text;
    raise notice 'Added postal_code column to profiles table';
  end if;
end $$;

-- ============================================
-- 2. Add delivery address fields to orders table
-- ============================================

-- Add delivery address fields to orders if they don't exist
do $$
begin
  -- Delivery Country
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'delivery_country'
  ) then
    alter table public.orders 
      add column delivery_country text;
    raise notice 'Added delivery_country column to orders table';
  end if;
  
  -- Delivery State
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'delivery_state'
  ) then
    alter table public.orders 
      add column delivery_state text;
    raise notice 'Added delivery_state column to orders table';
  end if;
  
  -- Delivery City
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'delivery_city'
  ) then
    alter table public.orders 
      add column delivery_city text;
    raise notice 'Added delivery_city column to orders table';
  end if;
  
  -- Delivery Address
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'delivery_address'
  ) then
    alter table public.orders 
      add column delivery_address text;
    raise notice 'Added delivery_address column to orders table';
  end if;
  
  -- Delivery Phone
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'delivery_phone'
  ) then
    alter table public.orders 
      add column delivery_phone text;
    raise notice 'Added delivery_phone column to orders table';
  end if;
  
  -- Delivery Postal Code
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'delivery_postal_code'
  ) then
    alter table public.orders 
      add column delivery_postal_code text;
    raise notice 'Added delivery_postal_code column to orders table';
  end if;
end $$;

-- ============================================
-- 3. Create indexes for better query performance
-- ============================================

create index if not exists idx_profiles_delivery_state on public.profiles(delivery_state);
create index if not exists idx_profiles_delivery_city on public.profiles(delivery_city);
create index if not exists idx_orders_delivery_state on public.orders(delivery_state);
create index if not exists idx_orders_delivery_city on public.orders(delivery_city);

commit;

-- Verification queries (run separately):
--
-- 1. Check profiles columns:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'profiles' 
--   AND column_name IN ('delivery_country', 'delivery_state', 'delivery_city', 'delivery_address', 'phone_number', 'postal_code');
--
-- 2. Check orders columns:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'orders' 
--   AND column_name IN ('delivery_country', 'delivery_state', 'delivery_city', 'delivery_address', 'delivery_phone', 'delivery_postal_code');
