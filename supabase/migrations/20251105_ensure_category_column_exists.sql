-- Ensure category column exists in profiles table
-- This migration can be run safely even if the column already exists
-- Run this if you're getting "Could not find the 'category' column" errors

begin;

-- Add category column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'category'
  ) then
    -- Add column
    alter table public.profiles 
      add column category text;
    
    raise notice '✅ Added category column to profiles table';
  else
    raise notice 'ℹ️ category column already exists in profiles table';
  end if;
end $$;

-- Add constraint if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where constraint_schema = 'public' 
    and table_name = 'profiles' 
    and constraint_name = 'profiles_category_check'
  ) then
    -- Drop existing constraint if it has a different name
    alter table public.profiles
      drop constraint if exists profiles_category_check;
    
    -- Add constraint
    alter table public.profiles
      add constraint profiles_category_check 
      check (category is null or category in ('food_vendor', 'chef', 'baker', 'finger_chop'));
    
    raise notice '✅ Added category constraint to profiles table';
  else
    raise notice 'ℹ️ category constraint already exists in profiles table';
  end if;
end $$;

-- Create index if it doesn't exist
create index if not exists idx_profiles_category 
  on public.profiles(category) 
  where category is not null;

commit;

-- After running this migration, you may need to refresh the PostgREST schema cache:
-- In Supabase Dashboard: Settings > API > Refresh Schema Cache
-- Or wait a few minutes for automatic cache refresh





