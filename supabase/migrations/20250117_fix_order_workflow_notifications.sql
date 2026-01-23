-- Fix order workflow notifications
-- This migration ensures notifications work correctly for the order workflow

begin;

-- Step 1: Ensure notifications table has title column
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'notifications'
    and column_name = 'title'
  ) then
    alter table public.notifications
    add column title text;
    
    raise notice 'Added title column to notifications table';
  else
    raise notice 'title column already exists in notifications table';
  end if;
end $$;

-- Step 2: Update notifications type constraint to include all needed types
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
      'order_status_update',
      'new_task'
    ));
    
  raise notice 'Updated notifications type constraint';
end $$;

-- Step 3: Create or replace function to notify vendor when order is created
create or replace function notify_vendor_new_order()
returns trigger as $$
declare
  vendor_name text;
  customer_name text;
  order_id_short text;
begin
  -- Get vendor name
  select coalesce(name, email, 'Vendor') into vendor_name
  from public.profiles
  where id = new.vendor_id;
  
  -- Get customer name
  select coalesce(name, email, 'Customer') into customer_name
  from public.profiles
  where id = new.user_id;
  
  -- Get short order ID
  order_id_short := substring(new.id::text, 1, 8);
  
  -- Create notification for vendor
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
      'total_price', new.total_price
    )
  );
  
  raise notice 'Notification created for vendor % on order %', new.vendor_id, new.id;
  
  return new;
exception
  when others then
    raise warning 'Error creating vendor notification: %', sqlerrm;
    return new;
end;
$$ language plpgsql security definer;

-- Step 4: Drop and recreate trigger for vendor notifications
drop trigger if exists trigger_notify_vendor_new_order on public.orders;
create trigger trigger_notify_vendor_new_order
  after insert on public.orders
  for each row
  when (new.status = 'Paid' or new.status = 'Pending')
  execute function notify_vendor_new_order();

-- Step 5: Create function to notify customer when vendor accepts order
create or replace function notify_customer_order_accepted()
returns trigger as $$
declare
  customer_name text;
  vendor_name text;
  order_id_short text;
  menu_item_title text;
begin
  -- Only trigger when status changes to Accepted
  if new.status = 'Accepted' and (old is null or old.status != 'Accepted') then
    -- Get customer name
    select coalesce(name, email, 'Customer') into customer_name
    from public.profiles
    where id = new.user_id;
    
    -- Get vendor name
    select coalesce(name, email, 'Vendor') into vendor_name
    from public.profiles
    where id = new.vendor_id;
    
    -- Get menu item title if available
    if new.product_id is not null then
      select title into menu_item_title
      from public.menu_items
      where id = new.product_id;
    end if;
    
    -- Get short order ID
    order_id_short := substring(new.id::text, 1, 8);
    
    -- Create notification for customer
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      read,
      created_at,
      metadata
    )
    values (
      new.user_id,
      'order_accepted',
      'Your order has been accepted',
      'Your order #' || order_id_short || ' is being prepared' || 
      case when menu_item_title is not null then ' for ' || menu_item_title else '' end,
      false,
      now(),
      jsonb_build_object(
        'type', 'order_accepted',
        'order_id', new.id,
        'vendor_name', vendor_name,
        'status', new.status
      )
    );
    
    raise notice 'Notification created for customer % on order %', new.user_id, new.id;
  end if;
  
  return new;
exception
  when others then
    raise warning 'Error creating customer notification: %', sqlerrm;
    return new;
end;
$$ language plpgsql security definer;

-- Step 6: Create trigger for customer notifications
drop trigger if exists trigger_notify_customer_order_accepted on public.orders;
create trigger trigger_notify_customer_order_accepted
  after update of status on public.orders
  for each row
  execute function notify_customer_order_accepted();

-- Step 7: Create index for better notification queries
create index if not exists idx_notifications_vendor_unread 
  on public.notifications(vendor_id, read) 
  where vendor_id is not null and read = false;

create index if not exists idx_notifications_user_unread 
  on public.notifications(user_id, read) 
  where user_id is not null and read = false;

commit;

-- Verification queries (run separately):
--
-- Check title column exists:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'notifications'
--   AND column_name = 'title';
--
-- Check triggers exist:
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND trigger_name IN ('trigger_notify_vendor_new_order', 'trigger_notify_customer_order_accepted');





