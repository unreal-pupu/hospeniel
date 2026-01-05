-- Create notifications table for user and vendor notifications
-- This table stores notifications for both users and vendors

begin;

-- Create notifications table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  vendor_id uuid references auth.users(id) on delete cascade,
  message text not null,
  type text not null check (type in ('order_update', 'system', 'payment', 'subscription')),
  read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for better query performance
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_vendor_id on public.notifications(vendor_id);
create index if not exists idx_notifications_read on public.notifications(read);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, read) where user_id is not null and read = false;
create index if not exists idx_notifications_vendor_unread on public.notifications(vendor_id, read) where vendor_id is not null and read = false;

-- Grant permissions
grant usage on schema public to authenticated;
grant select, insert, update on public.notifications to authenticated;

-- Enable RLS
alter table if exists public.notifications enable row level security;

-- Drop existing policies if any
drop policy if exists "Users can view own notifications" on public.notifications;
drop policy if exists "Vendors can view own notifications" on public.notifications;
drop policy if exists "Users can insert own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Vendors can update own notifications" on public.notifications;

-- Policy 1: Users can view only their own notifications
create policy "Users can view own notifications"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

-- Policy 2: Vendors can view only their own notifications
create policy "Vendors can view own notifications"
  on public.notifications
  for select
  to authenticated
  using (vendor_id = auth.uid());

-- Policy 3: Authenticated users can insert notifications for themselves
create policy "Users can insert own notifications"
  on public.notifications
  for insert
  to authenticated
  with check (
    (user_id = auth.uid() and vendor_id is null) or
    (vendor_id = auth.uid() and user_id is null)
  );

-- Policy 4: Users can update their own notifications (e.g., mark as read)
create policy "Users can update own notifications"
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Policy 5: Vendors can update their own notifications (e.g., mark as read)
create policy "Vendors can update own notifications"
  on public.notifications
  for update
  to authenticated
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

commit;

-- Verification queries (run separately):
--
-- 1. Check table structure:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'notifications'
-- ORDER BY ordinal_position;
--
-- 2. Check RLS policies:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'notifications';
--
-- 3. Check indexes:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'notifications'
--   AND schemaname = 'public';





