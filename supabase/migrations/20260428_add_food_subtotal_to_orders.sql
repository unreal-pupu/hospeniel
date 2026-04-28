begin;

alter table public.orders
  add column if not exists food_subtotal numeric(10, 2);

update public.orders
set food_subtotal = case
  when coalesce(order_type, 'menu') = 'menu' then coalesce(total_price, 0)
  else 0
end
where food_subtotal is null;

alter table public.orders
  alter column food_subtotal set default 0;

alter table public.orders
  alter column food_subtotal set not null;

alter table public.orders
  drop constraint if exists orders_food_subtotal_non_negative;

alter table public.orders
  add constraint orders_food_subtotal_non_negative check (food_subtotal >= 0);

create index if not exists idx_orders_food_subtotal
  on public.orders(food_subtotal)
  where food_subtotal > 0;

commit;
