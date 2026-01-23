begin;

-- Add order_type to distinguish menu vs service orders
alter table public.orders
  add column if not exists order_type text default 'menu';

-- Add service_request_id to link service orders back to requests
alter table public.orders
  add column if not exists service_request_id uuid references public.service_requests(id) on delete set null;

-- Helpful indexes for lookups
create index if not exists idx_orders_order_type on public.orders(order_type);
create index if not exists idx_orders_service_request_id on public.orders(service_request_id);

commit;
