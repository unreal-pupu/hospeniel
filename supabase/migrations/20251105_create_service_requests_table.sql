-- Create service_requests table for premium vendor contact system
-- This table stores service requests from users to premium vendors

begin;

-- Create service_requests table
create table if not exists public.service_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  vendor_id uuid references auth.users(id) on delete cascade not null,
  message text not null,
  contact_info text,
  status text not null default 'New' check (status in ('New', 'Viewed', 'Responded')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for better query performance
create index if not exists idx_service_requests_vendor_id on public.service_requests(vendor_id);
create index if not exists idx_service_requests_user_id on public.service_requests(user_id);
create index if not exists idx_service_requests_status on public.service_requests(status);
create index if not exists idx_service_requests_created_at on public.service_requests(created_at desc);
create index if not exists idx_service_requests_vendor_status on public.service_requests(vendor_id, status) where status = 'New';

-- Create function to update updated_at timestamp
create or replace function update_service_requests_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
drop trigger if exists update_service_requests_updated_at on public.service_requests;
create trigger update_service_requests_updated_at
  before update on public.service_requests
  for each row
  execute function update_service_requests_updated_at();

-- Grant permissions
grant usage on schema public to authenticated;
grant select, insert, update on public.service_requests to authenticated;

-- Enable RLS
alter table if exists public.service_requests enable row level security;

-- Drop existing policies if any
drop policy if exists "Users can view own service requests" on public.service_requests;
drop policy if exists "Users can insert own service requests" on public.service_requests;
drop policy if exists "Vendors can view own service requests" on public.service_requests;
drop policy if exists "Vendors can update own service requests" on public.service_requests;

-- Policy 1: Users can view their own service requests
create policy "Users can view own service requests"
  on public.service_requests
  for select
  to authenticated
  using (user_id = auth.uid());

-- Policy 2: Users can insert service requests for themselves
create policy "Users can insert own service requests"
  on public.service_requests
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Policy 3: Vendors can view only their own service requests
create policy "Vendors can view own service requests"
  on public.service_requests
  for select
  to authenticated
  using (vendor_id = auth.uid());

-- Policy 4: Vendors can update only their own service requests
create policy "Vendors can update own service requests"
  on public.service_requests
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
--   AND table_name = 'service_requests'
-- ORDER BY ordinal_position;
--
-- 2. Check RLS policies:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'service_requests';
--
-- 3. Check indexes:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'service_requests'
--   AND schemaname = 'public';





