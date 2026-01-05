-- Enable real-time for payments table
-- This allows users and vendors to see payment status updates in real-time

-- Enable real-time for payments table
alter publication supabase_realtime add table public.payments;

-- Note: Real-time is enabled by default in Supabase, but we explicitly add the table
-- to ensure payment updates are broadcast in real-time to subscribed clients

-- Verification:
-- Check if real-time is enabled:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'payments';






