-- Fix or create trigger on auth.users to auto-create profiles
-- This ensures profiles are created automatically when auth users are created
-- Handles all roles including riders

begin;

-- Step 1: Drop existing trigger if it exists (we'll recreate it)
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists create_profile_for_new_user on auth.users;

-- Step 2: Create or replace function to handle profile creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
  user_email text;
  user_name text;
  has_rider_status boolean;
  has_is_available boolean;
begin
  -- Get role from user_metadata (set during registration)
  user_role := coalesce(
    (new.raw_user_meta_data->>'role')::text,
    'user'  -- Default to 'user' if not specified
  );
  
  -- Get email and name from auth user
  user_email := coalesce(new.email, '');
  user_name := coalesce(
    (new.raw_user_meta_data->>'name')::text,
    split_part(user_email, '@', 1),  -- Use email prefix as fallback
    'User'
  );
  
  -- Check if columns exist (for backward compatibility)
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'rider_approval_status'
  ) into has_rider_status;
  
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'is_available'
  ) into has_is_available;
  
  -- Insert into profiles table with appropriate defaults
  -- Use dynamic SQL to handle optional columns gracefully
  if has_rider_status and has_is_available then
    -- All columns exist - use full insert
    insert into public.profiles (
      id,
      email,
      name,
      role,
      address,
      is_admin,
      rider_approval_status,
      is_available,
      location,
      category,
      phone_number
    ) values (
      new.id,
      user_email,
      user_name,
      user_role,
      '',  -- Address will be updated by registration API
      false,  -- Never auto-create admin accounts
      case 
        when user_role = 'rider' then 'pending'::text
        else null
      end,
      true,  -- Default to true (satisfies NOT NULL constraint)
      null,  -- Location only for vendors
      null,  -- Category only for vendors
      null   -- Phone number will be set by registration API
    )
    on conflict (id) do update set
      role = excluded.role,
      email = excluded.email,
      name = excluded.name;
  elsif has_rider_status then
    -- rider_approval_status exists but is_available doesn't
    insert into public.profiles (
      id,
      email,
      name,
      role,
      address,
      is_admin,
      rider_approval_status,
      location,
      category,
      phone_number
    ) values (
      new.id,
      user_email,
      user_name,
      user_role,
      '',
      false,
      case 
        when user_role = 'rider' then 'pending'::text
        else null
      end,
      null,
      null,
      null
    )
    on conflict (id) do update set
      role = excluded.role,
      email = excluded.email,
      name = excluded.name;
  else
    -- Basic columns only (backward compatibility)
    insert into public.profiles (
      id,
      email,
      name,
      role,
      address,
      is_admin,
      location,
      category,
      phone_number
    ) values (
      new.id,
      user_email,
      user_name,
      user_role,
      '',
      false,
      null,
      null,
      null
    )
    on conflict (id) do update set
      role = excluded.role,
      email = excluded.email,
      name = excluded.name;
  end if;
  
  return new;
exception
  when others then
    -- Log error but don't fail auth user creation
    -- The registration API will create/update the profile anyway
    raise warning 'Failed to create profile for user %: %', new.id, sqlerrm;
    return new;
end;
$$;

-- Step 3: Create trigger on auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Step 4: Grant execute permission
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.handle_new_user() to postgres;

commit;

-- Verification queries (run separately):
--
-- Check trigger exists:
-- SELECT trigger_name, event_object_table, action_timing, event_manipulation
-- FROM information_schema.triggers
-- WHERE event_object_schema = 'auth'
--   AND event_object_table = 'users'
--   AND trigger_name = 'on_auth_user_created';
--
-- Check function exists:
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name = 'handle_new_user';

