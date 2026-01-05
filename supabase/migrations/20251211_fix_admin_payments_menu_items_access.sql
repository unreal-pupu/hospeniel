-- Fix admin access to payments and menu_items tables
-- This migration ensures admin users and service role can access these tables

begin;

-- ============================================
-- PAYMENTS TABLE - Ensure Service Role Access
-- ============================================

-- Grant full access to service_role (bypasses RLS)
grant all on public.payments to service_role;

-- Ensure authenticated role has select permission (already granted, but ensure it exists)
grant select, insert, update on public.payments to authenticated;

-- Add admin policy for payments if it doesn't exist
-- This allows admins to view all payments through authenticated role
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'payments' 
    and policyname = 'Admins can view all payments'
  ) then
    create policy "Admins can view all payments"
      on public.payments
      for select
      to authenticated
      using (is_admin(auth.uid()));
  end if;
end $$;

-- ============================================
-- MENU_ITEMS TABLE - Ensure Service Role Access
-- ============================================

-- Grant full access to service_role (bypasses RLS)
grant all on public.menu_items to service_role;

-- Ensure authenticated role has select permission
grant select, insert, update, delete on public.menu_items to authenticated;

-- Add admin policy for menu_items if it doesn't exist
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'menu_items' 
    and policyname = 'Admins can view all menu items'
  ) then
    create policy "Admins can view all menu items"
      on public.menu_items
      for select
      to authenticated
      using (is_admin(auth.uid()));
  end if;
end $$;

-- ============================================
-- ORDERS TABLE - Ensure Service Role Access
-- ============================================

-- Grant full access to service_role (bypasses RLS)
grant all on public.orders to service_role;

-- Ensure authenticated role has select permission
grant select, insert, update, delete on public.orders to authenticated;

-- Add admin policy for orders if it doesn't exist
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'orders' 
    and policyname = 'Admins can view all orders'
  ) then
    create policy "Admins can view all orders"
      on public.orders
      for select
      to authenticated
      using (is_admin(auth.uid()));
  end if;
end $$;

-- ============================================
-- PROFILES TABLE - Ensure Service Role Access
-- ============================================

-- Grant full access to service_role (bypasses RLS)
grant all on public.profiles to service_role;

-- ============================================
-- VENDORS TABLE - Ensure Service Role Access
-- ============================================

-- Grant full access to service_role (bypasses RLS)
grant all on public.vendors to service_role;

commit;

-- Verification queries (run separately):
--
-- 1. Check service_role grants:
-- SELECT grantee, privilege_type, table_name
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' 
--   AND grantee = 'service_role'
--   AND table_name IN ('payments', 'menu_items', 'orders', 'profiles', 'vendors')
-- ORDER BY table_name, privilege_type;
--
-- 2. Check admin policies:
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('payments', 'menu_items', 'orders')
--   AND policyname LIKE '%Admin%'
-- ORDER BY tablename, policyname;
--
-- 3. Verify admin user exists and has is_admin = true:
-- SELECT id, name, email, is_admin
-- FROM public.profiles
-- WHERE is_admin = true;




