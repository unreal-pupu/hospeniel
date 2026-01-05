-- Add metadata column to notifications table to store links and additional data
-- This allows notifications to link to service requests, orders, etc.

begin;

-- Add metadata column if it doesn't exist
alter table if exists public.notifications
  add column if not exists metadata jsonb;

-- Create index for metadata queries
create index if not exists idx_notifications_metadata on public.notifications using gin(metadata);

-- Add comment explaining metadata structure
comment on column public.notifications.metadata is 
  'JSON object storing additional notification data. For service requests: {"type": "service_request", "service_request_id": "uuid"}. For orders: {"type": "order", "order_id": "uuid"}.';

commit;

-- Verification query (run separately):
--
-- Check column exists:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'notifications'
--   AND column_name = 'metadata';





