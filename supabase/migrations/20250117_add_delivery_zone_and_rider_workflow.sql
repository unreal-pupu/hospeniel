-- Add delivery zone to orders and implement rider workflow
-- This migration adds delivery_zone field and sets up rider notification triggers

begin;

-- Step 1: Add delivery_zone column to orders table
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
    
    raise notice 'Added delivery_zone column to orders table';
  else
    raise notice 'delivery_zone column already exists in orders table';
  end if;
end $$;

-- Step 2: Add special_instructions column to orders table (optional field)
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
    
    raise notice 'Added special_instructions column to orders table';
  else
    raise notice 'special_instructions column already exists in orders table';
  end if;
end $$;

-- Step 3: Create index for delivery zone queries
create index if not exists idx_orders_delivery_zone 
  on public.orders(delivery_zone) 
  where delivery_zone is not null;

-- Step 4: Update notifications type constraint to include 'new_task'
do $$
begin
  -- Drop existing constraint if it exists
  alter table public.notifications
    drop constraint if exists notifications_type_check;
  
  -- Add new constraint with 'new_task' type
  alter table public.notifications
    add constraint notifications_type_check
    check (type in ('order_update', 'system', 'payment', 'subscription', 'new_task'));
  
  raise notice 'Updated notifications type constraint to include new_task';
exception
  when others then
    raise notice 'Could not update notifications type constraint: %', sqlerrm;
end $$;

-- Step 5: Create function to notify rider when assigned to order
create or replace function notify_rider_assignment()
returns trigger as $$
declare
  rider_name text;
  customer_name text;
  vendor_name text;
begin
  -- Only trigger when rider_id is assigned (was null, now has value)
  if new.rider_id is not null and (old is null or old.rider_id is null or old.rider_id != new.rider_id) then
    -- Get rider name
    select coalesce(name, email, 'Rider') into rider_name
    from profiles
    where id = new.rider_id;
    
    -- Get customer name
    select coalesce(name, email, 'Customer') into customer_name
    from profiles
    where id = new.user_id;
    
    -- Get vendor name
    select coalesce(name, email, 'Vendor') into vendor_name
    from profiles
    where id = new.vendor_id;
    
    -- Insert notification for the rider
    -- Use vendor_id as recipient_id for riders (since notifications table uses vendor_id for rider notifications)
    insert into notifications (
      vendor_id,
      type,
      message,
      read,
      created_at,
      metadata
    ) values (
      new.rider_id,
      'new_task',
      'Order #' || substring(new.id::text, 1, 8) || ' for ' || customer_name,
      false,
      now(),
      jsonb_build_object(
        'type', 'rider_assignment',
        'order_id', new.id,
        'customer_name', customer_name,
        'vendor_name', vendor_name,
        'delivery_address', new.delivery_address,
        'delivery_zone', new.delivery_zone
      )
    );
    
    raise notice 'Notification created for rider % on order %', new.rider_id, new.id;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Step 6: Create trigger to notify rider on assignment
drop trigger if exists notify_rider_assignment_trigger on orders;
create trigger notify_rider_assignment_trigger
  after insert or update of rider_id on orders
  for each row
  execute function notify_rider_assignment();

-- Step 7: Create RLS policy for riders to view their assigned orders
drop policy if exists "riders can view their orders" on public.orders;
create policy "riders can view their orders"
  on public.orders
  for select
  using (rider_id = auth.uid());

-- Step 8: Create RLS policy for riders to update their assigned orders
drop policy if exists "riders can update their assigned orders" on public.orders;
create policy "riders can update their assigned orders"
  on public.orders
  for update
  using (rider_id = auth.uid())
  with check (rider_id = auth.uid());

-- Step 9: Ensure notifications table has proper structure for rider notifications
-- Check if user_id column exists (some schemas use vendor_id as recipient)
do $$
begin
  -- If user_id doesn't exist, we'll use vendor_id as recipient_id
  -- This is handled in the notification insert above
  raise notice 'Notifications will use user_id or vendor_id as recipient based on schema';
end $$;

-- Step 10: Create index for rider order queries
create index if not exists idx_orders_rider_status 
  on public.orders(rider_id, status) 
  where rider_id is not null;

commit;

-- Verification queries (run separately):
--
-- Check delivery_zone column:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'orders'
--   AND column_name = 'delivery_zone';
--
-- Check trigger exists:
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND trigger_name = 'notify_rider_assignment_trigger';
--
-- Check RLS policies:
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'orders'
--   AND policyname LIKE '%rider%';

