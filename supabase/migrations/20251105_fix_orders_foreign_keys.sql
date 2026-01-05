-- Fix orders table foreign key constraints
-- This migration ensures all foreign keys reference the correct tables:
-- - user_id and vendor_id should reference auth.users(id)
-- - product_id should reference menu_items(id)
-- 
-- This fixes the issue where constraints might reference a non-existent 'users' table
-- instead of 'auth.users'
--
-- IMPORTANT: This migration safely handles RLS policies by dropping them before
-- altering column types, then recreating them afterward.

begin;

-- Step 1: Drop ALL existing RLS policies on the orders table
-- This is necessary because PostgreSQL won't allow altering column types
-- when policies depend on those columns
do $$
declare
  policy_record record;
begin
  -- Drop all policies on the orders table
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
  loop
    execute format('drop policy if exists %I on public.orders', policy_record.policyname);
    raise notice 'Dropped policy: %', policy_record.policyname;
  end loop;
end $$;

-- Step 2: Drop existing foreign key constraints if they exist
-- This allows us to recreate them with the correct references
do $$
declare
  constraint_record record;
begin
  -- Drop user_id foreign key constraint if it exists
  for constraint_record in
    select constraint_name
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'orders'
      and constraint_type = 'FOREIGN KEY'
      and constraint_name like '%user_id%'
  loop
    execute format('alter table public.orders drop constraint if exists %I cascade', constraint_record.constraint_name);
    raise notice 'Dropped constraint: %', constraint_record.constraint_name;
  end loop;

  -- Drop vendor_id foreign key constraint if it exists
  for constraint_record in
    select constraint_name
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'orders'
      and constraint_type = 'FOREIGN KEY'
      and constraint_name like '%vendor_id%'
  loop
    execute format('alter table public.orders drop constraint if exists %I cascade', constraint_record.constraint_name);
    raise notice 'Dropped constraint: %', constraint_record.constraint_name;
  end loop;

  -- Drop product_id foreign key constraint if it exists (we'll recreate it)
  for constraint_record in
    select constraint_name
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'orders'
      and constraint_type = 'FOREIGN KEY'
      and constraint_name like '%product_id%'
  loop
    execute format('alter table public.orders drop constraint if exists %I cascade', constraint_record.constraint_name);
    raise notice 'Dropped constraint: %', constraint_record.constraint_name;
  end loop;
end $$;

-- Step 3: Ensure user_id column exists and has correct type
-- Now that policies are dropped, we can safely alter the column type
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'user_id'
  ) then
    -- Column doesn't exist, add it
    alter table public.orders
      add column user_id uuid;
    -- Set a default for existing rows (we'll handle this with a temporary default)
    -- Then make it NOT NULL after populating
    raise notice 'Added user_id column';
  else
    -- Column exists, check if we need to change the type
    -- First, check current data type
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'user_id'
        and data_type != 'uuid'
    ) then
      -- Type is not uuid, convert it
      -- Handle existing data: if column has data, we need to preserve it
      -- If it's already uuid but constraint is wrong, just recreate constraint
      alter table public.orders
        alter column user_id type uuid using 
        case 
          when user_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
          then user_id::uuid
          else null
        end;
      raise notice 'Converted user_id column to uuid type';
    end if;
    
    -- Ensure NOT NULL constraint (only if column has no nulls or we're okay with data loss)
    -- For safety, we'll check if there are nulls first
    if not exists (
      select 1 from public.orders where user_id is null limit 1
    ) then
      alter table public.orders
        alter column user_id set not null;
      raise notice 'Set user_id to NOT NULL';
    else
      raise notice 'Warning: user_id has null values, keeping nullable for now';
    end if;
  end if;
end $$;

-- Step 4: Ensure vendor_id column exists and has correct type
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'vendor_id'
  ) then
    -- Column doesn't exist, add it
    alter table public.orders
      add column vendor_id uuid;
    raise notice 'Added vendor_id column';
  else
    -- Column exists, check if we need to change the type
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'vendor_id'
        and data_type != 'uuid'
    ) then
      -- Type is not uuid, convert it
      alter table public.orders
        alter column vendor_id type uuid using 
        case 
          when vendor_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
          then vendor_id::uuid
          else null
        end;
      raise notice 'Converted vendor_id column to uuid type';
    end if;
    
    -- Ensure NOT NULL constraint
    if not exists (
      select 1 from public.orders where vendor_id is null limit 1
    ) then
      alter table public.orders
        alter column vendor_id set not null;
      raise notice 'Set vendor_id to NOT NULL';
    else
      raise notice 'Warning: vendor_id has null values, keeping nullable for now';
    end if;
  end if;
end $$;

-- Step 5: Add foreign key constraint for user_id referencing auth.users(id)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'orders'
      and constraint_name = 'orders_user_id_fkey'
      and constraint_type = 'FOREIGN KEY'
  ) then
    alter table public.orders
      add constraint orders_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
    raise notice 'Added user_id foreign key constraint to auth.users(id)';
  else
    raise notice 'user_id foreign key constraint already exists';
  end if;
end $$;

-- Step 6: Add foreign key constraint for vendor_id referencing auth.users(id)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'orders'
      and constraint_name = 'orders_vendor_id_fkey'
      and constraint_type = 'FOREIGN KEY'
  ) then
    alter table public.orders
      add constraint orders_vendor_id_fkey
      foreign key (vendor_id) references auth.users(id) on delete cascade;
    raise notice 'Added vendor_id foreign key constraint to auth.users(id)';
  else
    raise notice 'vendor_id foreign key constraint already exists';
  end if;
end $$;

-- Step 7: Ensure product_id column exists and add foreign key if menu_items table exists
do $$
begin
  -- Check if menu_items table exists
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'menu_items'
  ) then
    -- Ensure product_id column exists
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'product_id'
    ) then
      alter table public.orders
        add column product_id uuid;
      raise notice 'Added product_id column';
    end if;

    -- Add foreign key constraint for product_id
    if not exists (
      select 1 from information_schema.table_constraints
      where table_schema = 'public'
        and table_name = 'orders'
        and constraint_name = 'orders_product_id_fkey'
        and constraint_type = 'FOREIGN KEY'
    ) then
      alter table public.orders
        add constraint orders_product_id_fkey
        foreign key (product_id) references public.menu_items(id) on delete set null;
      raise notice 'Added product_id foreign key constraint to menu_items(id)';
    else
      raise notice 'product_id foreign key constraint already exists';
    end if;
  else
    raise notice 'menu_items table does not exist, skipping product_id constraint';
  end if;
end $$;

-- Step 8: Create indexes for better performance
create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_vendor_id on public.orders(vendor_id);
create index if not exists idx_orders_product_id on public.orders(product_id) where product_id is not null;

-- Step 9: Recreate RLS policies with correct structure
-- Now that columns are the correct type, we can safely recreate the policies
do $$
begin
  -- Policy 1: Vendors can view their own orders
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
  create policy "Users can create orders"
    on public.orders
    for insert
    to authenticated
    with check (user_id = auth.uid());

  raise notice 'Recreated RLS policies on orders table';
end $$;

commit;

-- Verification queries (run separately to confirm):
--
-- 1. Check foreign key constraints:
-- SELECT
--   tc.constraint_name,
--   tc.table_name,
--   kcu.column_name,
--   ccu.table_schema AS foreign_table_schema,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
--   AND tc.table_schema = kcu.table_schema
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
--   AND ccu.table_schema = tc.table_schema
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_schema = 'public'
--   AND tc.table_name = 'orders';
--
-- Expected results:
-- - orders_user_id_fkey: user_id -> auth.users(id)
-- - orders_vendor_id_fkey: vendor_id -> auth.users(id)
-- - orders_product_id_fkey: product_id -> public.menu_items(id)
--
-- 2. Verify a user exists in auth.users:
-- SELECT id, email FROM auth.users LIMIT 5;
--
-- 3. Test insert (replace with actual user IDs from auth.users):
-- INSERT INTO public.orders (user_id, vendor_id, product_id, quantity, total_price, status)
-- VALUES (
--   (SELECT id FROM auth.users LIMIT 1),
--   (SELECT id FROM auth.users LIMIT 1 OFFSET 1),
--   (SELECT id FROM public.menu_items LIMIT 1),
--   1,
--   1000.00,
--   'Pending'
-- );

