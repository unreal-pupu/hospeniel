-- Grant necessary permissions to authenticated role for user_settings table
-- This is required even with RLS policies

begin;

-- Grant USAGE on the schema (if not already granted)
grant usage on schema public to authenticated;

-- Grant SELECT, INSERT, UPDATE on user_settings table to authenticated role
grant select, insert, update on public.user_settings to authenticated;

-- If the table has a sequence (for auto-incrementing IDs), grant usage on it
-- Note: This is only needed if user_settings has a serial/bigserial id column
-- Uncomment if needed:
-- grant usage, select on sequence public.user_settings_id_seq to authenticated;

commit;

-- Verify grants (run separately to check):
-- SELECT grantee, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' 
--   AND table_name = 'user_settings'
--   AND grantee = 'authenticated';
































