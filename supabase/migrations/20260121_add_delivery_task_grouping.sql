-- Add grouping fields for multi-stop deliveries
begin;

alter table if exists public.delivery_tasks
  add column if not exists payment_reference text,
  add column if not exists pickup_sequence integer;

create index if not exists idx_delivery_tasks_payment_reference
  on public.delivery_tasks(payment_reference);

commit;
