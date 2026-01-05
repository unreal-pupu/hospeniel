-- Enable realtime for service_requests table
-- This allows vendors to receive real-time updates when new requests arrive

begin;

-- Enable realtime publication for service_requests table
alter publication supabase_realtime add table public.service_requests;

commit;

-- Verification query (run separately):
--
-- Check if realtime is enabled:
-- SELECT schemaname, tablename 
-- FROM pg_publication_tables 
-- WHERE pubname = 'supabase_realtime' 
--   AND tablename = 'service_requests';





