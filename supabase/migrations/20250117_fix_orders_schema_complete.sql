-- COMPLETE FIX: Ensure all order columns exist
-- This migration adds ALL missing columns that are referenced in the code
-- Fixes PGRST204 errors preventing order creation

begin;

-- Step 1: Add delivery_zone column (CRITICAL - fixes PGRST204 error)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'delivery_zone'
  ) then
    alter table public.orders
    add column delivery_zone text;
    
    raise notice '✅ Added delivery_zone column to orders table';
  else
    raise notice 'delivery_zone column already exists';
  end if;
end $$;

-- Step 2: Add special_instructions column (if missing)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'special_instructions'
  ) then
    alter table public.orders
    add column special_instructions text;
    
    raise notice '✅ Added special_instructions column to orders table';
  else
    raise notice 'special_instructions column already exists';
  end if;
end $$;

-- Step 3: Verify delivery_charge column exists (from previous migration)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'delivery_charge'
  ) then
    alter table public.orders
    add column delivery_charge numeric(10, 2);
    
    raise notice '✅ Added delivery_charge column to orders table';
  else
    raise notice 'delivery_charge column already exists';
  end if;
end $$;

-- Step 4: Verify all delivery address columns exist
do $$
begin
  -- delivery_address
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'delivery_address'
  ) then
    alter table public.orders
    add column delivery_address text;
    raise notice '✅ Added delivery_address column';
  end if;
  
  -- delivery_city
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'delivery_city'
  ) then
    alter table public.orders
    add column delivery_city text;
    raise notice '✅ Added delivery_city column';
  end if;
  
  -- delivery_state
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'delivery_state'
  ) then
    alter table public.orders
    add column delivery_state text;
    raise notice '✅ Added delivery_state column';
  end if;
  
  -- delivery_phone
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'delivery_phone'
  ) then
    alter table public.orders
    add column delivery_phone text;
    raise notice '✅ Added delivery_phone column';
  end if;
  
  -- delivery_postal_code
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'delivery_postal_code'
  ) then
    alter table public.orders
    add column delivery_postal_code text;
    raise notice '✅ Added delivery_postal_code column';
  end if;
end $$;

-- Step 5: Create indexes for performance
create index if not exists idx_orders_delivery_zone 
  on public.orders(delivery_zone) 
  where delivery_zone is not null;

-- Step 6: Add comments to document columns
comment on column public.orders.delivery_zone is 
  'Delivery zone for the order (e.g., Yenagoa, Amassoma, Otuoke, Bayelsa, Rivers, Lagos, Abuja)';

comment on column public.orders.special_instructions is 
  'Special delivery instructions provided by the customer';

commit;

-- CRITICAL INSTRUCTIONS:
-- 1. Run this migration in Supabase SQL Editor
-- 2. After migration completes, restart your Next.js dev server to refresh PostgREST schema cache
-- 3. The schema cache must be refreshed for PostgREST to recognize new columns
-- 4. Test order creation to verify the fix

-- Verification queries (run separately after migration):
--
-- Check all delivery columns exist:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'orders'
--   AND column_name IN (
--     'delivery_zone',
--     'delivery_address',
--     'delivery_city',
--     'delivery_state',
--     'delivery_phone',
--     'delivery_postal_code',
--     'delivery_charge',
--     'special_instructions'
--   )
-- ORDER BY column_name;
--
-- Test order creation (replace with actual IDs):
-- INSERT INTO public.orders (
--   user_id, 
--   vendor_id, 
--   product_id, 
--   quantity, 
--   total_price, 
--   status,
--   delivery_address,
--   delivery_city,
--   delivery_state,
--   delivery_zone,
--   delivery_phone,
--   delivery_charge
-- )
-- VALUES (
--   'USER_ID', 
--   'VENDOR_ID', 
--   'PRODUCT_ID', 
--   1, 
--   2500.00, 
--   'Pending',
--   'Test Address',
--   'Yenagoa',
--   'Bayelsa',
--   'Bayelsa',
--   '+2347063818349',
--   2000.00
-- );
--
-- Verify order was created:
-- SELECT id, vendor_id, status, delivery_zone, delivery_address
-- FROM public.orders 
-- WHERE delivery_zone = 'Bayelsa'
-- ORDER BY created_at DESC 
-- LIMIT 1;





