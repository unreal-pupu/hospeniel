-- Create trigger to automatically create vendor payouts when payment is successful
-- This trigger calculates payout amount and creates payout records for each order

begin;

-- Step 1: Create function to create vendor payouts
create or replace function create_vendor_payouts()
returns trigger as $$
declare
  order_record record;
  vendor_payout_amount numeric(10, 2);
  subtotal_val numeric(10, 2);
  commission_val numeric(10, 2);
begin
  -- Only process if payment status changed to 'success'
  if new.status = 'success' and (old.status is null or old.status != 'success') then
    
    -- Get subtotal and commission from payment
    subtotal_val := coalesce(new.subtotal, new.total_amount);
    commission_val := coalesce(new.commission_amount, 0);
    
    -- Find all orders for this payment
    for order_record in 
      select id, vendor_id, total_price, quantity
      from public.orders
      where payment_reference = new.payment_reference
        and vendor_id is not null
    loop
      -- Calculate vendor payout for this order
      -- Commission is 10% of subtotal, so vendor gets 90% of their order amount
      -- Payout = order amount * 0.9 (90% after 10% commission)
      vendor_payout_amount := order_record.total_price * 0.9;
      
      -- Round to 2 decimal places
      vendor_payout_amount := round(vendor_payout_amount, 2);
      
      -- Create payout record
      insert into public.vendor_payouts (
        vendor_id,
        payment_id,
        order_id,
        payout_amount,
        status
      )
      values (
        order_record.vendor_id,
        new.id,
        order_record.id,
        vendor_payout_amount,
        'pending'
      )
      on conflict do nothing; -- Prevent duplicates
      
      -- Create notification for vendor
      insert into public.notifications (
        vendor_id,
        message,
        type,
        metadata
      )
      values (
        order_record.vendor_id,
        'You have a new paid order. ₦' || vendor_payout_amount::text || ' will be processed soon.',
        'payment',
        jsonb_build_object(
          'type', 'payout',
          'payment_id', new.id,
          'order_id', order_record.id,
          'payout_amount', vendor_payout_amount
        )
      )
      on conflict do nothing;
      
      raise notice 'Created payout for vendor %: ₦% (order: %)', 
        order_record.vendor_id, vendor_payout_amount, order_record.id;
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

