-- Fix orders table foreign key constraints (Safe Version)
-- This migration safely handles RLS policies and column type changes
-- 
-- IMPORTANT: This migration:
-- 1. Drops ALL RLS policies on orders table (temporarily)
-- 2. Fixes column types if needed
-- 3. Fixes foreign key constraints
-- 4. Recreates RLS policies
--
-- This ensures no data loss and maintains RLS functionality

begin;

-- Step 1: Drop ALL existing RLS policies on the orders table
-- This must be done before altering column types
do $$
declare
  policy_record record;
  policy_count integer := 0;
begin
  -- Collect all policy names first
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
  loop
    execute format('drop policy if exists %I on public.orders', policy_record.policyname);
    policy_count := policy_count + 1;
    raise notice 'Dropped policy: %', policy_record.policyname;
  end loop;
  
  if policy_count = 0 then
    raise notice 'No policies found on orders table';
  else
    raise notice 'Dropped % policy(ies) on orders table', policy_count;
  end if;
end $$;

-- Step 2: Drop existing foreign key constraints
do $$
declare
  constraint_record record;
  constraint_count integer := 0;
begin
  -- Drop all foreign key constraints on orders table
  for constraint_record in
    select constraint_name
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'orders'
      and constraint_type = 'FOREIGN KEY'
  loop
    execute format('alter table public.orders drop constraint if exists %I cascade', constraint_record.constraint_name);
    constraint_count := constraint_count + 1;
    raise notice 'Dropped foreign key constraint: %', constraint_record.constraint_name;
  end loop;
  
  if constraint_count = 0 then
    raise notice 'No foreign key constraints found on orders table';
  else
    raise notice 'Dropped % foreign key constraint(s)', constraint_count;
  end if;
end $$;

-- Step 3: Fix user_id column
do $$
declare
  col_exists boolean;
  col_type text;
  has_nulls boolean;
begin
  -- Check if column exists
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'user_id'
  ) into col_exists;
  
  if not col_exists then
    -- Column doesn't exist, add it
    alter table public.orders add column user_id uuid;
    raise notice 'Added user_id column';
  else
    -- Column exists, check its type
    select data_type into col_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'user_id';
    
    if col_type != 'uuid' then
      -- Need to convert type
      -- First check for nulls
      select exists (select 1 from public.orders where user_id is null limit 1) into has_nulls;
      
      if has_nulls then
        raise notice 'Warning: user_id has null values. Converting non-null values to uuid...';
        -- Convert valid UUIDs, set invalid ones to null
        alter table public.orders
          alter column user_id type uuid using 
          case 
            when user_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            then user_id::text::uuid
            else null
          end;
      else
        -- No nulls, safe to convert
        alter table public.orders
          alter column user_id type uuid using user_id::text::uuid;
      end if;
      raise notice 'Converted user_id to uuid type';
    else
      raise notice 'user_id is already uuid type';
    end if;
    
    -- Set NOT NULL if no nulls exist
    select exists (select 1 from public.orders where user_id is null limit 1) into has_nulls;
    if not has_nulls then
      alter table public.orders alter column user_id set not null;
      raise notice 'Set user_id to NOT NULL';
    else
      raise notice 'Warning: user_id has null values, keeping nullable';
    end if;
  end if;
end $$;

-- Step 4: Fix vendor_id column
do $$
declare
  col_exists boolean;
  col_type text;
  has_nulls boolean;
begin
  -- Check if column exists
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'vendor_id'
  ) into col_exists;
  
  if not col_exists then
    -- Column doesn't exist, add it
    alter table public.orders add column vendor_id uuid;
    raise notice 'Added vendor_id column';
  else
    -- Column exists, check its type
    select data_type into col_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'vendor_id';
    
    if col_type != 'uuid' then
      -- Need to convert type
      select exists (select 1 from public.orders where vendor_id is null limit 1) into has_nulls;
      
      if has_nulls then
        raise notice 'Warning: vendor_id has null values. Converting non-null values to uuid...';
        alter table public.orders
          alter column vendor_id type uuid using 
          case 
            when vendor_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            then vendor_id::text::uuid
            else null
          end;
      else
        alter table public.orders
          alter column vendor_id type uuid using vendor_id::text::uuid;
      end if;
      raise notice 'Converted vendor_id to uuid type';
    else
      raise notice 'vendor_id is already uuid type';
    end if;
    
    -- Set NOT NULL if no nulls exist
    select exists (select 1 from public.orders where vendor_id is null limit 1) into has_nulls;
    if not has_nulls then
      alter table public.orders alter column vendor_id set not null;
      raise notice 'Set vendor_id to NOT NULL';
    else
      raise notice 'Warning: vendor_id has null values, keeping nullable';
    end if;
  end if;
end $$;

-- Step 5: Add foreign key constraint for user_id
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
exception
  when others then
    raise notice 'Error adding user_id foreign key: %', sqlerrm;
end $$;

-- Step 6: Add foreign key constraint for vendor_id
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
exception
  when others then
    raise notice 'Error adding vendor_id foreign key: %', sqlerrm;
end $$;

-- Step 7: Ensure product_id column exists and add foreign key
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
      alter table public.orders add column product_id uuid;
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

-- Step 9: Recreate RLS policies
-- Now that columns are fixed, we can safely recreate the policies
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
  create policy "Users can create orders"
    on public.orders
    for insert
    to authenticated
    with check (user_id = auth.uid());

  raise notice 'Successfully recreated RLS policies on orders table';
exception
  when others then
    raise notice 'Error recreating policies: %', sqlerrm;
    raise;
end $$;

commit;

-- Verification queries (run separately after migration):
--
-- 1. Check foreign key constraints:
-- SELECT
--   tc.constraint_name,
--   kcu.column_name,
--   ccu.table_schema AS foreign_table_schema,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_schema = 'public'
--   AND tc.table_name = 'orders';
--
-- Expected:
-- - orders_user_id_fkey: user_id -> auth.users(id)
-- - orders_vendor_id_fkey: vendor_id -> auth.users(id)
-- - orders_product_id_fkey: product_id -> public.menu_items(id)
--
-- 2. Check RLS policies:
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'orders';
--
-- 3. Check column types:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'orders'
-- ORDER BY ordinal_position;







