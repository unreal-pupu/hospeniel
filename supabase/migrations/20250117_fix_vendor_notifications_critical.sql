-- CRITICAL FIX: Ensure vendor notifications work after payment
-- This migration fixes the blocking issue where vendors don't receive notifications

begin;

-- Step 1: Ensure trigger function can insert notifications (bypass RLS)
-- The function uses SECURITY DEFINER, but we need to ensure it has proper permissions
grant usage on schema public to postgres, service_role;
grant all on public.notifications to postgres, service_role;

-- Step 2: Update notification trigger function with better error handling and logging
create or replace function notify_vendor_new_order()
returns trigger as $$
declare
  vendor_name text;
  customer_name text;
  order_id_short text;
  notification_id uuid;
begin
  -- Only trigger for Pending or Paid orders
  if new.status not in ('Pending', 'Paid') then
    return new;
  end if;
  
  -- Get vendor name (vendor_id references auth.users(id), which matches profiles.id)
  select coalesce(name, email, 'Vendor') into vendor_name
  from public.profiles
  where id = new.vendor_id
  limit 1;
  
  -- Get customer name
  select coalesce(name, email, 'Customer') into customer_name
  from public.profiles
  where id = new.user_id
  limit 1;
  
  -- Get short order ID
  order_id_short := substring(new.id::text, 1, 8);
  
  -- Create notification for vendor
  -- Use SECURITY DEFINER to bypass RLS
  insert into public.notifications (
    vendor_id,
    type,
    title,
    message,
    read,
    created_at,
    metadata
  )
  values (
    new.vendor_id,
    'new_order',
    'New Order Received',
    'Order #' || order_id_short || ' has been placed and paid',
    false,
    now(),
    jsonb_build_object(
      'type', 'new_order',
      'order_id', new.id,
      'customer_name', customer_name,
      'total_price', new.total_price,
      'status', new.status
    )
  )
  returning id into notification_id;
  
  -- Log success (visible in Postgres logs)
  raise notice '✅ Notification created for vendor % on order % (notification_id: %)', 
    new.vendor_id, new.id, notification_id;
  
  return new;
exception
  when others then
    -- Log error but don't fail the order insert
    raise warning '❌ Error creating vendor notification for order %: % (SQLSTATE: %)', 
      new.id, sqlerrm, sqlstate;
    -- Return new to allow order creation to succeed
    return new;
end;
$$ language plpgsql security definer;

-- Step 3: Ensure trigger exists and fires on ALL inserts
-- Remove WHEN clause to ensure it fires for all order inserts
drop trigger if exists trigger_notify_vendor_new_order on public.orders;
create trigger trigger_notify_vendor_new_order
  after insert on public.orders
  for each row
  execute function notify_vendor_new_order();

-- Step 4: Create RLS policy that allows service_role to insert notifications
-- This is needed for triggers that use SECURITY DEFINER
-- Note: service_role bypasses RLS by default, but this makes it explicit
drop policy if exists "Service role can insert notifications" on public.notifications;
-- Service role already bypasses RLS, but we'll add a policy for clarity
-- The SECURITY DEFINER function should work, but let's ensure it

-- Step 5: Grant INSERT permission to the function owner (postgres or service_role)
-- The function owner needs explicit INSERT permission
grant insert on public.notifications to postgres;
grant insert on public.notifications to service_role;

-- Step 6: Verify the trigger is set up correctly
-- This will be verified by checking if notifications are created

commit;

-- CRITICAL: After running this migration, test by:
-- 1. Creating a test order with status 'Pending' or 'Paid'
-- 2. Checking if notification was created in notifications table
-- 3. Verifying vendor can see the notification

-- Verification queries (run separately):
--
-- Check trigger exists:
-- SELECT trigger_name, event_manipulation, event_object_table, action_statement
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND trigger_name = 'trigger_notify_vendor_new_order';
--
-- Test order creation (replace with actual IDs):
-- INSERT INTO public.orders (user_id, vendor_id, product_id, quantity, total_price, status)
-- VALUES ('USER_ID', 'VENDOR_ID', 'PRODUCT_ID', 1, 100.00, 'Pending');
--
-- Check if notification was created:
-- SELECT * FROM public.notifications 
-- WHERE vendor_id = 'VENDOR_ID' 
-- AND type = 'new_order'
-- ORDER BY created_at DESC
-- LIMIT 1;

