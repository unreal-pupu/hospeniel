-- Fix vendors table category constraint to match allowed values
-- This ensures the category dropdown only allows valid values
-- Database stores: food_vendor, chef, baker, finger_chop

begin;

-- Drop existing constraint if it exists with wrong values
do $$
begin
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
end $$;

-- Add correct constraint with valid category values (matching profiles table)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where constraint_schema = 'public' 
    and table_name = 'vendors' 
    and constraint_name = 'vendors_category_check'
  ) then
    alter table public.vendors
      add constraint vendors_category_check 
      check (category is null or category in ('food_vendor', 'chef', 'baker', 'finger_chop'));
    raise notice 'Added vendors_category_check constraint';
  end if;
end $$;

commit;

