-- Allow public read access to menu_items table
-- This allows unauthenticated and authenticated users to view menu items
-- Required for the Explore page to display menu items

begin;

-- Grant select permission to anon (public/unauthenticated) role
grant usage on schema public to anon;
grant select on public.menu_items to anon;

-- Update the SELECT policy to allow both authenticated and public access
-- Drop the existing policy that only allows authenticated users
drop policy if exists "Anyone can view menu items" on public.menu_items;
drop policy if exists "Public can view menu items" on public.menu_items;

-- Create a policy that allows both authenticated and public (anon) users to view menu items
-- This allows anyone to browse menu items on the Explore page
create policy "Public can view menu items"
  on public.menu_items
  for select
  to public
  using (true);

-- Keep the existing INSERT, UPDATE, DELETE policies for authenticated users only
-- These remain unchanged from the previous migration

commit;

-- Verification queries (run separately to confirm):
--
-- 1. Check grants for anon role:
-- SELECT grantee, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' 
--   AND table_name = 'menu_items'
--   AND grantee IN ('anon', 'authenticated');
--
-- 2. Check RLS policies:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'menu_items';
--
-- 3. Test public access (should work without authentication):
-- SELECT * FROM public.menu_items LIMIT 5;








