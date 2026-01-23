-- Add payment_status and amount_paid to service_requests
-- Allow system messages in service_request_replies and create service_request_messages view

begin;

-- Add payment status and amount paid fields
alter table if exists public.service_requests
  add column if not exists payment_status text default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  add column if not exists amount_paid numeric(10, 2);

-- Backfill payment_status for already paid requests
update public.service_requests
set payment_status = 'paid'
where status in ('Paid', 'Completed') or payment_reference is not null;

-- Update sender_role check to allow system messages
alter table if exists public.service_request_replies
  drop constraint if exists service_request_replies_sender_role_check;

alter table if exists public.service_request_replies
  add constraint service_request_replies_sender_role_check
  check (sender_role in ('user', 'vendor', 'system'));

-- Ensure insert policy only allows user/vendor for authenticated clients
drop policy if exists "Users and vendors can send replies for their service requests" on public.service_request_replies;
create policy "Users and vendors can send replies for their service requests"
  on public.service_request_replies
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and sender_role in ('user', 'vendor')
    and exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_replies.service_request_id
      and (sr.user_id = auth.uid() or sr.vendor_id = auth.uid())
    )
  );

-- Create a view for service_request_messages (alias to service_request_replies)
create or replace view public.service_request_messages as
select * from public.service_request_replies;

-- Allow inserts into the view by redirecting to the base table
create or replace rule service_request_messages_insert as
  on insert to public.service_request_messages
  do instead
    insert into public.service_request_replies (
      service_request_id,
      sender_id,
      sender_role,
      message,
      read_at,
      created_at
    )
    values (
      new.service_request_id,
      new.sender_id,
      new.sender_role,
      new.message,
      new.read_at,
      coalesce(new.created_at, timezone('utc'::text, now()))
    );

commit;
