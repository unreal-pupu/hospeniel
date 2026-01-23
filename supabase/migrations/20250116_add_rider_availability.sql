-- Add is_available field to profiles table for rider availability management
-- This enables riders to toggle their availability status

begin;

-- Step 1: Add is_available column to profiles table
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'is_available'
  ) then
    alter table public.profiles
    add column is_available boolean default true not null;
    
    raise notice 'Added is_available column to profiles table';
  else
    raise notice 'is_available column already exists in profiles table';
  end if;
end $$;

-- Step 2: Create index for faster availability queries
create index if not exists idx_profiles_rider_availability 
  on public.profiles(role, is_available) 
  where role = 'rider';

-- Step 3: Grant permissions
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;

commit;

-- Verification query (run separately):
--
-- Check column exists:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'profiles'
--   AND column_name = 'is_available';






