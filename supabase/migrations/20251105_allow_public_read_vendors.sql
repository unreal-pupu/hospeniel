-- Allow public read access to vendors table
-- This allows unauthenticated and authenticated users to view vendors
-- Required for the Explore page to display vendor information with menu items

begin;

-- Grant select permission to anon (public/unauthenticated) role
grant usage on schema public to anon;
grant select on public.vendors to anon;

-- Update the SELECT policy to allow both authenticated and public access
-- Drop the existing policy that only allows authenticated users
drop policy if exists "Anyone can view vendors" on public.vendors;
drop policy if exists "Public can view vendors" on public.vendors;

-- Create a policy that allows both authenticated and public (anon) users to view vendors
-- This allows anyone to browse vendors on the Explore page
create policy "Public can view vendors"
  on public.vendors
  for select
  to public
  using (true);

-- Keep the existing INSERT, UPDATE policies for authenticated users only
-- These remain unchanged from the previous migration

commit;

-- Verification queries (run separately to confirm):
--
-- 1. Check grants for anon role:
-- SELECT grantee, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' 
--   AND table_name = 'vendors'
--   AND grantee IN ('anon', 'authenticated');
--
-- 2. Check RLS policies:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'vendors';








