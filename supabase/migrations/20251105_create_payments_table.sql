-- Create payments table for tracking payment transactions
-- This table stores payment records for orders and links to auth.users
-- Payments are linked to orders via payment_reference (stored in both tables)
--
-- IMPORTANT: If you have existing payment data, back it up before running this migration.
-- This migration will drop and recreate the table to ensure clean schema.

begin;

-- Step 1: Drop existing table if it exists (to ensure clean schema)
-- This is safe for a new feature, but if you have existing data, back it up first
drop table if exists public.payments cascade;

-- Step 2: Create payments table with all required columns
create table public.payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'cancelled')),
  payment_reference text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Foreign key constraint to auth.users
  constraint payments_user_id_fkey 
    foreign key (user_id) 
    references auth.users(id) 
    on delete cascade
);

-- Step 3: Create indexes for better query performance
create index idx_payments_user_id on public.payments(user_id);
create index idx_payments_status on public.payments(status);
create index idx_payments_payment_reference on public.payments(payment_reference);
create index idx_payments_created_at on public.payments(created_at desc);

-- Step 4: Create function to update updated_at timestamp
create or replace function update_payments_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Step 5: Create trigger to automatically update updated_at
create trigger update_payments_updated_at
  before update on public.payments
  for each row
  execute function update_payments_updated_at();

-- Step 6: Grant schema permissions
grant usage on schema public to authenticated;

-- Step 7: Grant table permissions to authenticated role
grant select, insert, update on public.payments to authenticated;

-- Step 8: Enable Row Level Security
alter table public.payments enable row level security;

-- Step 9: Create RLS policies
-- Policy 1: Users can view their own payments
create policy "Users can view own payments"
  on public.payments
  for select
  to authenticated
  using (user_id = auth.uid());

-- Policy 2: Users can insert their own payments
create policy "Users can insert own payments"
  on public.payments
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Policy 3: Users can update their own payments
create policy "Users can update own payments"
  on public.payments
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;

-- ============================================================================
-- HOW PAYMENTS LINK TO ORDERS
-- ============================================================================
-- Payments are linked to orders via the payment_reference field:
-- 1. When a payment is created, it gets a unique payment_reference
-- 2. When orders are created after payment, they get the same payment_reference
-- 3. To find all orders for a payment:
--    SELECT * FROM orders WHERE payment_reference = 'payment_ref_123';
-- 4. To find the payment for an order:
--    SELECT * FROM payments WHERE payment_reference = (SELECT payment_reference FROM orders WHERE id = 'order_id');
--
-- This allows one payment to pay for multiple orders (multi-vendor scenario)

-- ============================================================================
-- VERIFICATION QUERIES (run separately to confirm)
-- ============================================================================
--
-- 1. Check table structure:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'payments'
-- ORDER BY ordinal_position;
--
-- 2. Check foreign key constraints:
-- SELECT 
--   tc.constraint_name, 
--   tc.table_name, 
--   kcu.column_name, 
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name 
-- FROM information_schema.table_constraints AS tc 
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY' 
--   AND tc.table_name = 'payments';
--
-- 3. Check RLS policies:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'payments';
--
-- 4. Check indexes:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'payments'
--   AND schemaname = 'public';
--
-- 5. Test insert (as authenticated user):
-- INSERT INTO public.payments (user_id, total_amount, status, payment_reference)
-- VALUES (auth.uid(), 1000.00, 'pending', 'test_ref_123');
--
-- 6. Verify RLS works (should only see your own payments):
-- SELECT * FROM public.payments;
--
-- 7. Link payment to orders (example query):
-- UPDATE public.orders 
-- SET payment_reference = 'test_ref_123'
-- WHERE user_id = auth.uid() AND status = 'Pending';
--
-- 8. Find all orders for a payment:
-- SELECT o.*, p.total_amount, p.status as payment_status
-- FROM public.orders o
-- JOIN public.payments p ON o.payment_reference = p.payment_reference
-- WHERE p.id = 'payment_id_here';
