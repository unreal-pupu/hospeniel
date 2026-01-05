-- Setup RLS and grants for vendors and menu_items tables
-- This allows users to browse vendors/menus, and vendors to manage their own data

begin;

-- ============================================
-- VENDORS TABLE SETUP
-- ============================================

-- Step 1: Ensure profile_id column exists (add if missing)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'profile_id'
  ) then
    alter table public.vendors 
      add column profile_id uuid references auth.users(id);
    raise notice 'Added profile_id column to vendors table';
  end if;
end $$;

-- Grant permissions to authenticated role
grant usage on schema public to authenticated;
grant select, insert, update on public.vendors to authenticated;

-- Enable RLS
alter table if exists public.vendors enable row level security;

-- Drop existing policies if any
drop policy if exists "Anyone can view vendors" on public.vendors;
drop policy if exists "Vendors can update own record" on public.vendors;
drop policy if exists "Vendors can insert own record" on public.vendors;

-- Policy 1: Anyone authenticated can view all vendors (public listing)
create policy "Anyone can view vendors"
  on public.vendors
  for select
  to authenticated
  using (true);

-- Policy 2: Vendors can insert their own vendor record
create policy "Vendors can insert own record"
  on public.vendors
  for insert
  to authenticated
  with check (profile_id = auth.uid());

-- Policy 3: Vendors can only update their own vendor record
-- profile_id links to auth.users(id) which equals auth.uid()
create policy "Vendors can update own record"
  on public.vendors
  for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ============================================
-- MENU_ITEMS TABLE SETUP
-- ============================================

-- Grant permissions to authenticated role
grant select, insert, update, delete on public.menu_items to authenticated;

-- Enable RLS
alter table if exists public.menu_items enable row level security;

-- Drop existing policies if any
drop policy if exists "Anyone can view menu items" on public.menu_items;
drop policy if exists "Vendors can manage own menu items" on public.menu_items;

-- Policy 1: Anyone authenticated can view all menu items
create policy "Anyone can view menu items"
  on public.menu_items
  for select
  to authenticated
  using (true);

-- Policy 2: Vendors can insert, update, and delete their own menu items
create policy "Vendors can manage own menu items"
  on public.menu_items
  for all
  to authenticated
  using (
    -- Check if the vendor_id matches the authenticated user's id
    vendor_id = auth.uid()
  )
  with check (
    vendor_id = auth.uid()
  );

commit;

-- Verification queries (run separately):
--
-- Check vendors grants:
-- SELECT grantee, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' 
--   AND table_name = 'vendors'
--   AND grantee = 'authenticated';
--
-- Check menu_items grants:
-- SELECT grantee, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' 
--   AND table_name = 'menu_items'
--   AND grantee = 'authenticated';
--
-- Check RLS policies:
-- SELECT tablename, policyname, cmd 
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename IN ('vendors', 'menu_items');

