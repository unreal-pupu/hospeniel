-- Add rider role support and approval status to profiles table
-- This enables rider registration with pending approval workflow

begin;

-- Step 1: Add rider_approval_status column to profiles table
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'rider_approval_status'
  ) then
    alter table public.profiles
    add column rider_approval_status text default null;
    
    -- Add check constraint for approval status
    alter table public.profiles
    add constraint profiles_rider_approval_status_check 
    check (rider_approval_status is null or rider_approval_status in ('pending', 'approved', 'rejected'));
    
    raise notice 'Added rider_approval_status column to profiles table';
  else
    raise notice 'rider_approval_status column already exists in profiles table';
  end if;
end $$;

-- Step 2: Create index for faster rider lookups
create index if not exists idx_profiles_rider_status 
  on public.profiles(rider_approval_status) 
  where rider_approval_status is not null;

-- Step 3: Create index for role-based queries
create index if not exists idx_profiles_role_rider 
  on public.profiles(role) 
  where role = 'rider';

-- Step 4: Create function to notify admin when rider registers
create or replace function notify_admin_rider_registration()
returns trigger as $$
declare
  admin_user_id uuid;
  rider_name text;
begin
  -- Only trigger for new rider registrations
  if new.role = 'rider' and (old is null or old.role != 'rider') then
    -- Get rider name
    rider_name := coalesce(new.name, new.email, 'New Rider');
    
    -- Notify all admin users
    for admin_user_id in 
      select id from profiles where is_admin = true
    loop
      insert into notifications (
        vendor_id,
        type,
        message,
        read,
        created_at,
        metadata
      ) values (
        admin_user_id,
        'system',
        'New rider registration: ' || rider_name || ' is waiting for approval.',
        false,
        now(),
        jsonb_build_object(
          'type', 'rider_registration',
          'rider_id', new.id,
          'rider_name', rider_name,
          'rider_email', new.email
        )
      );
    end loop;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Step 5: Create trigger to notify admin on rider registration
drop trigger if exists notify_admin_rider_registration_trigger on profiles;
create trigger notify_admin_rider_registration_trigger
  after insert or update on profiles
  for each row
  execute function notify_admin_rider_registration();

-- Step 6: Grant permissions
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;

commit;

-- Verification queries (run separately):
--
-- Check column exists:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'profiles'
--   AND column_name = 'rider_approval_status';
--
-- Check constraint exists:
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_schema = 'public'
--   AND table_name = 'profiles'
--   AND constraint_name = 'profiles_rider_approval_status_check';






