-- Add location column to profiles table
-- This allows vendors to store their location in the profiles table
-- Location will be stored for vendors only (users will have NULL location)

begin;

-- Step 1: Add location column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'location'
  ) then
    alter table public.profiles 
      add column location text;
    
    raise notice 'Added location column to profiles table';
  else
    raise notice 'location column already exists in profiles table';
  end if;
end $$;

-- Step 2: Create an index on location for better query performance
create index if not exists idx_profiles_location on public.profiles(location) where location is not null;

-- Step 3: For backward compatibility, copy location from vendors table to profiles table
-- This ensures existing vendors have location in profiles table
do $$
begin
  update public.profiles p
  set location = v.location
  from public.vendors v
  where p.id = v.profile_id
    and p.location is null
    and v.location is not null;
  
  raise notice 'Copied location from vendors table to profiles table for existing vendors';
end $$;

commit;

-- Verification queries (run separately to confirm):
--
-- 1. Check if location column exists:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'profiles' 
--   AND column_name = 'location';
--
-- 2. Check locations for vendors:
-- SELECT p.id, p.name, p.role, p.location, v.location as vendor_location
-- FROM public.profiles p
-- LEFT JOIN public.vendors v ON p.id = v.profile_id
-- WHERE p.role = 'vendor';
--
-- 3. Check index:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'profiles' 
--   AND schemaname = 'public'
--   AND indexname = 'idx_profiles_location';






