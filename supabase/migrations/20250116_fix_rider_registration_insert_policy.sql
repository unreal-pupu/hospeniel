-- Fix RLS policy to allow INSERT for new user registrations
-- This ensures riders (and all users) can insert their own profile during registration
-- Note: The registration API uses service_role which bypasses RLS, but this policy
-- ensures consistency and allows direct inserts if needed

begin;

-- Drop existing INSERT policy if it exists
drop policy if exists "Users can insert own profile" on public.profiles;

-- Create INSERT policy that allows users to insert their own profile
-- This is needed for registration flow
-- The policy checks that the id matches auth.uid() to ensure users can only create their own profile
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- Also ensure service_role has INSERT permission (should already have it, but ensure)
grant insert on public.profiles to service_role;

commit;

-- Verification queries (run separately):
--
-- Check INSERT policy exists:
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'profiles'
--   AND cmd = 'INSERT';
--
-- Check service_role grants:
-- SELECT grantee, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' 
--   AND table_name = 'profiles'
--   AND grantee = 'service_role';






