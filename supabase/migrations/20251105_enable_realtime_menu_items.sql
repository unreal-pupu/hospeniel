-- Enable real-time for menu_items table
-- This allows clients to subscribe to menu item updates in real-time

-- Add menu_items to the supabase_realtime publication
alter publication supabase_realtime add table public.menu_items;

-- Verification query (run separately to confirm):
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'menu_items';






