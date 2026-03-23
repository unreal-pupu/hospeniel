-- Ensure cook/chef core tables exist in Supabase.
-- This prevents PGRST205 "table not found" errors from breaking the vendor cook/chef dashboard.

begin;

-- =========================================================
-- cook_chef_availability
-- =========================================================
create table if not exists public.cook_chef_availability (
  id uuid default gen_random_uuid() primary key,
  vendor_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  is_available boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(vendor_id, date, start_time, end_time)
);

create index if not exists idx_cook_chef_availability_vendor_id on public.cook_chef_availability(vendor_id);
create index if not exists idx_cook_chef_availability_date on public.cook_chef_availability(date);
create index if not exists idx_cook_chef_availability_vendor_date on public.cook_chef_availability(vendor_id, date);

create or replace function update_cook_chef_availability_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_cook_chef_availability_updated_at on public.cook_chef_availability;
create trigger update_cook_chef_availability_updated_at
  before update on public.cook_chef_availability
  for each row
  execute function update_cook_chef_availability_updated_at();

alter table public.cook_chef_availability enable row level security;

drop policy if exists "Vendors can view their own availability" on public.cook_chef_availability;
drop policy if exists "Vendors can insert their own availability" on public.cook_chef_availability;
drop policy if exists "Vendors can update their own availability" on public.cook_chef_availability;
drop policy if exists "Vendors can delete their own availability" on public.cook_chef_availability;
drop policy if exists "Users can view cook/chef availability" on public.cook_chef_availability;

create policy "Vendors can view their own availability"
  on public.cook_chef_availability
  for select
  to authenticated
  using (auth.uid() = vendor_id);

create policy "Vendors can insert their own availability"
  on public.cook_chef_availability
  for insert
  to authenticated
  with check (auth.uid() = vendor_id);

create policy "Vendors can update their own availability"
  on public.cook_chef_availability
  for update
  to authenticated
  using (auth.uid() = vendor_id);

create policy "Vendors can delete their own availability"
  on public.cook_chef_availability
  for delete
  to authenticated
  using (auth.uid() = vendor_id);

create policy "Users can view cook/chef availability"
  on public.cook_chef_availability
  for select
  to authenticated
  using (
    is_available = true
    and exists (
      select 1 from public.profiles p
      where p.id = vendor_id
      and p.category in ('chef', 'home_cook')
    )
  );

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.cook_chef_availability to authenticated;

-- =========================================================
-- cook_chef_booking_requests
-- =========================================================
create table if not exists public.cook_chef_booking_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  vendor_id uuid references auth.users(id) on delete cascade not null,
  meal_type text not null,
  number_of_people integer not null,
  special_instructions text,
  location text not null,
  requested_date date not null,
  requested_time time not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'pending_confirmation', 'paid', 'completed', 'cancelled')),
  base_price numeric(10, 2),
  final_price numeric(10, 2),
  price_confirmed boolean default false not null,
  payment_reference text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  accepted_at timestamp with time zone,
  paid_at timestamp with time zone,
  completed_at timestamp with time zone
);

create index if not exists idx_cook_chef_booking_requests_user_id on public.cook_chef_booking_requests(user_id);
create index if not exists idx_cook_chef_booking_requests_vendor_id on public.cook_chef_booking_requests(vendor_id);
create index if not exists idx_cook_chef_booking_requests_status on public.cook_chef_booking_requests(status);
create index if not exists idx_cook_chef_booking_requests_requested_date on public.cook_chef_booking_requests(requested_date);
create index if not exists idx_cook_chef_booking_requests_vendor_status
  on public.cook_chef_booking_requests(vendor_id, status)
  where status in ('pending', 'accepted', 'pending_confirmation');

create or replace function update_cook_chef_booking_requests_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());

  if new.status = 'accepted' and (old.status is null or old.status != 'accepted') then
    new.accepted_at = timezone('utc'::text, now());
  end if;

  if new.status = 'paid' and (old.status is null or old.status != 'paid') then
    new.paid_at = timezone('utc'::text, now());
  end if;

  if new.status = 'completed' and (old.status is null or old.status != 'completed') then
    new.completed_at = timezone('utc'::text, now());
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists update_cook_chef_booking_requests_updated_at on public.cook_chef_booking_requests;
create trigger update_cook_chef_booking_requests_updated_at
  before update on public.cook_chef_booking_requests
  for each row
  execute function update_cook_chef_booking_requests_updated_at();

alter table public.cook_chef_booking_requests enable row level security;

drop policy if exists "Users can view their own booking requests" on public.cook_chef_booking_requests;
drop policy if exists "Users can create booking requests" on public.cook_chef_booking_requests;
drop policy if exists "Vendors can view their booking requests" on public.cook_chef_booking_requests;
drop policy if exists "Vendors can update their booking requests" on public.cook_chef_booking_requests;

create policy "Users can view their own booking requests"
  on public.cook_chef_booking_requests
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create booking requests"
  on public.cook_chef_booking_requests
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Vendors can view their booking requests"
  on public.cook_chef_booking_requests
  for select
  to authenticated
  using (auth.uid() = vendor_id);

create policy "Vendors can update their booking requests"
  on public.cook_chef_booking_requests
  for update
  to authenticated
  using (auth.uid() = vendor_id);

grant usage on schema public to authenticated;
grant select, insert, update on public.cook_chef_booking_requests to authenticated;

-- =========================================================
-- cook_chef_messages
-- =========================================================
create table if not exists public.cook_chef_messages (
  id uuid default gen_random_uuid() primary key,
  booking_request_id uuid references public.cook_chef_booking_requests(id) on delete cascade not null,
  sender_id uuid references auth.users(id) on delete cascade not null,
  message text not null,
  read_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_cook_chef_messages_booking_request_id on public.cook_chef_messages(booking_request_id);
create index if not exists idx_cook_chef_messages_sender_id on public.cook_chef_messages(sender_id);
create index if not exists idx_cook_chef_messages_created_at on public.cook_chef_messages(created_at desc);

alter table public.cook_chef_messages enable row level security;

drop policy if exists "Users and vendors can view messages for their booking requests" on public.cook_chef_messages;
drop policy if exists "Users and vendors can send messages for their booking requests" on public.cook_chef_messages;
drop policy if exists "Senders can update their messages" on public.cook_chef_messages;

create policy "Users and vendors can view messages for their booking requests"
  on public.cook_chef_messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.cook_chef_booking_requests cbr
      where cbr.id = booking_request_id
      and (cbr.user_id = auth.uid() or cbr.vendor_id = auth.uid())
    )
  );

create policy "Users and vendors can send messages for their booking requests"
  on public.cook_chef_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.cook_chef_booking_requests cbr
      where cbr.id = booking_request_id
      and (cbr.user_id = auth.uid() or cbr.vendor_id = auth.uid())
    )
  );

create policy "Senders can update their messages"
  on public.cook_chef_messages
  for update
  to authenticated
  using (
    exists (
      select 1 from public.cook_chef_booking_requests cbr
      where cbr.id = booking_request_id
      and (cbr.user_id = auth.uid() or cbr.vendor_id = auth.uid())
    )
  );

grant usage on schema public to authenticated;
grant select, insert, update on public.cook_chef_messages to authenticated;

commit;

