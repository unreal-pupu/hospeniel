-- Fix orders table schema to ensure all required columns exist
-- This migration handles cases where the table exists but columns are missing
-- or where the table structure needs to be updated

begin;

-- Step 1: Create orders table if it doesn't exist with all required columns
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  vendor_id uuid references auth.users(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references public.menu_items(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  total_price numeric(10, 2) not null check (total_price >= 0),
  status text not null default 'Pending' check (status in ('Pending', 'Accepted', 'Completed', 'Cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Step 2: Add product_id column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'product_id'
  ) then
    -- Add as nullable first (since it can be null on delete)
    alter table public.orders 
      add column product_id uuid;
    
    -- Add foreign key constraint
    alter table public.orders
      add constraint orders_product_id_fkey
      foreign key (product_id) references public.menu_items(id) on delete set null;
    
    raise notice 'Added product_id column to orders table';
  else
    -- Ensure foreign key constraint exists
    if not exists (
      select 1 from information_schema.table_constraints
      where table_schema = 'public'
      and table_name = 'orders'
      and constraint_name = 'orders_product_id_fkey'
    ) then
      alter table public.orders
        add constraint orders_product_id_fkey
        foreign key (product_id) references public.menu_items(id) on delete set null;
      raise notice 'Added product_id foreign key constraint';
    end if;
  end if;
end $$;

-- Step 3: Add quantity column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'quantity'
  ) then
    alter table public.orders 
      add column quantity integer not null default 1 check (quantity > 0);
    raise notice 'Added quantity column to orders table';
  end if;
end $$;

-- Step 4: Handle total_price column (may be named total_amount in old schema)
do $$
begin
  -- Check if total_amount exists (old column name)
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'total_amount'
  ) and not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'total_price'
  ) then
    -- Rename total_amount to total_price
    alter table public.orders rename column total_amount to total_price;
    raise notice 'Renamed total_amount to total_price';
  end if;
  
  -- Ensure total_price column exists
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'total_price'
  ) then
    alter table public.orders 
      add column total_price numeric(10, 2) not null default 0 check (total_price >= 0);
    raise notice 'Added total_price column to orders table';
  else
    -- Ensure it's numeric type and has correct constraints
    alter table public.orders 
      alter column total_price type numeric(10, 2) using total_price::numeric(10, 2);
    alter table public.orders 
      alter column total_price set not null;
    alter table public.orders 
      alter column total_price set default 0;
    raise notice 'Updated total_price column constraints';
  end if;
end $$;

-- Step 5: Ensure status column exists with correct default and constraint
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'status'
  ) then
    alter table public.orders 
      add column status text not null default 'Pending';
    -- Add check constraint separately
    alter table public.orders 
      add constraint orders_status_check 
      check (status in ('Pending', 'Accepted', 'Completed', 'Cancelled'));
    raise notice 'Added status column to orders table';
  else
    -- Update default
    alter table public.orders 
      alter column status set default 'Pending';
    -- Ensure check constraint exists
    if not exists (
      select 1 from information_schema.table_constraints
      where table_schema = 'public'
      and table_name = 'orders'
      and constraint_name = 'orders_status_check'
    ) then
      alter table public.orders 
        add constraint orders_status_check 
        check (status in ('Pending', 'Accepted', 'Completed', 'Cancelled'));
    end if;
    raise notice 'Updated status column';
  end if;
end $$;

-- Step 6: Ensure vendor_id column exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'vendor_id'
  ) then
    alter table public.orders 
      add column vendor_id uuid references auth.users(id) on delete cascade not null;
    raise notice 'Added vendor_id column to orders table';
  end if;
end $$;

-- Step 7: Ensure user_id column exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'user_id'
  ) then
    alter table public.orders 
      add column user_id uuid references auth.users(id) on delete cascade not null;
    raise notice 'Added user_id column to orders table';
  end if;
end $$;

-- Step 8: Ensure created_at column exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'created_at'
  ) then
    alter table public.orders 
      add column created_at timestamp with time zone default timezone('utc'::text, now()) not null;
    raise notice 'Added created_at column to orders table';
  end if;
end $$;

-- Step 9: Ensure updated_at column exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'updated_at'
  ) then
    alter table public.orders 
      add column updated_at timestamp with time zone default timezone('utc'::text, now()) not null;
    raise notice 'Added updated_at column to orders table';
  end if;
end $$;

-- Step 10: Create indexes for better query performance
create index if not exists idx_orders_vendor_id on public.orders(vendor_id);
create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_product_id on public.orders(product_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_created_at on public.orders(created_at desc);

-- Step 11: Create function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Step 12: Create trigger to automatically update updated_at
drop trigger if exists update_orders_updated_at on public.orders;
create trigger update_orders_updated_at
  before update on public.orders
  for each row
  execute function update_updated_at_column();

-- Step 13: Grant permissions
grant usage on schema public to authenticated;
grant select, insert, update on public.orders to authenticated;

-- Step 14: Enable RLS
alter table if exists public.orders enable row level security;

-- Step 15: Drop existing policies to recreate them cleanly
drop policy if exists "Vendors can view own orders" on public.orders;
drop policy if exists "Vendors can update own orders" on public.orders;
drop policy if exists "Users can view own orders" on public.orders;
drop policy if exists "Users can create orders" on public.orders;

-- Step 16: Create RLS policies

-- Policy 1: Vendors can view their own orders
-- vendor_id references auth.users(id), which matches vendors.profile_id
create policy "Vendors can view own orders"
  on public.orders
  for select
  to authenticated
  using (vendor_id = auth.uid());

-- Policy 2: Vendors can update their own orders
create policy "Vendors can update own orders"
  on public.orders
  for update
  to authenticated
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

-- Policy 3: Users can view their own orders
create policy "Users can view own orders"
  on public.orders
  for select
  to authenticated
  using (user_id = auth.uid());

-- Policy 4: Users can create orders
-- Users must set user_id to their own auth.uid()
-- They can set vendor_id to any vendor (the vendor will see it)
create policy "Users can create orders"
  on public.orders
  for insert
  to authenticated
  with check (user_id = auth.uid());

commit;

-- Verification queries (run separately to confirm):
--
-- 1. Check table structure:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'orders'
-- ORDER BY ordinal_position;
--
-- Expected columns:
-- - id (uuid, primary key)
-- - vendor_id (uuid, not null, references auth.users(id))
-- - user_id (uuid, not null, references auth.users(id))
-- - product_id (uuid, nullable, references menu_items(id))
-- - quantity (integer, not null, default 1)
-- - total_price (numeric, not null)
-- - status (text, not null, default 'Pending')
-- - created_at (timestamp with time zone, not null, default now())
-- - updated_at (timestamp with time zone, not null, default now())
--
-- 2. Check RLS policies:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'orders';
--
-- 3. Check indexes:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'orders'
--   AND schemaname = 'public';
--
-- 4. Test insert (as a user):
-- INSERT INTO public.orders (user_id, vendor_id, product_id, quantity, total_price, status)
-- VALUES (auth.uid(), 'vendor-user-id', 'product-id', 1, 1000.00, 'Pending');

