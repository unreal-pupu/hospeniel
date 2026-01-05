-- Add RLS policies for profiles table to allow users to update their own profile
-- This is required for subscription upgrades and profile updates
--
-- NOTE: This migration is kept for reference, but the actual policies are now
-- handled by 20251105_fix_profiles_rls_recursion.sql to avoid infinite recursion.
-- The fix migration creates a security definer function is_admin() that bypasses
-- RLS when checking admin status, preventing the recursion issue.

begin;

-- Ensure RLS is enabled on profiles table
alter table if exists public.profiles enable row level security;

-- Grant necessary permissions
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;

-- Policies are now created in 20251105_fix_profiles_rls_recursion.sql
-- to prevent infinite recursion issues.

commit;

-- Verification queries (run separately):
--
-- Check RLS policies:
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'profiles';
--
-- Check grants:
-- SELECT grantee, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' 
--   AND table_name = 'profiles'
--   AND grantee = 'authenticated';

