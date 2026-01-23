-- Fix RLS policies for menu_items table
-- This ensures vendors can properly insert, update, and delete their own menu items
-- Separate policies for better clarity and reliability

begin;

-- Ensure menu_items table has the necessary columns
do $$
begin
  -- Ensure vendor_id column exists
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'menu_items' 
    and column_name = 'vendor_id'
  ) then
    alter table public.menu_items 
      add column vendor_id uuid references auth.users(id) on delete cascade not null;
    raise notice 'Added vendor_id column to menu_items table';
  end if;
end $$;

-- Grant permissions to authenticated role (if not already granted)
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.menu_items to authenticated;

-- Enable RLS (if not already enabled)
alter table if exists public.menu_items enable row level security;

-- Drop existing policies to recreate them cleanly
drop policy if exists "Anyone can view menu items" on public.menu_items;
drop policy if exists "Vendors can manage own menu items" on public.menu_items;
drop policy if exists "Vendors can insert own menu items" on public.menu_items;
drop policy if exists "Vendors can update own menu items" on public.menu_items;
drop policy if exists "Vendors can delete own menu items" on public.menu_items;

-- Policy 1: Anyone authenticated can view all menu items (for browsing)
create policy "Anyone can view menu items"
  on public.menu_items
  for select
  to authenticated
  using (true);

-- Policy 2: Vendors can insert their own menu items
-- The with check ensures vendor_id matches the authenticated user's id
create policy "Vendors can insert own menu items"
  on public.menu_items
  for insert
  to authenticated
  with check (vendor_id = auth.uid());

-- Policy 3: Vendors can update their own menu items
create policy "Vendors can update own menu items"
  on public.menu_items
  for update
  to authenticated
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

-- Policy 4: Vendors can delete their own menu items
create policy "Vendors can delete own menu items"
  on public.menu_items
  for delete
  to authenticated
  using (vendor_id = auth.uid());

commit;

-- Verification queries (run separately to confirm):
--
-- 1. Check grants:
-- SELECT grantee, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' 
--   AND table_name = 'menu_items'
--   AND grantee = 'authenticated';
--
-- 2. Check RLS policies:
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'menu_items';
--
-- 3. Test insert (replace with actual user ID):
-- INSERT INTO public.menu_items (name, description, price, vendor_id, availability)
-- VALUES ('Test Item', 'Test Description', 1000.00, auth.uid(), 'available');


























