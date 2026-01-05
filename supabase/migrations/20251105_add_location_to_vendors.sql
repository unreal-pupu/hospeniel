-- Add location column to vendors table
-- This allows vendors to specify their location (e.g., Bayelsa, Port Harcourt)

begin;

-- Step 1: Add location column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'location'
  ) then
    alter table public.vendors 
      add column location text;
    
    raise notice 'Added location column to vendors table';
  else
    raise notice 'location column already exists';
  end if;
end $$;

-- Step 2: Create an index on location for better query performance
create index if not exists idx_vendors_location on public.vendors(location);

commit;

-- Verification query (run separately):
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'location';












