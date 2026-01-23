-- Create rider_payment_details table for storing rider payout bank details

begin;

create table if not exists public.rider_payment_details (
  id uuid default gen_random_uuid() primary key,
  rider_id uuid not null references public.profiles(id) on delete cascade,
  account_name text not null,
  bank_name text not null,
  account_number text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (rider_id)
);

create index if not exists idx_rider_payment_details_rider_id
  on public.rider_payment_details(rider_id);

create or replace function public.ensure_rider_payment_details_role()
returns trigger as $$
declare
  rider_role text;
begin
  select role into rider_role
  from public.profiles
  where id = new.rider_id;

  if rider_role is distinct from 'rider' then
    raise exception 'rider_payment_details requires a rider profile';
  end if;

  return new;
end;
$$ language plpgsql security definer;

create or replace function update_rider_payment_details_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_rider_payment_details_updated_at on public.rider_payment_details;
create trigger update_rider_payment_details_updated_at
  before update on public.rider_payment_details
  for each row
  execute function update_rider_payment_details_updated_at();

drop trigger if exists validate_rider_payment_details_role on public.rider_payment_details;
create trigger validate_rider_payment_details_role
  before insert or update on public.rider_payment_details
  for each row
  execute function public.ensure_rider_payment_details_role();

grant usage on schema public to authenticated;
grant select, insert, update on public.rider_payment_details to authenticated;

alter table public.rider_payment_details enable row level security;

drop policy if exists "Riders can view own payment details" on public.rider_payment_details;
drop policy if exists "Riders can insert own payment details" on public.rider_payment_details;
drop policy if exists "Riders can update own payment details" on public.rider_payment_details;
drop policy if exists "Admins can view all rider payment details" on public.rider_payment_details;

create policy "Riders can view own payment details"
  on public.rider_payment_details
  for select
  to authenticated
  using (rider_id = auth.uid());

create policy "Riders can insert own payment details"
  on public.rider_payment_details
  for insert
  to authenticated
  with check (rider_id = auth.uid());

create policy "Riders can update own payment details"
  on public.rider_payment_details
  for update
  to authenticated
  using (rider_id = auth.uid())
  with check (rider_id = auth.uid());

create policy "Admins can view all rider payment details"
  on public.rider_payment_details
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

commit;

