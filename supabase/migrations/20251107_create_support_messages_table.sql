-- Create support_messages table for Help Center messaging system
BEGIN;

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'vendor')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'read', 'responded')),
  response TEXT,
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_support_messages_sender_id ON support_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_status ON support_messages(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender_role ON support_messages(sender_role);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_support_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_support_messages_updated_at
  BEFORE UPDATE ON support_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_support_messages_updated_at();

-- Grant schema usage first
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant table permissions to authenticated role
GRANT SELECT, INSERT, UPDATE ON support_messages TO authenticated;

-- Grant table permissions to service_role (for API routes)
GRANT ALL ON support_messages TO service_role;

-- Enable Row Level Security
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users and vendors can view their own messages" ON support_messages;
DROP POLICY IF EXISTS "Users and vendors can insert their own messages" ON support_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON support_messages;
DROP POLICY IF EXISTS "Admins can update messages" ON support_messages;

-- RLS Policy: Users and vendors can only see their own messages
CREATE POLICY "Users and vendors can view their own messages"
  ON support_messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id
  );

-- RLS Policy: Users and vendors can insert their own messages
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

-- RLS Policy: Admins can view all messages
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

-- RLS Policy: Admins can update messages (for responses)
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

-- Enable Realtime for support_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;

-- Create function to notify users when admin responds
CREATE OR REPLACE FUNCTION notify_support_message_response()
RETURNS TRIGGER AS $$
BEGIN
  -- Only send notification if response was added and status changed to 'responded'
  IF NEW.response IS NOT NULL AND (OLD.response IS NULL OR OLD.response != NEW.response) AND NEW.status = 'responded' THEN
    -- Insert notification for the sender
    -- For users: use user_id, for vendors: use vendor_id
    IF NEW.sender_role = 'user' THEN
      INSERT INTO notifications (
        user_id,
        type,
        message,
        read,
        created_at
      ) VALUES (
        NEW.sender_id,
        'system',
        'You have received a response to your support message: ' || LEFT(NEW.message, 50) || '...',
        false,
        NOW()
      );
    ELSE
      INSERT INTO notifications (
        vendor_id,
        type,
        message,
        read,
        created_at
      ) VALUES (
        NEW.sender_id,
        'system',
        'You have received a response to your support message: ' || LEFT(NEW.message, 50) || '...',
        false,
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to notify on response
CREATE TRIGGER notify_support_message_response_trigger
  AFTER UPDATE ON support_messages
  FOR EACH ROW
  WHEN (NEW.response IS NOT NULL AND (OLD.response IS NULL OR OLD.response != NEW.response))
  EXECUTE FUNCTION notify_support_message_response();

-- Create function to notify admin when new message is received
CREATE OR REPLACE FUNCTION notify_admin_new_support_message()
RETURNS TRIGGER AS $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Notify all admin users (using vendor_id for admin notifications based on existing structure)
  FOR admin_user_id IN 
    SELECT id FROM profiles WHERE is_admin = true
  LOOP
    INSERT INTO notifications (
      vendor_id,
      type,
      message,
      read,
      created_at
    ) VALUES (
      admin_user_id,
      'system',
      'New support message from ' || NEW.sender_role || ': ' || LEFT(NEW.message, 50) || '...',
      false,
      NOW()
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to notify admin on new message
CREATE TRIGGER notify_admin_new_support_message_trigger
  AFTER INSERT ON support_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_new_support_message();

COMMIT;

-- Note: Permissions are granted above within the transaction
-- The service_role has ALL permissions and bypasses RLS
-- The authenticated role has SELECT, INSERT, UPDATE with RLS policies applied
