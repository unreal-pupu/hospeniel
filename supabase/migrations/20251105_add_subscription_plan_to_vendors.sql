-- Add subscription_plan column to vendors table
-- This tracks vendor subscription level: free_trial, starter, professional

begin;

-- Add subscription_plan column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'subscription_plan'
  ) then
    alter table public.vendors 
      add column subscription_plan text default 'free_trial' not null
      check (subscription_plan in ('free_trial', 'starter', 'professional'));
    
    raise notice 'Added subscription_plan column to vendors table';
  else
    raise notice 'subscription_plan column already exists in vendors table';
  end if;
end $$;

-- Create index for better query performance
create index if not exists idx_vendors_subscription_plan on public.vendors(subscription_plan);

-- Update existing vendors: set all to 'free_trial' by default
-- The default value is already 'free_trial', but we ensure all existing rows have it set
do $$
begin
  -- Only update rows where subscription_plan is NULL (shouldn't happen with NOT NULL default, but safe to check)
  update public.vendors
  set subscription_plan = 'free_trial'
  where subscription_plan is null;
  
  raise notice 'Updated existing vendors subscription plans to free_trial';
end $$;

commit;

-- Verification query (run separately):
--
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'vendors' 
--   AND column_name = 'subscription_plan';

