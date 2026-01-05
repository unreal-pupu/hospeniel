-- Update orders table status column to include Confirmed and Rejected
-- This migration expands the status options to support more order states
--
-- Current statuses: Pending, Accepted, Completed, Cancelled
-- New statuses: Pending, Accepted, Confirmed, Rejected, Completed, Cancelled

begin;

-- Step 1: Drop the existing check constraint
alter table public.orders
  drop constraint if exists orders_status_check;

-- Step 2: Add the new check constraint with expanded status options
alter table public.orders
  add constraint orders_status_check
  check (status in ('Pending', 'Accepted', 'Confirmed', 'Rejected', 'Completed', 'Cancelled'));

-- Step 3: Update the default status to remain 'Pending'
alter table public.orders
  alter column status set default 'Pending';

commit;

-- Verification queries (run separately):
--
-- 1. Check the constraint:
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name = 'orders_status_check';
--
-- 2. Verify current orders still have valid statuses:
-- SELECT status, count(*) 
-- FROM public.orders 
-- GROUP BY status;







