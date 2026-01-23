-- Migration: Add vendor_location to delivery_tasks and update rider assignment logic
-- This ensures delivery requests are only sent to riders in the same location as the vendor

begin;

-- Step 1: Add vendor_location column to delivery_tasks table
alter table public.delivery_tasks
  add column if not exists vendor_location text;

-- Step 2: Create index for vendor_location for better query performance
create index if not exists idx_delivery_tasks_vendor_location 
  on public.delivery_tasks(vendor_location);

-- Step 3: Update existing delivery_tasks to populate vendor_location from vendor's profile
-- This backfills existing records
update public.delivery_tasks dt
set vendor_location = p.location
from public.profiles p
where dt.vendor_id = p.id
  and dt.vendor_location is null
  and p.location is not null;

-- Step 4: Update the function to notify only riders in the same location
create or replace function public.notify_riders_on_delivery_task()
returns trigger as $$
declare
  rider_ids uuid[];
begin
  -- Get all riders in the same location as the vendor
  select array_agg(p.id) into rider_ids
  from public.profiles p
  where p.role = 'rider'
    and p.location = new.vendor_location
    and p.location is not null
    and p.id in (
      select id from auth.users
    );

  -- Create notifications only for riders in the same location
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
        'status', new.status,
        'vendor_location', new.vendor_location
      )
    from unnest(rider_ids) as rider_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Step 5: Update RLS policy for riders to view pending delivery tasks (add location filter)
drop policy if exists "Riders can view pending delivery tasks" on public.delivery_tasks;

create policy "Riders can view pending delivery tasks"
  on public.delivery_tasks
  for select
  to authenticated
  using (
    status = 'Pending'
    and rider_id is null
    and exists (
      select 1 
      from public.profiles p
      where p.id = auth.uid() 
        and p.role = 'rider'
        and p.location = delivery_tasks.vendor_location
        and p.location is not null
    )
  );

commit;
