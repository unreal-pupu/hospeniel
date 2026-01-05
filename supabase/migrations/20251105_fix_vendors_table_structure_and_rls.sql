-- Fix vendors table structure and RLS policies
-- This handles the case where profile_id might not exist yet

begin;

-- Step 1: Check if profile_id column exists, if not add it
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'profile_id'
  ) then
    -- Add profile_id column that references auth.users(id)
    alter table public.vendors 
      add column profile_id uuid references auth.users(id);
    
    -- If the table has an 'id' column that's numeric, we might need to link it differently
    -- But for now, we'll assume profile_id is the correct linking column
    raise notice 'Added profile_id column to vendors table';
  else
    raise notice 'profile_id column already exists';
  end if;
end $$;

-- Step 2: Grant permissions to authenticated role
grant usage on schema public to authenticated;
grant select, insert, update on public.vendors to authenticated;

-- Step 3: Enable RLS
alter table if exists public.vendors enable row level security;

-- Step 4: Drop existing policies if any
drop policy if exists "Anyone can view vendors" on public.vendors;
drop policy if exists "Vendors can update own record" on public.vendors;
drop policy if exists "Vendors can insert own record" on public.vendors;

-- Step 5: Create RLS policies

-- Policy 1: Anyone authenticated can view all vendors (public listing)
create policy "Anyone can view vendors"
  on public.vendors
  for select
  to authenticated
  using (true);

-- Policy 2: Vendors can insert their own vendor record
create policy "Vendors can insert own record"
  on public.vendors
  for insert
  to authenticated
  with check (profile_id = auth.uid());

-- Policy 3: Vendors can only update their own vendor record
-- profile_id links to auth.users(id) which equals auth.uid()
create policy "Vendors can update own record"
  on public.vendors
  for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

commit;

-- Verification queries (run separately to check):
--
-- Check if profile_id column exists:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'vendors';
--
-- Check grants:
-- SELECT grantee, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' 
--   AND table_name = 'vendors'
--   AND grantee = 'authenticated';
--
-- Check RLS policies:
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'vendors';




















