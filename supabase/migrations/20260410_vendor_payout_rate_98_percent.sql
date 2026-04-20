-- Align vendor payout trigger with 2% platform commission (vendor receives 98% of order line total).

begin;

create or replace function public.create_vendor_payouts()
returns trigger as $$
declare
    order_record record;
    vendor_payout_amount numeric(10, 2);
begin
  if new.status = 'success' and (old.status is null or old.status != 'success') then

    for order_record in
      select id, vendor_id, total_price, quantity
      from public.orders
      where payment_reference = new.payment_reference
        and vendor_id is not null
    loop
      -- Vendor share of order line total after 2% platform commission on the order amount model.
      vendor_payout_amount := order_record.total_price * 0.98;
      vendor_payout_amount := round(vendor_payout_amount, 2);

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
      on conflict do nothing;

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

commit;
