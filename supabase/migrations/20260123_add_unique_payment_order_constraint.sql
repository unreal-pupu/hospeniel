-- Ensure orders are unique per payment + vendor + product + user to prevent duplicates
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'orders_payment_vendor_product_user_unique'
  ) then
    create unique index orders_payment_vendor_product_user_unique
      on public.orders(payment_reference, vendor_id, product_id, user_id);
    raise notice '✅ Added unique index orders_payment_vendor_product_user_unique';
  else
    raise notice 'ℹ️ Unique index orders_payment_vendor_product_user_unique already exists';
  end if;
end $$;
