-- Fix RLS policies for service_request_replies to ensure customers can see vendor replies
-- This migration ensures proper access control for both customers and vendors

begin;

-- Drop existing policies to recreate them with proper logic
drop policy if exists "Users and vendors can view replies for their service requests" on public.service_request_replies;
drop policy if exists "Users and vendors can send replies for their service requests" on public.service_request_replies;
drop policy if exists "Senders can update their replies" on public.service_request_replies;

-- Policy 1: Users and vendors can view replies for their service requests
-- This ensures customers can see vendor replies and vendors can see customer replies
create policy "Users and vendors can view replies for their service requests"
  on public.service_request_replies
  for select
  to authenticated
  using (
    exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_replies.service_request_id
      and (
        sr.user_id = auth.uid() -- Customer can see all replies to their requests
        or sr.vendor_id = auth.uid() -- Vendor can see all replies to requests sent to them
      )
    )
  );

-- Policy 2: Users and vendors can send replies for their service requests
create policy "Users and vendors can send replies for their service requests"
  on public.service_request_replies
  for insert
  to authenticated
  with check (
    sender_id = auth.uid() -- Must be the authenticated user sending
    and exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_replies.service_request_id
      and (
        (sr.user_id = auth.uid() and service_request_replies.sender_role = 'user') -- Customer sending
        or (sr.vendor_id = auth.uid() and service_request_replies.sender_role = 'vendor') -- Vendor sending
      )
    )
  );

-- Policy 3: Senders can update their replies (mark as read)
create policy "Senders can update their replies"
  on public.service_request_replies
  for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- Grant necessary permissions
grant select, insert, update on public.service_request_replies to authenticated;

commit;
