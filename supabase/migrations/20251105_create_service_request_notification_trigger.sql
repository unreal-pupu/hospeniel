begin;

-- Step 1: Create service_requests table if it doesn't exist
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

-- Step 2: Create indexes if they don't exist
create index if not exists idx_service_requests_vendor_id on public.service_requests(vendor_id);
create index if not exists idx_service_requests_user_id on public.service_requests(user_id);
create index if not exists idx_service_requests_status on public.service_requests(status);
create index if not exists idx_service_requests_created_at on public.service_requests(created_at desc);
create index if not exists idx_service_requests_vendor_status on public.service_requests(vendor_id, status) where status = 'New';

-- Step 3: Create function to update updated_at timestamp
create or replace function update_service_requests_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Step 4: Create trigger for updated_at if it doesn't exist
drop trigger if exists update_service_requests_updated_at on public.service_requests;
create trigger update_service_requests_updated_at
  before update on public.service_requests
  for each row
  execute function update_service_requests_updated_at();

-- Step 5: Grant permissions
grant usage on schema public to authenticated;
grant select, insert, update on public.service_requests to authenticated;

-- Step 6: Enable RLS
alter table if exists public.service_requests enable row level security;

-- Step 7: Create RLS policies if they don't exist
drop policy if exists "Users can view own service requests" on public.service_requests;
drop policy if exists "Users can insert own service requests" on public.service_requests;
drop policy if exists "Vendors can view own service requests" on public.service_requests;
drop policy if exists "Vendors can update own service requests" on public.service_requests;

create policy "Users can view own service requests"
  on public.service_requests
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own service requests"
  on public.service_requests
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Vendors can view own service requests"
  on public.service_requests
  for select
  to authenticated
  using (vendor_id = auth.uid());

create policy "Vendors can update own service requests"
  on public.service_requests
  for update
  to authenticated
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

-- Step 8: Create notification function for vendors when service request is created
create or replace function notify_vendor_service_request()
returns trigger as $$
declare
  user_name text;
  vendor_subscription_plan text;
  vendor_is_premium boolean;
begin
  -- Check vendor subscription plan from profiles table (primary source)
  select subscription_plan, is_premium into vendor_subscription_plan, vendor_is_premium
  from public.profiles
  where id = new.vendor_id and role = 'vendor';
  
  -- Only create notification if vendor is on Professional plan (is_premium = true)
  if vendor_subscription_plan = 'professional' and vendor_is_premium = true then
    -- Get user name from profiles
    select name into user_name
    from public.profiles
    where id = new.user_id;
    
    -- Create notification for vendor
    insert into public.notifications (vendor_id, message, type)
    values (
      new.vendor_id,
      'You received a new service request from ' || coalesce(user_name, 'a customer'),
      'system'
    );
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Step 9: Drop existing trigger if any
drop trigger if exists trigger_notify_vendor_service_request on public.service_requests;

-- Step 10: Create trigger to notify vendor when new service request is created
create trigger trigger_notify_vendor_service_request
  after insert on public.service_requests
  for each row
  execute function notify_vendor_service_request();

commit;

-- Verification queries (run separately):
--
-- 1. Check function:
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name = 'notify_vendor_service_request';
--
-- 2. Check trigger:
-- SELECT trigger_name, event_object_table, action_timing, event_manipulation
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND trigger_name = 'trigger_notify_vendor_service_request';

