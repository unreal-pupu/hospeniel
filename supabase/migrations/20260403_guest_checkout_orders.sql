-- Guest checkout: nullable user_id on orders/payments, guest_id + customer contact fields.

begin;

-- Orders: allow guests (no auth.users row)
alter table public.orders alter column user_id drop not null;

alter table public.orders
  add column if not exists guest_id uuid,
  add column if not exists customer_name text,
  add column if not exists customer_phone text;

create index if not exists idx_orders_guest_id on public.orders(guest_id) where guest_id is not null;

alter table public.orders drop constraint if exists orders_user_or_guest_check;
alter table public.orders
  add constraint orders_user_or_guest_check check (
    (user_id is not null and guest_id is null)
    or (user_id is null and guest_id is not null)
  );

comment on column public.orders.guest_id is 'Stable anonymous id from client localStorage for guest checkout';
comment on column public.orders.customer_name is 'Customer display name at checkout (esp. guests)';
comment on column public.orders.customer_phone is 'Customer phone at checkout (esp. guests)';

-- Payments: guest rows use service-role insert only (RLS unchanged for authenticated users)
alter table public.payments alter column user_id drop not null;

alter table public.payments
  add column if not exists guest_id uuid;

create index if not exists idx_payments_guest_id on public.payments(guest_id) where guest_id is not null;

alter table public.payments drop constraint if exists payments_user_or_guest_check;
alter table public.payments
  add constraint payments_user_or_guest_check check (
    (user_id is not null and guest_id is null)
    or (user_id is null and guest_id is not null)
  );

commit;
