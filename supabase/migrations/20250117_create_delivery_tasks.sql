-- Migration: Create delivery_tasks table for delivery workflow
-- This table handles deliveries separately from orders

begin;

-- Step 1: Create delivery_tasks table
create table if not exists public.delivery_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  vendor_id uuid not null references auth.users(id) on delete restrict,
  rider_id uuid references auth.users(id) on delete set null,
  pickup_address text not null,
  delivery_address text not null,
  delivery_phone text,
  status text not null default 'Pending' check (status in ('Pending', 'Assigned', 'PickedUp', 'Delivered')),
  created_at timestamp with time zone default now() not null,
  assigned_at timestamp with time zone,
  picked_up_at timestamp with time zone,
  delivered_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null
);

-- Step 2: Create indexes for better query performance
create index if not exists idx_delivery_tasks_order_id on public.delivery_tasks(order_id);
create index if not exists idx_delivery_tasks_vendor_id on public.delivery_tasks(vendor_id);
create index if not exists idx_delivery_tasks_rider_id on public.delivery_tasks(rider_id);
create index if not exists idx_delivery_tasks_status on public.delivery_tasks(status);
create index if not exists idx_delivery_tasks_created_at on public.delivery_tasks(created_at desc);

-- Step 3: Create function to update updated_at timestamp
create or replace function public.update_delivery_tasks_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Step 4: Create trigger to auto-update updated_at
drop trigger if exists update_delivery_tasks_updated_at on public.delivery_tasks;
create trigger update_delivery_tasks_updated_at
  before update on public.delivery_tasks
  for each row
  execute function public.update_delivery_tasks_updated_at();

-- Step 5: Enable RLS
alter table public.delivery_tasks enable row level security;

-- Step 6: Drop existing policies if any
drop policy if exists "Vendors can create delivery tasks" on public.delivery_tasks;
drop policy if exists "Vendors can view own delivery tasks" on public.delivery_tasks;
drop policy if exists "Vendors can update own delivery tasks" on public.delivery_tasks;
drop policy if exists "Riders can view pending delivery tasks" on public.delivery_tasks;
drop policy if exists "Riders can accept delivery tasks" on public.delivery_tasks;
drop policy if exists "Riders can update assigned delivery tasks" on public.delivery_tasks;
drop policy if exists "Customers can view delivery status for their orders" on public.delivery_tasks;
drop policy if exists "Admins can view all delivery tasks" on public.delivery_tasks;

-- Step 7: Create RLS policies

-- Policy 1: Vendors can create delivery tasks for their orders
create policy "Vendors can create delivery tasks"
  on public.delivery_tasks
  for insert
  to authenticated
  with check (
    vendor_id = auth.uid() and
    exists (
      select 1 from public.orders
      where id = order_id and vendor_id = auth.uid()
    )
  );

-- Policy 2: Vendors can view their own delivery tasks
create policy "Vendors can view own delivery tasks"
  on public.delivery_tasks
  for select
  to authenticated
  using (vendor_id = auth.uid());

-- Policy 3: Vendors can update their own delivery tasks (for status changes, etc.)
create policy "Vendors can update own delivery tasks"
  on public.delivery_tasks
  for update
  to authenticated
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

-- Policy 4: Riders can view pending delivery tasks (status = 'Pending')
create policy "Riders can view pending delivery tasks"
  on public.delivery_tasks
  for select
  to authenticated
  using (
    status = 'Pending' and
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'rider'
    )
  );

-- Policy 5: Riders can view their assigned delivery tasks
create policy "Riders can view assigned delivery tasks"
  on public.delivery_tasks
  for select
  to authenticated
  using (
    rider_id = auth.uid() and
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'rider'
    )
  );

-- Policy 6: Riders can accept delivery tasks (update status to 'Assigned' and set rider_id)
create policy "Riders can accept delivery tasks"
  on public.delivery_tasks
  for update
  to authenticated
  using (
    status = 'Pending' and
    rider_id is null and
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'rider'
    )
  )
  with check (
    rider_id = auth.uid() and
    status = 'Assigned'
  );

-- Policy 7: Riders can update their assigned delivery tasks (for status changes)
create policy "Riders can update assigned delivery tasks"
  on public.delivery_tasks
  for update
  to authenticated
  using (
    rider_id = auth.uid() and
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'rider'
    )
  )
  with check (rider_id = auth.uid());

-- Policy 8: Customers can view delivery status for their orders
create policy "Customers can view delivery status for their orders"
  on public.delivery_tasks
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders
      where id = order_id and user_id = auth.uid()
    )
  );

-- Policy 9: Admins can view all delivery tasks
create policy "Admins can view all delivery tasks"
  on public.delivery_tasks
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and (is_admin = true or role = 'admin')
    )
  );

-- Step 8: Ensure notifications table has title column
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

-- Step 9: Update notifications type constraint to include delivery types
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
      'new_task',
      'delivery_request',
      'rider_assigned',
      'order_in_transit',
      'delivery_completed',
      'order_delivered'
    ));
    
  raise notice 'Updated notifications type constraint to include delivery types';
exception
  when others then
    raise notice 'Could not update notifications type constraint: %', sqlerrm;
end $$;

-- Step 10: Create function to notify riders when delivery task is created
create or replace function public.notify_riders_on_delivery_task()
returns trigger as $$
declare
  rider_ids uuid[];
begin
  -- Get all approved riders
  select array_agg(id) into rider_ids
  from public.profiles
  where role = 'rider' and id in (
    select id from auth.users
  );

  -- Create notifications for all riders
  if rider_ids is not null and array_length(rider_ids, 1) > 0 then
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      read,
      metadata
    )
    select
      rider_id,
      'delivery_request',
      'New delivery available',
      'A new delivery task is available for pickup. Order #' || substring(new.order_id::text, 1, 8),
      false,
      jsonb_build_object(
        'type', 'delivery_task',
        'delivery_task_id', new.id,
        'order_id', new.order_id,
        'status', new.status
      )
    from unnest(rider_ids) as rider_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Step 11: Create trigger to notify riders on delivery task creation
drop trigger if exists notify_riders_on_delivery_task_created on public.delivery_tasks;
create trigger notify_riders_on_delivery_task_created
  after insert on public.delivery_tasks
  for each row
  when (new.status = 'Pending')
  execute function public.notify_riders_on_delivery_task();

-- Step 12: Create function to notify vendor and customer when rider accepts
create or replace function public.notify_on_rider_assigned()
returns trigger as $$
begin
  -- Notify vendor
  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    read,
    metadata
  ) values (
    new.vendor_id,
    'rider_assigned',
    'Rider assigned to order',
    'A rider has been assigned to your order. Order #' || substring(new.order_id::text, 1, 8),
    false,
    jsonb_build_object(
      'type', 'delivery_task',
      'delivery_task_id', new.id,
      'order_id', new.order_id,
      'rider_id', new.rider_id,
      'status', new.status
    )
  );

  -- Notify customer
  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    read,
    metadata
  )
  select
    o.user_id,
    'order_in_transit',
    'Your order is being delivered',
    'A rider has been assigned and is on the way to deliver your order. Order #' || substring(new.order_id::text, 1, 8),
    false,
    jsonb_build_object(
      'type', 'delivery_task',
      'delivery_task_id', new.id,
      'order_id', new.order_id,
      'rider_id', new.rider_id,
      'status', new.status
    )
  from public.orders o
  where o.id = new.order_id;

  return new;
end;
$$ language plpgsql security definer;

-- Step 13: Create trigger to notify when rider is assigned
drop trigger if exists notify_on_rider_assigned_trigger on public.delivery_tasks;
create trigger notify_on_rider_assigned_trigger
  after update on public.delivery_tasks
  for each row
  when (
    old.status = 'Pending' and
    new.status = 'Assigned' and
    new.rider_id is not null and
    old.rider_id is null
  )
  execute function public.notify_on_rider_assigned();

-- Step 14: Create function to notify when delivery is completed
create or replace function public.notify_on_delivery_completed()
returns trigger as $$
begin
  -- Update order status to Completed
  update public.orders
  set status = 'Completed', updated_at = now()
  where id = new.order_id;

  -- Notify vendor
  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    read,
    metadata
  ) values (
    new.vendor_id,
    'delivery_completed',
    'Delivery completed',
    'Order #' || substring(new.order_id::text, 1, 8) || ' has been delivered successfully.',
    false,
    jsonb_build_object(
      'type', 'delivery_task',
      'delivery_task_id', new.id,
      'order_id', new.order_id,
      'status', new.status
    )
  );

  -- Notify customer
  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    read,
    metadata
  )
  select
    o.user_id,
    'order_delivered',
    'Order delivered',
    'Your order #' || substring(new.order_id::text, 1, 8) || ' has been delivered successfully!',
    false,
    jsonb_build_object(
      'type', 'delivery_task',
      'delivery_task_id', new.id,
      'order_id', new.order_id,
      'status', new.status
    )
  from public.orders o
  where o.id = new.order_id;

  return new;
end;
$$ language plpgsql security definer;

-- Step 15: Create trigger to notify when delivery is completed
drop trigger if exists notify_on_delivery_completed_trigger on public.delivery_tasks;
create trigger notify_on_delivery_completed_trigger
  after update on public.delivery_tasks
  for each row
  when (old.status != 'Delivered' and new.status = 'Delivered')
  execute function public.notify_on_delivery_completed();

commit;

-- Verification queries (run separately to confirm):
--
-- 1. Check table structure:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'delivery_tasks'
-- ORDER BY ordinal_position;
--
-- 2. Check RLS policies:
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'delivery_tasks';
--
-- 3. Check indexes:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'delivery_tasks' AND schemaname = 'public';

