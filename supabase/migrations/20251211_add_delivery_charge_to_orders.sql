-- Add delivery_charge column to orders table
-- This enables delivery charge calculation and storage for orders

begin;

-- ============================================
-- 1. Add delivery_charge column to orders table
-- ============================================

do $$
begin
  -- Add delivery_charge column if it doesn't exist
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'delivery_charge'
  ) then
    alter table public.orders 
      add column delivery_charge numeric(10, 2) default 0;
    raise notice '✅ Added delivery_charge column to orders table';
  else
    raise notice 'ℹ️ delivery_charge column already exists in orders table';
  end if;
end $$;

-- ============================================
-- 2. Add delivery fields to profiles table if they don't exist
-- ============================================

do $$
begin
  -- Add delivery_city if it doesn't exist
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'delivery_city'
  ) then
    alter table public.profiles 
      add column delivery_city text;
    raise notice '✅ Added delivery_city column to profiles table';
  end if;

  -- Add delivery_state if it doesn't exist
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'delivery_state'
  ) then
    alter table public.profiles 
      add column delivery_state text;
    raise notice '✅ Added delivery_state column to profiles table';
  end if;

  -- Add delivery_address_line_1 if it doesn't exist (for detailed address)
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'delivery_address_line_1'
  ) then
    alter table public.profiles 
      add column delivery_address_line_1 text;
    raise notice '✅ Added delivery_address_line_1 column to profiles table';
  end if;

  -- Add delivery_postal_code if it doesn't exist
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'delivery_postal_code'
  ) then
    alter table public.profiles 
      add column delivery_postal_code text;
    raise notice '✅ Added delivery_postal_code column to profiles table';
  end if;
end $$;

-- ============================================
-- 3. Add delivery fields to orders table if they don't exist
-- ============================================

do $$
begin
  -- Add delivery_city if it doesn't exist
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'delivery_city'
  ) then
    alter table public.orders 
      add column delivery_city text;
    raise notice '✅ Added delivery_city column to orders table';
  end if;

  -- Add delivery_state if it doesn't exist
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'delivery_state'
  ) then
    alter table public.orders 
      add column delivery_state text;
    raise notice '✅ Added delivery_state column to orders table';
  end if;

  -- Add delivery_address_line_1 if it doesn't exist
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'delivery_address_line_1'
  ) then
    alter table public.orders 
      add column delivery_address_line_1 text;
    raise notice '✅ Added delivery_address_line_1 column to orders table';
  end if;

  -- Add delivery_postal_code if it doesn't exist
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'delivery_postal_code'
  ) then
    alter table public.orders 
      add column delivery_postal_code text;
    raise notice '✅ Added delivery_postal_code column to orders table';
  end if;

  -- Add delivery_phone_number if it doesn't exist
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'delivery_phone_number'
  ) then
    alter table public.orders 
      add column delivery_phone_number text;
    raise notice '✅ Added delivery_phone_number column to orders table';
  end if;
end $$;

-- ============================================
-- 4. Create indexes for better query performance
-- ============================================

create index if not exists idx_orders_delivery_charge on public.orders(delivery_charge) where delivery_charge > 0;
create index if not exists idx_orders_delivery_city on public.orders(delivery_city) where delivery_city is not null;
create index if not exists idx_orders_delivery_state on public.orders(delivery_state) where delivery_state is not null;
create index if not exists idx_profiles_delivery_city on public.profiles(delivery_city) where delivery_city is not null;
create index if not exists idx_profiles_delivery_state on public.profiles(delivery_state) where delivery_state is not null;

commit;

-- ============================================
-- Verification queries (run separately):
-- ============================================
--
-- 1. Check orders columns:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'orders' 
--   AND column_name IN ('delivery_charge', 'delivery_city', 'delivery_state', 'delivery_address_line_1', 'delivery_postal_code', 'delivery_phone_number');
--
-- 2. Check profiles columns:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'profiles' 
--   AND column_name IN ('delivery_city', 'delivery_state', 'delivery_address_line_1', 'delivery_postal_code', 'address', 'phone_number');

