-- Add subaccount_code column to profiles table for Paystack subaccount integration
-- This stores the Paystack subaccount code returned when a subaccount is created

begin;

-- Step 1: Add subaccount_code column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'subaccount_code'
  ) then
    alter table public.profiles 
      add column subaccount_code text;
    
    raise notice 'Added subaccount_code column to profiles table';
  else
    raise notice 'subaccount_code column already exists';
  end if;
end $$;

-- Step 2: Add index on subaccount_code for faster lookups (optional but recommended)
create index if not exists profiles_subaccount_code_idx 
  on public.profiles (subaccount_code) 
  where subaccount_code is not null;

commit;



