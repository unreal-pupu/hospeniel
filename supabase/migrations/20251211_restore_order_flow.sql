-- Restore order flow functionality
-- This migration ensures all triggers, real-time, and notifications work correctly

begin;

-- ============================================
-- 1. Ensure real-time is enabled for orders and notifications
-- ============================================

-- Enable real-time for orders table (if not already enabled)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and tablename = 'orders'
    and schemaname = 'public'
  ) then
    alter publication supabase_realtime add table public.orders;
    raise notice 'Enabled real-time for orders table';
  else
    raise notice 'Real-time already enabled for orders table';
  end if;
end $$;

-- Enable real-time for notifications table (if not already enabled)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and tablename = 'notifications'
    and schemaname = 'public'
  ) then
    alter publication supabase_realtime add table public.notifications;
    raise notice 'Enabled real-time for notifications table';
  else
    raise notice 'Real-time already enabled for notifications table';
  end if;
end $$;

-- ============================================
-- 2. Ensure notification trigger exists and works
-- ============================================

-- Update notification type constraint to include all types
do $$
begin
  alter table public.notifications
    drop constraint if exists notifications_type_check;
    
  alter table public.notifications
    add constraint notifications_type_check
    check (type in (
      'order_update', 
      'system', 
      'payment', 
      'subscription', 
      'new_order',
      'order_accepted',
      'order_rejected',
      'order_completed',
      'order_cancelled',
      'order_status_update'
    ));
    
  raise notice 'Updated notifications type constraint';
end $$;

-- Recreate notification trigger function with better error handling
create or replace function notify_vendor_new_order()
returns trigger as $$
declare
  vendor_name text;
  user_name text;
begin
  -- Get vendor name from profiles
  select name into vendor_name
  from public.profiles
  where id = new.vendor_id;
  
  -- Get user name from profiles
  select name into user_name
  from public.profiles
  where id = new.user_id;
  
  -- Create notification for vendor
  -- Use on conflict do nothing to prevent errors if notification already exists
  insert into public.notifications (vendor_id, message, type, read)
  values (
    new.vendor_id,
    'You received a new order from ' || coalesce(user_name, 'a customer'),
    'new_order',
    false
  )
  on conflict do nothing;
  
  return new;
exception
  when others then
    -- Log error but don't fail the order insertion
    raise warning 'Error creating vendor notification: %', SQLERRM;
    return new;
end;
$$ language plpgsql security definer;

-- Drop and recreate trigger to ensure it's active
drop trigger if exists trigger_notify_vendor_new_order on public.orders;
create trigger trigger_notify_vendor_new_order
  after insert on public.orders
  for each row
  execute function notify_vendor_new_order();

-- ============================================
-- 3. Ensure RLS policies allow order creation
-- ============================================

-- Verify users can create orders
do $$
begin
  -- Check if policy exists
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'orders' 
    and policyname = 'Users can create orders'
  ) then
    create policy "Users can create orders"
      on public.orders
      for insert
      to authenticated
      with check (user_id = auth.uid());
    raise notice 'Created "Users can create orders" policy';
  else
    raise notice 'Policy "Users can create orders" already exists';
  end if;
end $$;

-- ============================================
-- 4. Ensure orders table has all required columns
-- ============================================

-- Add payment_reference if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'payment_reference'
  ) then
    alter table public.orders 
      add column payment_reference text;
    raise notice 'Added payment_reference column to orders table';
  end if;
end $$;

-- Ensure status constraint includes all necessary statuses
do $$
begin
  alter table public.orders
    drop constraint if exists orders_status_check;
    
  alter table public.orders
    add constraint orders_status_check
    check (status in ('Pending', 'Accepted', 'Confirmed', 'Rejected', 'Completed', 'Cancelled', 'Paid'));
    
  raise notice 'Updated orders status constraint';
end $$;

-- Create index on payment_reference if it doesn't exist
create index if not exists idx_orders_payment_reference on public.orders(payment_reference);

-- ============================================
-- 5. Ensure notifications table has metadata column
-- ============================================

-- Add metadata column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'notifications' 
    and column_name = 'metadata'
  ) then
    alter table public.notifications
      add column metadata jsonb;
    raise notice 'Added metadata column to notifications table';
  end if;
end $$;

-- Create index for metadata queries if it doesn't exist
create index if not exists idx_notifications_metadata on public.notifications using gin(metadata);

commit;

-- Verification queries (run separately):
--
-- 1. Check real-time is enabled:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('orders', 'notifications');
--
-- 2. Check trigger exists:
-- SELECT trigger_name, event_object_table, action_timing, event_manipulation
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public' AND trigger_name = 'trigger_notify_vendor_new_order';
--
-- 3. Check RLS policies:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'orders';
--
-- 4. Test order creation (should create notification):
-- INSERT INTO public.orders (user_id, vendor_id, product_id, quantity, total_price, status, payment_reference)
-- VALUES (
--   auth.uid(),
--   'vendor_uuid_here',
--   'product_uuid_here',
--   1,
--   1000.00,
--   'Paid',
--   'test_ref_123'
-- );





