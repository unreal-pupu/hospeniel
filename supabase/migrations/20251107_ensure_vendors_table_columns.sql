-- Ensure all necessary columns exist in vendors table
-- This migration adds any missing columns that are used by the vendor settings page
-- Also fixes the name column constraint issue

begin;

-- Step 0: Handle name column - make it nullable or set default values for existing records
do $$
begin
  -- Check if name column exists and has NOT NULL constraint
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'name'
    and is_nullable = 'NO'
  ) then
    -- First, update any NULL name values to use business_name or a default
    update public.vendors 
    set name = coalesce(business_name, 'Vendor')
    where name is null or name = '';
    
    -- Then make the column nullable to prevent future issues
    alter table public.vendors 
      alter column name drop not null;
    
    raise notice 'Updated name column: set defaults for NULL values and made column nullable';
  elsif exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'name'
  ) then
    -- Column exists and is nullable, but update any NULL values
    update public.vendors 
    set name = coalesce(business_name, 'Vendor')
    where name is null or name = '';
    
    raise notice 'Updated name column: set defaults for NULL values';
  else
    -- Column doesn't exist, add it as nullable
    alter table public.vendors 
      add column name text;
    
    -- Set initial values from business_name
    update public.vendors 
    set name = coalesce(business_name, 'Vendor')
    where name is null;
    
    raise notice 'Added name column to vendors table';
  end if;
end $$;

-- Step 1: Add address column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'address'
  ) then
    alter table public.vendors 
      add column address text;
    
    raise notice 'Added address column to vendors table';
  else
    raise notice 'address column already exists in vendors table';
  end if;
end $$;

-- Step 2: Add business_name column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'business_name'
  ) then
    alter table public.vendors 
      add column business_name text;
    
    raise notice 'Added business_name column to vendors table';
  else
    raise notice 'business_name column already exists in vendors table';
  end if;
end $$;

-- Step 3: Add email column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'email'
  ) then
    alter table public.vendors 
      add column email text;
    
    raise notice 'Added email column to vendors table';
  else
    raise notice 'email column already exists in vendors table';
  end if;
end $$;

-- Step 4: Add phone_number column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'phone_number'
  ) then
    alter table public.vendors 
      add column phone_number text;
    
    raise notice 'Added phone_number column to vendors table';
  else
    raise notice 'phone_number column already exists in vendors table';
  end if;
end $$;

-- Step 5: Add description column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'description'
  ) then
    alter table public.vendors 
      add column description text;
    
    raise notice 'Added description column to vendors table';
  else
    raise notice 'description column already exists in vendors table';
  end if;
end $$;

-- Step 6: Add image_url column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'image_url'
  ) then
    alter table public.vendors 
      add column image_url text;
    
    raise notice 'Added image_url column to vendors table';
  else
    raise notice 'image_url column already exists in vendors table';
  end if;
end $$;

-- Step 7: Add is_open column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'is_open'
  ) then
    alter table public.vendors 
      add column is_open boolean default true;
    
    raise notice 'Added is_open column to vendors table';
  else
    raise notice 'is_open column already exists in vendors table';
  end if;
end $$;

-- Step 8: Add delivery_enabled column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'delivery_enabled'
  ) then
    alter table public.vendors 
      add column delivery_enabled boolean default true;
    
    raise notice 'Added delivery_enabled column to vendors table';
  else
    raise notice 'delivery_enabled column already exists in vendors table';
  end if;
end $$;

-- Step 9: Add pickup_enabled column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vendors' 
    and column_name = 'pickup_enabled'
  ) then
    alter table public.vendors 
      add column pickup_enabled boolean default true;
    
    raise notice 'Added pickup_enabled column to vendors table';
  else
    raise notice 'pickup_enabled column already exists in vendors table';
  end if;
end $$;

-- Step 10: Ensure name column has default values for any remaining NULL records
-- This must be done before commit to ensure data integrity
do $$
begin
  update public.vendors 
  set name = coalesce(business_name, 'Vendor')
  where name is null or name = '';
  
  if found then
    raise notice 'Updated any remaining NULL name values';
  end if;
end $$;

commit;

-- Verification query (run separately to confirm all columns exist):
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'vendors'
-- ORDER BY column_name;

-- Check for any NULL name values (should be none after migration):
-- SELECT id, profile_id, name, business_name 
-- FROM public.vendors 
-- WHERE name IS NULL OR name = '';

