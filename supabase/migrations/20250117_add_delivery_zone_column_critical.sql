-- CRITICAL FIX: Add delivery_zone column to orders table
-- This fixes the PGRST204 error preventing order creation

begin;

-- Step 1: Add delivery_zone column to orders table if it doesn't exist
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
    raise notice 'delivery_zone column already exists in orders table';
  end if;
end $$;

-- Step 2: Add index for delivery zone queries (if needed)
create index if not exists idx_orders_delivery_zone 
  on public.orders(delivery_zone) 
  where delivery_zone is not null;

-- Step 3: Add comment to document the column
comment on column public.orders.delivery_zone is 
  'Delivery zone for the order (e.g., Yenagoa, Amassoma, Otuoke, Bayelsa, Rivers, Lagos, Abuja)';

commit;

-- CRITICAL: After running this migration, restart the dev server to refresh PostgREST schema cache
-- The schema cache needs to be refreshed for PostgREST to recognize the new column

-- Verification queries (run separately):
--
-- Check column exists:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'orders'
--   AND column_name = 'delivery_zone';
--
-- Test order creation (replace with actual IDs):
-- INSERT INTO public.orders (
--   user_id, 
--   vendor_id, 
--   product_id, 
--   quantity, 
--   total_price, 
--   status,
--   delivery_zone
-- )
-- VALUES (
--   'USER_ID', 
--   'VENDOR_ID', 
--   'PRODUCT_ID', 
--   1, 
--   100.00, 
--   'Pending',
--   'Bayelsa'
-- );
--
-- Verify order was created:
-- SELECT id, vendor_id, status, delivery_zone 
-- FROM public.orders 
-- WHERE delivery_zone = 'Bayelsa'
-- ORDER BY created_at DESC 
-- LIMIT 1;





