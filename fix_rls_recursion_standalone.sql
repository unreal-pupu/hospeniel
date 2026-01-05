-- ============================================
-- FIX RLS INFINITE RECURSION ON PROFILES TABLE
-- ============================================
-- Copy and paste this entire file into Supabase SQL Editor
-- This migration fixes the infinite recursion error when loading profiles
-- Safe to run multiple times (idempotent)
-- ============================================

begin;

-- Step 1: Create helper function to check admin status (bypasses RLS)
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
  select coalesce(is_admin, false) into _is_admin
  from public.profiles
  where id = user_id;
  return coalesce(_is_admin, false);
end;
$$;

-- Grant execute permission
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to service_role;

-- Step 2: Drop all existing policies on profiles
drop policy if exists "Public can view profiles for listings" on public.profiles;
drop policy if exists "Anyone can view profiles" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can view own profile with admin status" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;

-- Step 3: Create new policies in correct order
-- Policy 1: Users can view their own profile (highest priority, no recursion)
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- Policy 2: Users can update their own profile
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Policy 3: Admins can view all profiles (uses is_admin function, no recursion)
create policy "Admins can view all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- Policy 4: Admins can update all profiles (uses is_admin function, no recursion)
create policy "Admins can update all profiles"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Policy 5: Public can view profiles for listings (for Explore page)
create policy "Public can view profiles for listings"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Step 4: Update trigger function to use is_admin helper
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
  if new.is_admin = true and (old.is_admin is null or old.is_admin = false) then
    select count(*) into admin_count from public.profiles where is_admin = true;
    if admin_count = 0 then
      raise notice 'Bootstrap: Creating first admin';
      return new;
    end if;
    begin
      select current_setting('role', true) = 'service_role' into is_service_role;
    exception
      when others then
        is_service_role := false;
    end;
    if is_service_role then
      return new;
    end if;
    current_user_is_admin := public.is_admin(auth.uid());
    if not current_user_is_admin then
      raise exception 'Only existing admins can grant admin privileges';
    end if;
  end if;
  return new;
end;
$$;

commit;

-- ============================================
-- VERIFICATION (run these separately to test)
-- ============================================
-- SELECT public.is_admin(auth.uid());
-- SELECT id, email, name, is_admin FROM public.profiles WHERE id = auth.uid();





