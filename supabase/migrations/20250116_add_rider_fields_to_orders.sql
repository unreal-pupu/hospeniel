-- Add rider assignment fields to orders table
-- This enables order delivery tracking by riders

begin;

-- Step 1: Add rider_id column to orders table
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'rider_id'
  ) then
    alter table public.orders
    add column rider_id uuid references auth.users(id) on delete set null;
    
    raise notice 'Added rider_id column to orders table';
  else
    raise notice 'rider_id column already exists in orders table';
  end if;
end $$;

-- Step 2: Add rider assignment timestamp
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'rider_assigned_at'
  ) then
    alter table public.orders
    add column rider_assigned_at timestamp with time zone;
    
    raise notice 'Added rider_assigned_at column to orders table';
  else
    raise notice 'rider_assigned_at column already exists in orders table';
  end if;
end $$;

-- Step 3: Add rider picked up timestamp
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'rider_picked_up_at'
  ) then
    alter table public.orders
    add column rider_picked_up_at timestamp with time zone;
    
    raise notice 'Added rider_picked_up_at column to orders table';
  else
    raise notice 'rider_picked_up_at column already exists in orders table';
  end if;
end $$;

-- Step 4: Add rider delivered timestamp
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'rider_delivered_at'
  ) then
    alter table public.orders
    add column rider_delivered_at timestamp with time zone;
    
    raise notice 'Added rider_delivered_at column to orders table';
  else
    raise notice 'rider_delivered_at column already exists in orders table';
  end if;
end $$;

-- Step 5: Create indexes for faster queries
create index if not exists idx_orders_rider_id 
  on public.orders(rider_id) 
  where rider_id is not null;

create index if not exists idx_orders_rider_status 
  on public.orders(rider_id, status) 
  where rider_id is not null;

-- Step 6: Update status check constraint to include delivery statuses
-- Note: This assumes the status constraint exists. If it doesn't, this will fail gracefully.
do $$
begin
  -- Check if constraint exists and update it
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
    and table_name = 'orders'
    and constraint_name like '%status%check%'
  ) then
    -- Drop existing constraint if it exists
    alter table public.orders
    drop constraint if exists orders_status_check;
    
    -- Add new constraint with delivery statuses
    alter table public.orders
    add constraint orders_status_check 
    check (status in (
      'Pending', 
      'Accepted', 
      'Confirmed', 
      'Rejected', 
      'Completed', 
      'Cancelled', 
      'Paid',
      'Assigned',
      'Picked Up',
      'In Transit',
      'Delivered'
    ));
    
    raise notice 'Updated orders status constraint to include delivery statuses';
  else
    raise notice 'No status constraint found, skipping update';
  end if;
end $$;

-- Step 7: Grant permissions
grant usage on schema public to authenticated;
grant select, update on public.orders to authenticated;

commit;

-- Verification queries (run separately):
--
-- Check columns exist:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'orders'
--   AND column_name IN ('rider_id', 'rider_assigned_at', 'rider_picked_up_at', 'rider_delivered_at');






