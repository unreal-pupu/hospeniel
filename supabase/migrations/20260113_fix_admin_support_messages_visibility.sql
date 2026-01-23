-- Fix admin visibility of support messages
-- This ensures admins can see all messages from users, vendors, and riders

BEGIN;

-- Step 1: Ensure the admin policy exists and is correct
DROP POLICY IF EXISTS "Admins can view all messages" ON support_messages;

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

-- Step 2: Verify the CHECK constraint includes 'rider'
-- Drop and recreate to ensure it's correct
ALTER TABLE support_messages 
  DROP CONSTRAINT IF EXISTS support_messages_sender_role_check;

ALTER TABLE support_messages 
  ADD CONSTRAINT support_messages_sender_role_check 
  CHECK (sender_role IN ('user', 'vendor', 'rider'));

-- Step 3: Ensure service_role has all permissions (bypasses RLS)
GRANT ALL ON support_messages TO service_role;

COMMIT;

-- Verification query (run separately to confirm):
-- 
-- 1. Check that admin policy exists:
-- SELECT policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'support_messages'
--   AND policyname = 'Admins can view all messages';
--
-- 2. Check CHECK constraint:
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'support_messages'::regclass 
--   AND conname = 'support_messages_sender_role_check';
--
-- Expected: CHECK (sender_role IN ('user', 'vendor', 'rider'))
--
-- 3. Test: Insert a test message as rider (should work)
-- 4. Test: Query as admin (should see all messages)
