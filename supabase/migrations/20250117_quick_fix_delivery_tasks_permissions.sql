-- QUICK FIX: Grant permissions to service_role for delivery_tasks
-- Run this in Supabase SQL Editor if you're getting permission denied errors
-- This is a simplified version that fixes the immediate issue

-- Grant all privileges to service_role (this allows API routes to bypass RLS)
GRANT ALL PRIVILEGES ON TABLE public.delivery_tasks TO service_role;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant to authenticated role for direct client access
GRANT SELECT, INSERT, UPDATE ON TABLE public.delivery_tasks TO authenticated;

-- Verify RLS is enabled
ALTER TABLE public.delivery_tasks ENABLE ROW LEVEL SECURITY;

-- Verify the grants worked
-- Run this query to check:
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public' 
--   AND table_name = 'delivery_tasks'
--   AND grantee IN ('service_role', 'authenticated');



