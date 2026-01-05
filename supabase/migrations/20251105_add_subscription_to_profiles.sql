-- Add subscription and category columns to profiles table
-- This enables vendor type classification and subscription management

begin;

-- Step 1: Add category column to profiles table
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'category'
  ) then
    -- Add column without constraint first
    alter table public.profiles 
      add column category text;
    
    -- Add check constraint separately to avoid issues
    alter table public.profiles
      add constraint profiles_category_check 
      check (category is null or category in ('food_vendor', 'chef', 'baker', 'finger_chop'));
    
    raise notice 'Added category column to profiles table';
  else
    -- Column exists, but ensure constraint exists
    if not exists (
      select 1 from information_schema.table_constraints 
      where constraint_schema = 'public' 
      and table_name = 'profiles' 
      and constraint_name = 'profiles_category_check'
    ) then
      alter table public.profiles
        add constraint profiles_category_check 
        check (category is null or category in ('food_vendor', 'chef', 'baker', 'finger_chop'));
      raise notice 'Added category constraint to existing column';
    else
      raise notice 'category column and constraint already exist in profiles table';
    end if;
  end if;
end $$;

-- Step 2: Add subscription_plan column to profiles table
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'subscription_plan'
  ) then
    alter table public.profiles 
      add column subscription_plan text default 'free_trial' not null
      check (subscription_plan in ('free_trial', 'starter', 'professional'));
    
    raise notice 'Added subscription_plan column to profiles table';
  else
    raise notice 'subscription_plan column already exists in profiles table';
  end if;
end $$;

-- Step 3: Add is_premium column to profiles table
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'is_premium'
  ) then
    alter table public.profiles 
      add column is_premium boolean default false not null;
    
    raise notice 'Added is_premium column to profiles table';
  else
    raise notice 'is_premium column already exists in profiles table';
  end if;
end $$;

-- Step 4: Create indexes for better query performance
create index if not exists idx_profiles_category on public.profiles(category) where category is not null;
create index if not exists idx_profiles_subscription_plan on public.profiles(subscription_plan);
create index if not exists idx_profiles_is_premium on public.profiles(is_premium) where is_premium = true;

-- Step 5: Update existing vendors to have correct defaults
do $$
begin
  -- Set all existing vendors to free_trial if subscription_plan is null
  update public.profiles
  set subscription_plan = 'free_trial',
      is_premium = false
  where role = 'vendor' 
    and (subscription_plan is null or subscription_plan = '');
  
  -- Sync is_premium with subscription_plan for existing vendors
  update public.profiles
  set is_premium = (subscription_plan = 'professional')
  where role = 'vendor' 
    and subscription_plan is not null;
  
  raise notice 'Updated existing vendor subscription plans';
end $$;

-- Step 6: Create function to automatically sync is_premium with subscription_plan
create or replace function sync_profiles_is_premium()
returns trigger as $$
begin
  -- Automatically set is_premium based on subscription_plan
  if new.subscription_plan = 'professional' then
    new.is_premium = true;
  else
    new.is_premium = false;
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Step 7: Create trigger to auto-sync is_premium
drop trigger if exists trigger_sync_profiles_is_premium on public.profiles;
create trigger trigger_sync_profiles_is_premium
  before insert or update on public.profiles
  for each row
  when (new.role = 'vendor')
  execute function sync_profiles_is_premium();

commit;

-- Verification queries (run separately):
--
-- 1. Check columns:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'profiles' 
--   AND column_name IN ('category', 'subscription_plan', 'is_premium')
-- ORDER BY column_name;
--
-- 2. Check vendor subscription distribution:
-- SELECT subscription_plan, COUNT(*) 
-- FROM profiles 
-- WHERE role = 'vendor'
-- GROUP BY subscription_plan;
--
-- 3. Check is_premium sync:
-- SELECT subscription_plan, is_premium, COUNT(*)
-- FROM profiles
-- WHERE role = 'vendor'
-- GROUP BY subscription_plan, is_premium;

