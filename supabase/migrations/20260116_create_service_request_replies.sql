-- Create service_request_replies table for storing replies to service requests
-- This allows vendors and customers to have threaded conversations

begin;

-- Create service_request_replies table
create table if not exists public.service_request_replies (
  id uuid default gen_random_uuid() primary key,
  service_request_id uuid references public.service_requests(id) on delete cascade not null,
  sender_id uuid references auth.users(id) on delete cascade not null,
  sender_role text not null check (sender_role in ('user', 'vendor')),
  message text not null,
  read_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for better query performance
create index if not exists idx_service_request_replies_request_id on public.service_request_replies(service_request_id);
create index if not exists idx_service_request_replies_sender_id on public.service_request_replies(sender_id);
create index if not exists idx_service_request_replies_created_at on public.service_request_replies(created_at desc);

-- Grant permissions
grant usage on schema public to authenticated;
grant select, insert, update on public.service_request_replies to authenticated;

-- Enable RLS
alter table if exists public.service_request_replies enable row level security;

-- Drop existing policies if any
drop policy if exists "Users and vendors can view replies for their service requests" on public.service_request_replies;
drop policy if exists "Users and vendors can send replies for their service requests" on public.service_request_replies;
drop policy if exists "Senders can update their replies" on public.service_request_replies;

-- Policy 1: Users and vendors can view replies for their service requests
create policy "Users and vendors can view replies for their service requests"
  on public.service_request_replies
  for select
  to authenticated
  using (
    exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_replies.service_request_id
      and (sr.user_id = auth.uid() or sr.vendor_id = auth.uid())
    )
  );

-- Policy 2: Users and vendors can send replies for their service requests
create policy "Users and vendors can send replies for their service requests"
  on public.service_request_replies
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_replies.service_request_id
      and (sr.user_id = auth.uid() or sr.vendor_id = auth.uid())
    )
  );

-- Policy 3: Senders can update their replies (mark as read)
create policy "Senders can update their replies"
  on public.service_request_replies
  for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

commit;
