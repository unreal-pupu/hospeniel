-- Add vat_amount column to orders table for per-order VAT tracking
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'vat_amount'
  ) then
    alter table public.orders
      add column vat_amount numeric(10, 2) default 0;
    raise notice '✅ Added vat_amount column to orders table';
  else
    raise notice 'ℹ️ vat_amount column already exists in orders table';
  end if;
end $$;

create index if not exists idx_orders_vat_amount on public.orders(vat_amount) where vat_amount > 0;
