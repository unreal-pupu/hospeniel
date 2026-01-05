-- Enable realtime for notifications table
-- This allows clients to subscribe to notification changes in real-time

begin;

-- Enable realtime publication for notifications table
alter publication supabase_realtime add table public.notifications;

commit;

-- Verification query (run separately):
--
-- Check if realtime is enabled:
-- SELECT schemaname, tablename 
-- FROM pg_publication_tables 
-- WHERE pubname = 'supabase_realtime' 
--   AND tablename = 'notifications';





