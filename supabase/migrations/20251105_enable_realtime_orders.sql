-- Enable real-time for orders table
-- This allows vendors to see order updates in real-time

-- Enable real-time for orders table
alter publication supabase_realtime add table public.orders;

-- Note: Real-time is enabled by default in Supabase, but we explicitly add the table
-- to ensure order updates are broadcast in real-time to subscribed clients

-- Verification:
-- Check if real-time is enabled:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders';








