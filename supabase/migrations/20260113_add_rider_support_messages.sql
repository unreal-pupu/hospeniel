-- Add 'rider' role support to support_messages table
-- This allows riders to send support messages to admin

BEGIN;

-- Step 1: Drop the existing CHECK constraint on sender_role
ALTER TABLE support_messages 
  DROP CONSTRAINT IF EXISTS support_messages_sender_role_check;

-- Step 2: Add new CHECK constraint that includes 'rider'
ALTER TABLE support_messages 
  ADD CONSTRAINT support_messages_sender_role_check 
  CHECK (sender_role IN ('user', 'vendor', 'rider'));

-- Step 3: Drop existing RLS policies that need to be updated
DROP POLICY IF EXISTS "Users and vendors can view their own messages" ON support_messages;
DROP POLICY IF EXISTS "Users and vendors can insert their own messages" ON support_messages;

-- Step 4: Recreate policy to allow users, vendors, and riders to view their own messages
CREATE POLICY "Users, vendors, and riders can view their own messages"
  ON support_messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id
  );

-- Step 5: Recreate policy to allow users, vendors, and riders to insert their own messages
CREATE POLICY "Users, vendors, and riders can insert their own messages"
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
      )) OR
      (sender_role = 'rider' AND EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'rider'
      ))
    )
  );

COMMIT;
