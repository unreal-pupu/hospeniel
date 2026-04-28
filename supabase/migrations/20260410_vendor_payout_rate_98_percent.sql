-- Align vendor payout trigger with 5% platform commission (vendor receives 95% of order line total).

begin;

create or replace function public.create_vendor_payouts()
returns trigger as $$
declare
    vendor_rollup record;
    vendor_payout_amount numeric(10, 2);
begin
  if new.status = 'success' and (old.status is null or old.status != 'success') then

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
      -- Vendor share is based strictly on food-only subtotal.
      vendor_payout_amount := round(coalesce(vendor_rollup.vendor_food_subtotal, 0) * 0.95, 2);

      if vendor_payout_amount <= 0 then
        continue;
      end if;

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

commit;
