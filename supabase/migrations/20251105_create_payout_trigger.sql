-- Create trigger to automatically create vendor payouts when payment is successful
-- This trigger calculates payout amount and creates payout records for each order

begin;

-- Step 1: Create function to create vendor payouts
create or replace function create_vendor_payouts()
returns trigger as $$
declare
  vendor_rollup record;
  vendor_payout_amount numeric(10, 2);
begin
  -- Only process if payment status changed to 'success'
  if new.status = 'success' and (old.status is null or old.status != 'success') then
    -- Aggregate by vendor for multi-vendor safety (one payout per vendor per payment).
    for vendor_rollup in
      select
        vendor_id,
        sum(coalesce(food_subtotal, 0))::numeric(10, 2) as vendor_food_subtotal,
        array_agg(id) as order_ids
      from public.orders
      where payment_reference = new.payment_reference
        and vendor_id is not null
      group by vendor_id
    loop
      -- Vendor payout must be based on food-only subtotal, excluding VAT/delivery/service fees.
      vendor_payout_amount := round(coalesce(vendor_rollup.vendor_food_subtotal, 0) * 0.95, 2);
      
      -- Skip payout rows when an order has no food component.
      if vendor_payout_amount <= 0 then
        continue;
      end if;
      
      -- Create or refresh payout record (idempotent per vendor/payment).
      insert into public.vendor_payouts (
        vendor_id,
        payment_id,
        order_id,
        payout_amount,
        status
      )
      values (
        vendor_rollup.vendor_id,
        new.id,
        null,
        vendor_payout_amount,
        'pending'
      )
      on conflict (payment_id, vendor_id)
      do update
      set
        payout_amount = excluded.payout_amount,
        status = 'pending',
        order_id = null,
        updated_at = timezone('utc'::text, now());
      
      -- Create notification for vendor
      insert into public.notifications (
        vendor_id,
        message,
        type,
        metadata
      )
      values (
        vendor_rollup.vendor_id,
        'You have a new paid order. ₦' || vendor_payout_amount::text || ' will be processed soon.',
        'payment',
        jsonb_build_object(
          'type', 'payout',
          'payment_id', new.id,
          'order_ids', vendor_rollup.order_ids,
          'vendor_food_subtotal', vendor_rollup.vendor_food_subtotal,
          'payout_amount', vendor_payout_amount
        )
      )
      on conflict do nothing;
      
      raise notice 'Created payout for vendor %: ₦% (order: %)', 
        vendor_rollup.vendor_id, vendor_payout_amount, vendor_rollup.order_ids;
    end loop;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Step 2: Grant execute permission
grant execute on function create_vendor_payouts() to authenticated;
grant execute on function create_vendor_payouts() to service_role;

-- Step 3: Create trigger
drop trigger if exists trigger_create_vendor_payouts on public.payments;
create trigger trigger_create_vendor_payouts
  after update on public.payments
  for each row
  when (new.status = 'success' and (old.status is null or old.status != 'success'))
  execute function create_vendor_payouts();

commit;

-- Verification queries (run separately):
--
-- 1. Check function exists:
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name = 'create_vendor_payouts';
--
-- 2. Check trigger exists:
-- SELECT trigger_name, event_object_table, action_timing, event_manipulation
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND trigger_name = 'trigger_create_vendor_payouts';
--
-- 3. Test payout creation (after a successful payment):
-- SELECT * FROM vendor_payouts 
-- WHERE payment_id = 'PAYMENT_ID_HERE'
-- ORDER BY created_at DESC;

