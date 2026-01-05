-- Add RLS policies for admin access
-- Admins (is_admin = true) should be able to view and manage all data

begin;

-- ============================================
-- PROFILES TABLE - Admin Access
-- ============================================
-- NOTE: Profile policies are now handled by 20251105_fix_profiles_rls_recursion.sql
-- to avoid infinite recursion. The is_admin() security definer function is used
-- instead of directly querying the profiles table in policies.

-- Create helper function if it doesn't exist (used by other policies)
create or replace function is_admin(user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _is_admin boolean;
begin
  -- This query bypasses RLS because the function is security definer
  select coalesce(is_admin, false) into _is_admin
  from public.profiles
  where id = user_id;
  
  return coalesce(_is_admin, false);
end;
$$;

grant execute on function is_admin(uuid) to authenticated;
grant execute on function is_admin(uuid) to service_role;

-- Profiles policies are handled in 20251105_fix_profiles_rls_recursion.sql
-- to prevent infinite recursion. Do not recreate them here.

-- ============================================
-- VENDORS TABLE - Admin Access
-- ============================================

-- Policy: Admins can view all vendors (uses is_admin() function to avoid recursion)
drop policy if exists "Admins can view all vendors" on public.vendors;
create policy "Admins can view all vendors"
  on public.vendors
  for select
  to authenticated
  using (is_admin(auth.uid()));

-- Policy: Admins can update all vendors (uses is_admin() function to avoid recursion)
drop policy if exists "Admins can update all vendors" on public.vendors;
create policy "Admins can update all vendors"
  on public.vendors
  for update
  to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- ============================================
-- MENU_ITEMS TABLE - Admin Access
-- ============================================

-- Policy: Admins can view all menu items (uses is_admin() function)
drop policy if exists "Admins can view all menu items" on public.menu_items;
create policy "Admins can view all menu items"
  on public.menu_items
  for select
  to authenticated
  using (is_admin(auth.uid()));

-- Policy: Admins can update all menu items (uses is_admin() function)
drop policy if exists "Admins can update all menu items" on public.menu_items;
create policy "Admins can update all menu items"
  on public.menu_items
  for update
  to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- Policy: Admins can delete all menu items (uses is_admin() function)
drop policy if exists "Admins can delete all menu items" on public.menu_items;
create policy "Admins can delete all menu items"
  on public.menu_items
  for delete
  to authenticated
  using (is_admin(auth.uid()));

-- ============================================
-- ORDERS TABLE - Admin Access
-- ============================================

-- Policy: Admins can view all orders (uses is_admin() function)
drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders"
  on public.orders
  for select
  to authenticated
  using (is_admin(auth.uid()));

-- Policy: Admins can update all orders (uses is_admin() function)
drop policy if exists "Admins can update all orders" on public.orders;
create policy "Admins can update all orders"
  on public.orders
  for update
  to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- ============================================
-- PAYMENTS TABLE - Admin Access
-- ============================================

-- Policy: Admins can view all payments (uses is_admin() function)
drop policy if exists "Admins can view all payments" on public.payments;
create policy "Admins can view all payments"
  on public.payments
  for select
  to authenticated
  using (is_admin(auth.uid()));

-- Policy: Admins can update all payments (uses is_admin() function)
drop policy if exists "Admins can update all payments" on public.payments;
create policy "Admins can update all payments"
  on public.payments
  for update
  to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- ============================================
-- SERVICE_REQUESTS TABLE - Admin Access
-- ============================================

-- Policy: Admins can view all service requests (uses is_admin() function)
drop policy if exists "Admins can view all service requests" on public.service_requests;
create policy "Admins can view all service requests"
  on public.service_requests
  for select
  to authenticated
  using (is_admin(auth.uid()));

-- Policy: Admins can update all service requests (uses is_admin() function)
drop policy if exists "Admins can update all service requests" on public.service_requests;
create policy "Admins can update all service requests"
  on public.service_requests
  for update
  to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- ============================================
-- VENDOR_PAYOUTS TABLE - Admin Access
-- ============================================

-- Policy: Admins can view all vendor payouts (uses is_admin() function)
drop policy if exists "Admins can view all vendor payouts" on public.vendor_payouts;
create policy "Admins can view all vendor payouts"
  on public.vendor_payouts
  for select
  to authenticated
  using (is_admin(auth.uid()));

-- Policy: Admins can update all vendor payouts (uses is_admin() function)
drop policy if exists "Admins can update all vendor payouts" on public.vendor_payouts;
create policy "Admins can update all vendor payouts"
  on public.vendor_payouts
  for update
  to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- ============================================
-- NOTIFICATIONS TABLE - Admin Access
-- ============================================

-- Policy: Admins can view all notifications (uses is_admin() function)
drop policy if exists "Admins can view all notifications" on public.notifications;
create policy "Admins can view all notifications"
  on public.notifications
  for select
  to authenticated
  using (is_admin(auth.uid()));

-- Policy: Admins can insert notifications for any vendor (uses is_admin() function)
drop policy if exists "Admins can insert notifications" on public.notifications;
create policy "Admins can insert notifications"
  on public.notifications
  for insert
  to authenticated
  with check (is_admin(auth.uid()));

-- Policy: Admins can update all notifications (uses is_admin() function)
drop policy if exists "Admins can update all notifications" on public.notifications;
create policy "Admins can update all notifications"
  on public.notifications
  for update
  to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

commit;

-- Verification queries (run separately):
--
-- Check admin policies:
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND policyname LIKE '%Admin%'
-- ORDER BY tablename, policyname;
--
-- To set a user as admin:
-- UPDATE public.profiles SET is_admin = true WHERE id = 'USER_ID_HERE';

