-- Add payment_reference column to orders table
-- This migration adds support for linking orders to payment transactions

begin;

-- Add payment_reference column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'orders' 
    and column_name = 'payment_reference'
  ) then
    alter table public.orders 
      add column payment_reference text;
    raise notice 'Added payment_reference column to orders table';
  end if;
end $$;

-- Create index on payment_reference for faster lookups
create index if not exists idx_orders_payment_reference on public.orders(payment_reference);

-- Update status check constraint to include 'Paid' status
-- Drop existing constraint if it exists
alter table public.orders
  drop constraint if exists orders_status_check;

-- Add new constraint with 'Paid' status included
alter table public.orders
  add constraint orders_status_check
  check (status in ('Pending', 'Accepted', 'Confirmed', 'Rejected', 'Completed', 'Cancelled', 'Paid'));

commit;

-- Verification queries (run separately to confirm):
--
-- 1. Check if payment_reference column exists:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'orders'
--   AND column_name = 'payment_reference';
--
-- 2. Check the status constraint:
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name = 'orders_status_check';






