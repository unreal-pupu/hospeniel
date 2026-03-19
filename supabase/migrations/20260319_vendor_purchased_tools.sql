-- Premium tools purchased by vendors (profiles.id = vendor_id)
-- Linked to profiles; rows created server-side after successful Paystack payment.

begin;

create table if not exists public.vendor_purchased_tools (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.profiles (id) on delete cascade,
  tool_name text not null,
  status text not null default 'active' check (status in ('active', 'expired')),
  purchase_date timestamptz not null default timezone('utc'::text, now()),
  expiry_date timestamptz not null,
  payment_reference text unique,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_vendor_purchased_tools_vendor_id
  on public.vendor_purchased_tools (vendor_id);

create index if not exists idx_vendor_purchased_tools_expiry
  on public.vendor_purchased_tools (expiry_date);

comment on table public.vendor_purchased_tools is 'Premium marketing/placement tools purchased by vendors; vendor_id references profiles.id';

alter table public.vendor_purchased_tools enable row level security;

-- Vendors read only their own tool purchases
drop policy if exists "Vendors can select own purchased tools" on public.vendor_purchased_tools;
create policy "Vendors can select own purchased tools"
  on public.vendor_purchased_tools
  for select
  to authenticated
  using (vendor_id = auth.uid());

-- Inserts/updates from application use service role (bypass RLS); no direct client writes

grant select on public.vendor_purchased_tools to authenticated;

commit;
