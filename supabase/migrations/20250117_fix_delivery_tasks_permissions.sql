-- Fix delivery_tasks table permissions for service role and authenticated users
-- This ensures the service role can insert delivery tasks and RLS policies work correctly

begin;

-- ============================================
-- 1. Grant permissions to service_role (bypasses RLS)
-- ============================================

-- CRITICAL: Service role must have explicit grants to bypass RLS
-- Even though service_role bypasses RLS, it still needs table-level grants

-- Grant schema usage
grant usage on schema public to service_role;

-- Grant all privileges on delivery_tasks table to service_role
grant all privileges on table public.delivery_tasks to service_role;

-- Also grant on sequences if they exist
grant usage, select on all sequences in schema public to service_role;

-- Ensure the table is accessible
alter table if exists public.delivery_tasks owner to postgres;

-- ============================================
-- 2. Grant permissions to authenticated role
-- ============================================

-- Ensure authenticated role has necessary permissions
grant usage on schema public to authenticated;
grant select, insert, update on public.delivery_tasks to authenticated;

-- ============================================
-- 3. Ensure RLS is enabled and policies exist
-- ============================================

-- Enable RLS on delivery_tasks table
alter table if exists public.delivery_tasks enable row level security;

-- Verify policies exist and recreate if needed
do $$
begin
  -- Check if insert policy exists for vendors
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'delivery_tasks'
    and policyname = 'Vendors can create delivery tasks'
  ) then
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
    
    raise notice 'Created "Vendors can create delivery tasks" policy';
  else
    raise notice 'Policy "Vendors can create delivery tasks" already exists';
  end if;

  -- Check if select policy exists for vendors
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'delivery_tasks'
    and policyname = 'Vendors can view own delivery tasks'
  ) then
    create policy "Vendors can view own delivery tasks"
      on public.delivery_tasks
      for select
      to authenticated
      using (vendor_id = auth.uid());
    
    raise notice 'Created "Vendors can view own delivery tasks" policy';
  else
    raise notice 'Policy "Vendors can view own delivery tasks" already exists';
  end if;

  -- Check if update policy exists for vendors
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'delivery_tasks'
    and policyname = 'Vendors can update own delivery tasks'
  ) then
    create policy "Vendors can update own delivery tasks"
      on public.delivery_tasks
      for update
      to authenticated
      using (vendor_id = auth.uid())
      with check (vendor_id = auth.uid());
    
    raise notice 'Created "Vendors can update own delivery tasks" policy';
  else
    raise notice 'Policy "Vendors can update own delivery tasks" already exists';
  end if;

  -- Check if select policy exists for riders (pending)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'delivery_tasks'
    and policyname = 'Riders can view pending delivery tasks'
  ) then
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
    
    raise notice 'Created "Riders can view pending delivery tasks" policy';
  else
    raise notice 'Policy "Riders can view pending delivery tasks" already exists';
  end if;

  -- Check if select policy exists for riders (assigned)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'delivery_tasks'
    and policyname = 'Riders can view assigned delivery tasks'
  ) then
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
    
    raise notice 'Created "Riders can view assigned delivery tasks" policy';
  else
    raise notice 'Policy "Riders can view assigned delivery tasks" already exists';
  end if;

  -- Check if update policy exists for riders (accept)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'delivery_tasks'
    and policyname = 'Riders can accept delivery tasks'
  ) then
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
    
    raise notice 'Created "Riders can accept delivery tasks" policy';
  else
    raise notice 'Policy "Riders can accept delivery tasks" already exists';
  end if;

  -- Check if update policy exists for riders (update assigned)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'delivery_tasks'
    and policyname = 'Riders can update assigned delivery tasks'
  ) then
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
    
    raise notice 'Created "Riders can update assigned delivery tasks" policy';
  else
    raise notice 'Policy "Riders can update assigned delivery tasks" already exists';
  end if;

  -- Check if select policy exists for customers
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'delivery_tasks'
    and policyname = 'Customers can view delivery status for their orders'
  ) then
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
    
    raise notice 'Created "Customers can view delivery status for their orders" policy';
  else
    raise notice 'Policy "Customers can view delivery status for their orders" already exists';
  end if;

  -- Check if select policy exists for admins
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'delivery_tasks'
    and policyname = 'Admins can view all delivery tasks'
  ) then
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
    
    raise notice 'Created "Admins can view all delivery tasks" policy';
  else
    raise notice 'Policy "Admins can view all delivery tasks" already exists';
  end if;

end $$;

commit;

-- Verification queries (run separately to confirm):
--
-- 1. Check table permissions:
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public' 
--   AND table_name = 'delivery_tasks';
--
-- Expected: service_role should have ALL privileges, authenticated should have SELECT, INSERT, UPDATE
--
-- 2. Check RLS policies:
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'delivery_tasks';
--
-- 3. Test service role access:
-- -- This should work (service role bypasses RLS)
-- SET ROLE service_role;
-- INSERT INTO delivery_tasks (order_id, vendor_id, pickup_address, delivery_address, status)
-- VALUES ('test-order-id', 'test-vendor-id', 'Test Pickup', 'Test Delivery', 'Pending');
-- RESET ROLE;


