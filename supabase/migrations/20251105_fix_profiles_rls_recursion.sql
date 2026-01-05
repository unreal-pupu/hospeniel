-- Fix infinite recursion in profiles RLS policies
-- The issue: Policies that check if user is admin by querying profiles table
-- cause infinite recursion because they trigger the same policies again.
--
-- Solution: Use a security definer function to check admin status
-- This function bypasses RLS and can safely check if a user is admin
--
-- This migration is safe to run multiple times (idempotent)

begin;

-- ============================================
-- Step 1: Create helper function to check admin status
-- ============================================
-- This function uses security definer to bypass RLS when checking admin status
create or replace function public.is_admin(user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  _is_admin boolean;
begin
  -- This query bypasses RLS because the function is security definer
  -- It safely checks if a user is admin without triggering RLS policies
  select coalesce(is_admin, false) into _is_admin
  from public.profiles
  where id = user_id;
  
  return coalesce(_is_admin, false);
end;
$$;

-- Grant execute permission to authenticated users and service role
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to service_role;

-- ============================================
-- Step 2: Drop all existing policies on profiles (if they exist)
-- ============================================
-- Drop policies in reverse order to avoid dependency issues
drop policy if exists "Public can view profiles for listings" on public.profiles;
drop policy if exists "Anyone can view profiles" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can view own profile with admin status" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;

-- ============================================
-- Step 3: Create new policies in correct order
-- ============================================
-- Policy order matters: PostgreSQL evaluates policies in order
-- More specific policies should come first

-- Policy 1: Users can ALWAYS view their own profile (highest priority)
-- This must come first to prevent recursion when users query their own profile
-- This policy is simple and fast: id = auth.uid() requires no table lookups
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- Policy 2: Users can update their own profile
-- Allows users to update their own subscription_plan, is_premium, etc.
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Policy 3: Admins can view all profiles
-- Uses is_admin() function which bypasses RLS (no recursion)
create policy "Admins can view all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- Policy 4: Admins can update all profiles
-- Uses is_admin() function which bypasses RLS (no recursion)
create policy "Admins can update all profiles"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Policy 5: Allow viewing profiles for public listings
-- This is needed for the Explore page to show vendor information
-- Note: This policy allows viewing, but the "own profile" policy takes precedence
-- due to more specific matching (id = auth.uid() vs true)
create policy "Public can view profiles for listings"
  on public.profiles
  for select
  to authenticated
  using (true);

-- ============================================
-- Step 4: Update trigger functions to use the helper function
-- ============================================

-- Update prevent_admin_self_promotion function to use is_admin() helper
-- This function is already security definer, but we update it to use the helper
create or replace function public.prevent_admin_self_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count integer;
  current_user_is_admin boolean;
  is_service_role boolean;
begin
  -- Only check if is_admin is being changed from false to true
  if new.is_admin = true and (old.is_admin is null or old.is_admin = false) then
    
    -- BOOTSTRAP: Check if there are any existing admins FIRST
    -- This query runs in security definer context, so it bypasses RLS
    select count(*) into admin_count
    from public.profiles
    where is_admin = true;
    
    -- BOOTSTRAP: If no admins exist, allow this promotion (first admin)
    if admin_count = 0 then
      raise notice 'Bootstrap: Creating first admin (no existing admins found)';
      return new;
    end if;
    
    -- Check if this is being executed by service_role (bypasses RLS)
    begin
      select current_setting('role', true) = 'service_role' into is_service_role;
    exception
      when others then
        is_service_role := false;
    end;
    
    if is_service_role then
      -- Service role can always set admin status (used by migrations/API)
      return new;
    end if;
    
    -- Use is_admin() helper function to check if current user is admin
    -- This avoids recursion because the function uses security definer
    current_user_is_admin := public.is_admin(auth.uid());
    
    -- SECURITY: Only existing admins can promote others
    if not current_user_is_admin then
      raise exception 'Only existing admins can grant admin privileges. If you are setting up the first admin, ensure you are using the service_role or that no admins exist in the database.';
    end if;
    
  end if;
  
  return new;
end;
$$;

-- Ensure the trigger exists (it should already exist from previous migrations)
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trigger_prevent_admin_self_promotion'
    and tgrelid = 'public.profiles'::regclass
  ) then
    create trigger trigger_prevent_admin_self_promotion
      before update on public.profiles
      for each row
      when (new.is_admin is distinct from old.is_admin)
      execute function public.prevent_admin_self_promotion();
  end if;
end $$;

commit;

-- ============================================
-- VERIFICATION QUERIES (run separately if needed)
-- ============================================
--
-- Test the is_admin() function:
-- SELECT public.is_admin(auth.uid());
--
-- Check policies:
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'profiles'
-- ORDER BY policyname;
--
-- Test profile access (should work without recursion):
-- SELECT id, email, name, is_admin FROM public.profiles WHERE id = auth.uid();
--
-- Test admin access (if you're an admin):
-- SELECT id, email, name, is_admin FROM public.profiles LIMIT 10;
--
-- Check function exists:
-- SELECT routine_name, routine_type, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public' AND routine_name = 'is_admin';
