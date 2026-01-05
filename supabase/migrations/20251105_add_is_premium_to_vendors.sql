-- Add is_premium column to vendors table
-- This tracks whether a vendor has premium subscription for service requests

begin;

-- Add is_premium column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'is_premium'
  ) then
    alter table public.vendors 
      add column is_premium boolean default false not null;
    
    raise notice 'Added is_premium column to vendors table';
  else
    raise notice 'is_premium column already exists in vendors table';
  end if;
end $$;

-- Create index for better query performance
create index if not exists idx_vendors_is_premium on public.vendors(is_premium) where is_premium = true;

commit;

-- Verification query (run separately):
--
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'vendors' 
--   AND column_name = 'is_premium';





