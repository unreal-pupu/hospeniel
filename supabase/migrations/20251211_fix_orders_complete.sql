-- Complete fix for orders table and related functionality
-- This migration ensures all necessary columns and constraints are in place

begin;

-- Ensure orders table has all required columns
do $$
begin
  -- Add payment_reference if it doesn't exist
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
  
  -- Ensure status constraint includes all necessary statuses
  alter table public.orders
    drop constraint if exists orders_status_check;
    
  alter table public.orders
    add constraint orders_status_check
    check (status in ('Pending', 'Accepted', 'Confirmed', 'Rejected', 'Completed', 'Cancelled', 'Paid'));
    
  raise notice 'Updated orders table status constraint';
end $$;

-- Create index on payment_reference if it doesn't exist
create index if not exists idx_orders_payment_reference on public.orders(payment_reference);

-- Ensure notification trigger exists and works correctly
-- First, update notifications table to allow 'new_order' type if needed
do $$
begin
  -- Drop and recreate constraint to include 'new_order' type
  alter table public.notifications
    drop constraint if exists notifications_type_check;
    
  alter table public.notifications
    add constraint notifications_type_check
    check (type in ('order_update', 'system', 'payment', 'subscription', 'new_order', 'order_accepted', 'order_rejected', 'order_completed', 'order_cancelled', 'order_status_update'));
    
  raise notice 'Updated notifications type constraint';
end $$;

-- Update notification trigger function
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
  insert into public.notifications (vendor_id, message, type, read)
  values (
    new.vendor_id,
    'You received a new order from ' || coalesce(user_name, 'a customer'),
    'new_order',
    false
  )
  on conflict do nothing;
  
  return new;
end;
$$ language plpgsql security definer;

-- Drop and recreate trigger
drop trigger if exists trigger_notify_vendor_new_order on public.orders;
create trigger trigger_notify_vendor_new_order
  after insert on public.orders
  for each row
  execute function notify_vendor_new_order();

commit;

