-- Create cook_chef_messages table for chat/messaging between users and cooks/chefs
-- Messages are linked to booking requests

begin;

-- Create cook_chef_messages table
create table if not exists public.cook_chef_messages (
  id uuid default gen_random_uuid() primary key,
  booking_request_id uuid references public.cook_chef_booking_requests(id) on delete cascade not null,
  sender_id uuid references auth.users(id) on delete cascade not null,
  message text not null,
  read_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for better query performance
create index if not exists idx_cook_chef_messages_booking_request_id on public.cook_chef_messages(booking_request_id);
create index if not exists idx_cook_chef_messages_sender_id on public.cook_chef_messages(sender_id);
create index if not exists idx_cook_chef_messages_created_at on public.cook_chef_messages(created_at desc);

-- Enable RLS
alter table public.cook_chef_messages enable row level security;

-- RLS Policy: Users and vendors can view messages for their booking requests
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

-- RLS Policy: Users and vendors can send messages for their booking requests
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

-- RLS Policy: Senders can update their messages (mark as read)
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

-- Grant permissions
grant usage on schema public to authenticated;
grant select, insert, update on public.cook_chef_messages to authenticated;

commit;
