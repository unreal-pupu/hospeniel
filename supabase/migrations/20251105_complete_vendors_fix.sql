-- Complete fix for vendors table: add column, update existing data, and set up RLS
-- This handles both new and existing vendor records

begin;

-- Step 1: Add profile_id column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'profile_id'
  ) then
    -- Add profile_id column that can be nullable initially
    alter table public.vendors 
      add column profile_id uuid;
    
    -- Add foreign key constraint after we populate the data
    -- (We'll do this later to avoid constraint violations)
    
    raise notice 'Added profile_id column to vendors table';
  end if;
end $$;

-- Step 2: Try to populate profile_id for existing vendors
-- This assumes vendors.id or some other field might match profiles.id
-- If your vendors table structure is different, you may need to adjust this
-- For now, we'll leave existing records with NULL profile_id
-- New vendors will have profile_id set via the registration API

-- Step 3: Add foreign key constraint if column was just created
-- Check if foreign key doesn't exist first
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where constraint_schema = 'public' 
    and table_name = 'vendors' 
    and constraint_name = 'vendors_profile_id_fkey'
  ) then
    -- Add foreign key constraint
    alter table public.vendors
      add constraint vendors_profile_id_fkey 
      foreign key (profile_id) references auth.users(id);
    
    raise notice 'Added foreign key constraint for profile_id';
  end if;
end $$;

-- Step 4: Grant permissions to authenticated role
grant usage on schema public to authenticated;
grant select, insert, update on public.vendors to authenticated;

-- Step 5: Enable RLS
alter table if exists public.vendors enable row level security;

-- Step 6: Drop existing policies if any
drop policy if exists "Anyone can view vendors" on public.vendors;
drop policy if exists "Vendors can update own record" on public.vendors;
drop policy if exists "Vendors can insert own record" on public.vendors;

-- Step 7: Create RLS policies

-- Policy 1: Anyone authenticated can view all vendors (public listing)
create policy "Anyone can view vendors"
  on public.vendors
  for select
  to authenticated
  using (true);

-- Policy 2: Vendors can insert their own vendor record
-- profile_id must match auth.uid()
create policy "Vendors can insert own record"
  on public.vendors
  for insert
  to authenticated
  with check (profile_id = auth.uid());

-- Policy 3: Vendors can only update their own vendor record
-- profile_id must match auth.uid()
create policy "Vendors can update own record"
  on public.vendors
  for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

commit;

-- Note: If you have existing vendor records without profile_id,
-- you may need to manually update them to link to the correct user.
-- Example query to update (adjust based on your actual table structure):
-- UPDATE vendors SET profile_id = (SELECT id FROM profiles WHERE ...) WHERE profile_id IS NULL;

-- Verification queries (run separately):
--
-- Check columns:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'vendors';
--
-- Check constraints:
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints 
-- WHERE table_schema = 'public' AND table_name = 'vendors';
--
-- Check RLS policies:
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'vendors';
































