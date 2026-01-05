-- Fix permissions for support_messages table
-- This migration fixes permission issues for the support_messages table

BEGIN;

-- Step 1: Ensure schema usage is granted
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Step 2: Grant table permissions to authenticated role
GRANT SELECT, INSERT, UPDATE ON support_messages TO authenticated;

-- Step 3: Grant ALL permissions to service_role (bypasses RLS)
GRANT ALL ON support_messages TO service_role;

-- Step 4: Ensure RLS is enabled (it should already be)
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Users and vendors can view their own messages" ON support_messages;
DROP POLICY IF EXISTS "Users and vendors can insert their own messages" ON support_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON support_messages;
DROP POLICY IF EXISTS "Admins can update messages" ON support_messages;

-- Policy 1: Users and vendors can view their own messages
CREATE POLICY "Users and vendors can view their own messages"
  ON support_messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id
  );

-- Policy 2: Users and vendors can insert their own messages
CREATE POLICY "Users and vendors can insert their own messages"
  ON support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    (
      (sender_role = 'user' AND EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'user'
      )) OR
      (sender_role = 'vendor' AND EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'vendor'
      ))
    )
  );

-- Policy 3: Admins can view all messages
CREATE POLICY "Admins can view all messages"
  ON support_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Policy 4: Admins can update messages (for responses)
CREATE POLICY "Admins can update messages"
  ON support_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

COMMIT;

-- Verification queries (run separately to confirm):
-- 
-- 1. Check grants:
-- SELECT grantee, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' 
--   AND table_name = 'support_messages';
--
-- 2. Check RLS policies:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND table_name = 'support_messages';




