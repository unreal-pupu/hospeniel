-- Add 'home_cook' category to vendor category constraints
-- This migration updates the CHECK constraints on both profiles and vendors tables
-- to include the new 'home_cook' category value

begin;

-- Update profiles table constraint
do $$
begin
  -- Drop existing constraint if it exists
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_schema = 'public' 
    and table_name = 'profiles' 
    and constraint_name = 'profiles_category_check'
  ) then
    alter table public.profiles
      drop constraint profiles_category_check;
    raise notice 'Dropped existing profiles_category_check constraint';
  end if;
  
  -- Add updated constraint with home_cook
  alter table public.profiles
    add constraint profiles_category_check 
    check (category is null or category in ('food_vendor', 'chef', 'baker', 'finger_chop', 'home_cook'));
  raise notice 'Added profiles_category_check constraint with home_cook';
end $$;

-- Update vendors table constraint
do $$
begin
  -- Drop existing constraint if it exists
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_schema = 'public' 
    and table_name = 'vendors' 
    and constraint_name = 'vendors_category_check'
  ) then
    alter table public.vendors
      drop constraint vendors_category_check;
    raise notice 'Dropped existing vendors_category_check constraint';
  end if;
  
  -- Add updated constraint with home_cook
  alter table public.vendors
    add constraint vendors_category_check 
    check (category is null or category in ('food_vendor', 'chef', 'baker', 'finger_chop', 'home_cook'));
  raise notice 'Added vendors_category_check constraint with home_cook';
end $$;

commit;







