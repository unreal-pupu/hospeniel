-- Add tax and commission columns to payments table
-- This enables platform-controlled payments with automatic commission calculation

begin;

-- Add new columns to payments table
alter table if exists public.payments
  add column if not exists subtotal numeric(10, 2),
  add column if not exists tax_amount numeric(10, 2) default 0,
  add column if not exists commission_amount numeric(10, 2) default 0;

-- Add check constraints to ensure non-negative values
alter table if exists public.payments
  drop constraint if exists payments_tax_amount_check;

alter table if exists public.payments
  add constraint payments_tax_amount_check 
  check (tax_amount is null or tax_amount >= 0);

alter table if exists public.payments
  drop constraint if exists payments_commission_amount_check;

alter table if exists public.payments
  add constraint payments_commission_amount_check 
  check (commission_amount is null or commission_amount >= 0);

-- Add comment explaining the columns
comment on column public.payments.subtotal is 'Subtotal before tax and commission';
comment on column public.payments.tax_amount is 'VAT amount (7.5% of subtotal)';
comment on column public.payments.commission_amount is 'Platform commission (10% of subtotal)';
comment on column public.payments.total_amount is 'Total amount paid by user (subtotal + tax)';

commit;

-- Verification query (run separately):
--
-- Check columns:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'payments'
--   AND column_name IN ('subtotal', 'tax_amount', 'commission_amount')
-- ORDER BY ordinal_position;





