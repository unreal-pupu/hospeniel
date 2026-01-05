-- Create vendor_payouts table for tracking vendor payouts
-- This table stores payout records that link to payments and vendors

begin;

-- Create vendor_payouts table
create table if not exists public.vendor_payouts (
  id uuid default gen_random_uuid() primary key,
  vendor_id uuid not null references public.profiles(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  payout_amount numeric(10, 2) not null check (payout_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  payout_reference text, -- For tracking Paystack transfer reference
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone
);

-- Create indexes for better query performance
create index if not exists idx_vendor_payouts_vendor_id on public.vendor_payouts(vendor_id);
create index if not exists idx_vendor_payouts_payment_id on public.vendor_payouts(payment_id);
create index if not exists idx_vendor_payouts_order_id on public.vendor_payouts(order_id);
create index if not exists idx_vendor_payouts_status on public.vendor_payouts(status);
create index if not exists idx_vendor_payouts_created_at on public.vendor_payouts(created_at desc);
create index if not exists idx_vendor_payouts_vendor_status on public.vendor_payouts(vendor_id, status) where status = 'pending';

-- Create function to update updated_at timestamp
create or replace function update_vendor_payouts_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
drop trigger if exists update_vendor_payouts_updated_at on public.vendor_payouts;
create trigger update_vendor_payouts_updated_at
  before update on public.vendor_payouts
  for each row
  execute function update_vendor_payouts_updated_at();

-- Grant permissions
grant usage on schema public to authenticated;
grant select, insert, update on public.vendor_payouts to authenticated;

-- Enable RLS
alter table if exists public.vendor_payouts enable row level security;

-- Drop existing policies if any
drop policy if exists "Vendors can view own payouts" on public.vendor_payouts;
drop policy if exists "Vendors can update own payouts" on public.vendor_payouts;

-- Policy 1: Vendors can view their own payouts
create policy "Vendors can view own payouts"
  on public.vendor_payouts
  for select
  to authenticated
  using (vendor_id = auth.uid());

-- Policy 2: Vendors can update their own payouts (for status updates)
create policy "Vendors can update own payouts"
  on public.vendor_payouts
  for update
  to authenticated
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

-- Note: Insert policy is not needed as payouts are created by system triggers/functions
-- The system will use service_role key to insert payouts

commit;

-- Verification queries (run separately):
--
-- 1. Check table structure:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'vendor_payouts'
-- ORDER BY ordinal_position;
--
-- 2. Check RLS policies:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'vendor_payouts';
--
-- 3. Check indexes:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'vendor_payouts'
--   AND schemaname = 'public';





