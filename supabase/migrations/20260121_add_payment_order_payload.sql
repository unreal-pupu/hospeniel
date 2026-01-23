-- Store pending order payloads for multi-vendor payments
begin;

alter table if exists public.payments
  add column if not exists pending_orders jsonb,
  add column if not exists delivery_details jsonb;

commit;
