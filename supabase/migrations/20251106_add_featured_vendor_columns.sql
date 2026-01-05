-- Add featured vendor columns to profiles table
-- This enables admins to mark vendors as featured on the landing page
--
-- Columns added:
-- - is_featured: boolean flag to mark vendor as featured
-- - featured_description: optional description for featured vendor display
-- - featured_image: optional image URL for featured vendor display

begin;

-- Step 1: Add is_featured column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'is_featured'
  ) then
    alter table public.profiles
    add column is_featured boolean default false not null;
    
    raise notice 'Added is_featured column to profiles table';
  else
    raise notice 'is_featured column already exists in profiles table';
  end if;
end $$;

-- Step 2: Add featured_description column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'featured_description'
  ) then
    alter table public.profiles
    add column featured_description text;
    
    raise notice 'Added featured_description column to profiles table';
  else
    raise notice 'featured_description column already exists in profiles table';
  end if;
end $$;

-- Step 3: Add featured_image column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'featured_image'
  ) then
    alter table public.profiles
    add column featured_image text;
    
    raise notice 'Added featured_image column to profiles table';
  else
    raise notice 'featured_image column already exists in profiles table';
  end if;
end $$;

-- Step 4: Create index for faster featured vendor queries
create index if not exists idx_profiles_is_featured 
  on public.profiles(is_featured) 
  where is_featured = true;

-- Step 5: Create trigger function to prevent non-admins from setting is_featured
-- This ensures only admins can mark vendors as featured
create or replace function public.prevent_non_admin_featured_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_is_admin boolean;
  is_service_role boolean;
begin
  -- Only check if is_featured is being changed
  if new.is_featured is distinct from old.is_featured then
    
    -- Check if this is being executed by service_role (bypasses RLS)
    begin
      select current_setting('role', true) = 'service_role' into is_service_role;
    exception
      when others then
        is_service_role := false;
    end;
    
    if is_service_role then
      -- Service role can always set featured status (used by migrations/API)
      return new;
    end if;
    
    -- Use is_admin() helper function to check if current user is admin
    current_user_is_admin := public.is_admin(auth.uid());
    
    -- SECURITY: Only admins can set is_featured
    if not current_user_is_admin then
      -- Allow users to set is_featured to false (removing themselves from featured)
      -- But prevent them from setting it to true
      if new.is_featured = true then
        raise exception 'Only admins can mark vendors as featured.';
      end if;
      -- If setting to false, allow it (vendor removing themselves from featured)
      return new;
    end if;
    
  end if;
  
  return new;
end;
$$;

-- Step 6: Create trigger to enforce featured vendor restrictions
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trigger_prevent_non_admin_featured_update'
    and tgrelid = 'public.profiles'::regclass
  ) then
    create trigger trigger_prevent_non_admin_featured_update
      before update on public.profiles
      for each row
      when (new.is_featured is distinct from old.is_featured)
      execute function public.prevent_non_admin_featured_update();
    
    raise notice 'Created trigger to prevent non-admin featured updates';
  else
    raise notice 'Trigger already exists';
  end if;
end $$;

-- Step 7: Grant execute permission on trigger function
grant execute on function public.prevent_non_admin_featured_update() to authenticated;
grant execute on function public.prevent_non_admin_featured_update() to service_role;

-- Note: RLS policies already allow admins to update all profiles
-- The trigger above provides an additional layer of security

commit;

-- ============================================
-- VERIFICATION QUERIES (run separately if needed)
-- ============================================
--
-- Check columns exist:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'profiles'
--   AND column_name IN ('is_featured', 'featured_description', 'featured_image');
--
-- Check index exists:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public' 
--   AND tablename = 'profiles'
--   AND indexname = 'idx_profiles_is_featured';
--
-- Check trigger exists:
-- SELECT tgname, tgrelid::regclass
-- FROM pg_trigger
-- WHERE tgname = 'trigger_prevent_non_admin_featured_update';
--
-- Test query for featured vendors:
-- SELECT id, name, email, is_featured, featured_description, featured_image
-- FROM public.profiles
-- WHERE is_featured = true
--   AND role = 'vendor';




