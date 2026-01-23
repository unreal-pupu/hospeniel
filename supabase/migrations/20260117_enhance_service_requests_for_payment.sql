-- Enhance service_requests table to support price confirmation and payment
-- Add fields for price, payment tracking, and extended status workflow

begin;

-- Add new columns to service_requests table
alter table if exists public.service_requests
  add column if not exists final_price numeric(10, 2),
  add column if not exists price_confirmed boolean default false not null,
  add column if not exists payment_reference text,
  add column if not exists payment_method text check (payment_method in ('paystack', 'cash', 'other')),
  add column if not exists paid_at timestamp with time zone,
  add column if not exists completed_at timestamp with time zone;

-- Update status check constraint to include new statuses
alter table if exists public.service_requests
  drop constraint if exists service_requests_status_check;

alter table if exists public.service_requests
  add constraint service_requests_status_check
  check (status in ('New', 'Viewed', 'Responded', 'Price_Confirmed', 'Paid', 'Completed', 'Cancelled'));

-- Create index for payment reference
create index if not exists idx_service_requests_payment_reference on public.service_requests(payment_reference);

-- Create index for status filtering
create index if not exists idx_service_requests_status_enhanced on public.service_requests(status) where status in ('New', 'Responded', 'Price_Confirmed', 'Paid');

-- Rename service_request_replies to service_request_messages for clarity
-- (Actually, we'll keep the existing table name but ensure it supports multi-message conversations)
-- The existing table already supports this, so we just need to ensure it's being used correctly

commit;
