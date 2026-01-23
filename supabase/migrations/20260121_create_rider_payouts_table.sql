-- Create rider_payouts table for tracking weekly rider payouts
-- This table stores weekly payout aggregates per rider

begin;

create table if not exists public.rider_payouts (
  id uuid default gen_random_uuid() primary key,
  rider_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  total_deliveries integer not null default 0 check (total_deliveries >= 0),
  amount_per_delivery numeric(10, 2) not null default 500 check (amount_per_delivery >= 0),
  total_amount numeric(10, 2) not null default 0 check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (rider_id, week_start)
);

create index if not exists idx_rider_payouts_rider_id on public.rider_payouts(rider_id);
create index if not exists idx_rider_payouts_week_start on public.rider_payouts(week_start desc);
create index if not exists idx_rider_payouts_status on public.rider_payouts(status);

create or replace function update_rider_payouts_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_rider_payouts_updated_at on public.rider_payouts;
create trigger update_rider_payouts_updated_at
  before update on public.rider_payouts
  for each row
  execute function update_rider_payouts_updated_at();

grant usage on schema public to authenticated;
grant select, insert, update on public.rider_payouts to authenticated;

alter table public.rider_payouts enable row level security;

drop policy if exists "Admins can view all rider payouts" on public.rider_payouts;
drop policy if exists "Admins can insert rider payouts" on public.rider_payouts;
drop policy if exists "Admins can update rider payouts" on public.rider_payouts;

create policy "Admins can view all rider payouts"
  on public.rider_payouts
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "Admins can insert rider payouts"
  on public.rider_payouts
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "Admins can update rider payouts"
  on public.rider_payouts
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

commit;

