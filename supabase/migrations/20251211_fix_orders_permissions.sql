-- Fix orders table permissions for service role and authenticated users
-- This ensures the service role can insert orders and RLS policies work correctly

begin;

-- ============================================
-- 1. Grant permissions to service_role (bypasses RLS)
-- ============================================

-- Grant all permissions to service_role on orders table
-- service_role bypasses RLS, so it needs explicit table permissions
grant usage on schema public to service_role;
grant all on public.orders to service_role;
grant all on public.notifications to service_role;

-- Also grant on sequences if they exist
grant usage, select on all sequences in schema public to service_role;

-- ============================================
-- 2. Grant permissions to authenticated role
-- ============================================

-- Ensure authenticated role has necessary permissions
grant usage on schema public to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, insert, update on public.notifications to authenticated;

-- ============================================
-- 3. Ensure RLS is enabled and policies exist
-- ============================================

-- Enable RLS on orders table
alter table if exists public.orders enable row level security;

-- Enable RLS on notifications table
alter table if exists public.notifications enable row level security;

-- Drop existing policies to recreate them cleanly
drop policy if exists "Users can create orders" on public.orders;
drop policy if exists "Users can view own orders" on public.orders;
drop policy if exists "Vendors can view own orders" on public.orders;
drop policy if exists "Users can update own orders" on public.orders;
drop policy if exists "Vendors can update own orders" on public.orders;

-- Policy 1: Users can create orders (insert)
create policy "Users can create orders"
  on public.orders
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Policy 2: Users can view their own orders
create policy "Users can view own orders"
  on public.orders
  for select
  to authenticated
  using (user_id = auth.uid());

-- Policy 3: Vendors can view orders for their products
create policy "Vendors can view own orders"
  on public.orders
  for select
  to authenticated
  using (vendor_id = auth.uid());

-- Policy 4: Users can update their own orders (for cancellation, etc.)
create policy "Users can update own orders"
  on public.orders
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Policy 5: Vendors can update orders for their products (accept/reject)
create policy "Vendors can update own orders"
  on public.orders
  for update
  to authenticated
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

-- ============================================
-- 4. Ensure notifications RLS policies exist
-- ============================================

-- Drop existing notification policies
drop policy if exists "Users can view own notifications" on public.notifications;
drop policy if exists "Vendors can view own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Vendors can update own notifications" on public.notifications;
drop policy if exists "Service can create notifications" on public.notifications;

-- Policy 1: Users can view their own notifications
create policy "Users can view own notifications"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

-- Policy 2: Vendors can view their own notifications
create policy "Vendors can view own notifications"
  on public.notifications
  for select
  to authenticated
  using (vendor_id = auth.uid());

-- Policy 3: Users can update their own notifications
create policy "Users can update own notifications"
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Policy 4: Vendors can update their own notifications
create policy "Vendors can update own notifications"
  on public.notifications
  for update
  to authenticated
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

-- Policy 5: Service role can create notifications (for triggers)
-- Note: service_role bypasses RLS, but this is explicit for clarity
-- The trigger functions use SECURITY DEFINER which runs as the function owner
-- So we need to ensure the function owner has permissions

-- ============================================
-- 5. Verify trigger function ownership and permissions
-- ============================================

-- Ensure the notification trigger function has the right permissions
-- The function should be owned by a role that has INSERT permissions
-- Typically this is the postgres superuser or service_role

-- Grant execute permission on the function to authenticated users
grant execute on function public.notify_vendor_new_order() to authenticated;
grant execute on function public.notify_vendor_new_order() to service_role;

-- If other notification functions exist, grant them too
do $$
begin
  -- Grant execute on all notification functions
  if exists (select 1 from pg_proc where proname = 'notify_user_order_update') then
    grant execute on function public.notify_user_order_update() to authenticated;
    grant execute on function public.notify_user_order_update() to service_role;
  end if;
  
  if exists (select 1 from pg_proc where proname = 'notify_payment_success') then
    grant execute on function public.notify_payment_success() to authenticated;
    grant execute on function public.notify_payment_success() to service_role;
  end if;
end $$;

commit;

-- Verification queries (run separately):
--
-- 1. Check service_role permissions:
-- SELECT grantee, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' 
--   AND table_name = 'orders'
--   AND grantee = 'service_role';
--
-- 2. Check authenticated role permissions:
-- SELECT grantee, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' 
--   AND table_name = 'orders'
--   AND grantee = 'authenticated';
--
-- 3. Check RLS policies:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'orders';
--
-- 4. Test service role insert (should work):
-- -- This should work from the API route using service_role key
-- INSERT INTO public.orders (user_id, vendor_id, product_id, quantity, total_price, status, payment_reference)
-- VALUES (
--   'test-user-id',
--   'test-vendor-id',
--   'test-product-id',
--   1,
--   1000.00,
--   'Paid',
--   'test-ref-123'
-- );

















