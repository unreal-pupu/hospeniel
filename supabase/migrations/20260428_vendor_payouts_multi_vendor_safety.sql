begin;

alter table public.vendor_payouts
  drop constraint if exists vendor_payouts_status_check;

alter table public.vendor_payouts
  add constraint vendor_payouts_status_check
  check (status in ('pending', 'processing', 'paid', 'completed', 'failed'));

with grouped as (
  select
    min(id) as keep_id,
    vendor_id,
    payment_id,
    sum(coalesce(payout_amount, 0))::numeric(10, 2) as payout_amount,
    case
      when bool_or(status = 'paid') then 'paid'
      when bool_or(status = 'completed') then 'completed'
      when bool_or(status = 'processing') then 'processing'
      when bool_or(status = 'failed') then 'failed'
      else 'pending'
    end as merged_status,
    max(payout_reference) as payout_reference,
    min(created_at) as created_at,
    max(updated_at) as updated_at,
    max(completed_at) as completed_at
  from public.vendor_payouts
  group by vendor_id, payment_id
),
updated as (
  update public.vendor_payouts vp
  set
    order_id = null,
    payout_amount = g.payout_amount,
    status = g.merged_status,
    payout_reference = g.payout_reference,
    created_at = g.created_at,
    updated_at = g.updated_at,
    completed_at = g.completed_at
  from grouped g
  where vp.id = g.keep_id
  returning vp.id
)
delete from public.vendor_payouts vp
using grouped g
where vp.vendor_id = g.vendor_id
  and vp.payment_id = g.payment_id
  and vp.id <> g.keep_id;

create unique index if not exists idx_vendor_payouts_payment_vendor_unique
  on public.vendor_payouts(payment_id, vendor_id);

commit;
