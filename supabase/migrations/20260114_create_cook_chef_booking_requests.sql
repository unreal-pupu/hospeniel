-- Create cook_chef_booking_requests table for managing booking requests
-- Status workflow: pending → accepted → paid → completed

begin;

-- Create cook_chef_booking_requests table
create table if not exists public.cook_chef_booking_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  vendor_id uuid references auth.users(id) on delete cascade not null,
  meal_type text not null, -- Type of meal requested
  number_of_people integer not null,
  special_instructions text,
  location text not null, -- Customer location
  requested_date date not null,
  requested_time time not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'pending_confirmation', 'paid', 'completed', 'cancelled')),
  base_price numeric(10, 2), -- Original price
  final_price numeric(10, 2), -- Price after cook adjustments
  price_confirmed boolean default false not null,
  payment_reference text, -- Payment reference if paid
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  accepted_at timestamp with time zone,
  paid_at timestamp with time zone,
  completed_at timestamp with time zone
);

-- Create indexes for better query performance
create index if not exists idx_cook_chef_booking_requests_user_id on public.cook_chef_booking_requests(user_id);
create index if not exists idx_cook_chef_booking_requests_vendor_id on public.cook_chef_booking_requests(vendor_id);
create index if not exists idx_cook_chef_booking_requests_status on public.cook_chef_booking_requests(status);
create index if not exists idx_cook_chef_booking_requests_requested_date on public.cook_chef_booking_requests(requested_date);
create index if not exists idx_cook_chef_booking_requests_vendor_status on public.cook_chef_booking_requests(vendor_id, status) where status in ('pending', 'accepted', 'pending_confirmation');

-- Create function to update updated_at timestamp
create or replace function update_cook_chef_booking_requests_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  
  -- Set timestamps based on status changes
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

-- Create trigger to automatically update updated_at and timestamps
drop trigger if exists update_cook_chef_booking_requests_updated_at on public.cook_chef_booking_requests;
create trigger update_cook_chef_booking_requests_updated_at
  before update on public.cook_chef_booking_requests
  for each row
  execute function update_cook_chef_booking_requests_updated_at();

-- Enable RLS
alter table public.cook_chef_booking_requests enable row level security;

-- RLS Policy: Users can view and create their own requests
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

-- RLS Policy: Vendors can view requests for them
create policy "Vendors can view their booking requests"
  on public.cook_chef_booking_requests
  for select
  to authenticated
  using (auth.uid() = vendor_id);

-- RLS Policy: Vendors can update requests (accept, decline, adjust price)
create policy "Vendors can update their booking requests"
  on public.cook_chef_booking_requests
  for update
  to authenticated
  using (auth.uid() = vendor_id);

-- Grant permissions
grant usage on schema public to authenticated;
grant select, insert, update on public.cook_chef_booking_requests to authenticated;

commit;
