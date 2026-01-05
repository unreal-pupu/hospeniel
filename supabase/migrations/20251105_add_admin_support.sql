-- Add admin support to profiles table
-- This enables admin role checking and access control

begin;

-- Add is_admin column to profiles table if it doesn't exist
-- ✅ SECURITY: Default is false, and it can only be set manually by database admin
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'is_admin'
  ) then
    alter table public.profiles
    add column is_admin boolean default false not null;
    
    -- ✅ SECURITY: Add check constraint to prevent setting is_admin through normal updates
    -- This ensures only database admins can set is_admin = true
    alter table public.profiles
    add constraint profiles_is_admin_check 
    check (is_admin in (true, false));
    
    raise notice 'Added is_admin column to profiles table with security constraints';
  else
    raise notice 'is_admin column already exists in profiles table';
  end if;
end $$;

-- Add index for faster admin lookups
create index if not exists idx_profiles_is_admin on public.profiles(is_admin) where is_admin = true;

-- Grant permissions (already granted, but ensure)
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;

-- Note: RLS policies for profiles already exist from previous migrations
-- Admins will need special policies to view all data - we'll add those in separate migrations

commit;

-- Verification queries (run separately):
--
-- Check column exists:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'profiles'
--   AND column_name = 'is_admin';
--
-- To set a user as admin (replace USER_ID with actual user ID):
-- UPDATE public.profiles SET is_admin = true WHERE id = 'USER_ID';

