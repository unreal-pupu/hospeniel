-- Fix admin bootstrap: Allow creating first admin when no admins exist
-- This solves the chicken-and-egg problem of needing an admin to create an admin

begin;

-- Drop existing trigger and function to recreate with bootstrap support
drop trigger if exists trigger_prevent_admin_self_promotion on public.profiles;
drop function if exists prevent_admin_self_promotion();

-- Create improved function that allows bootstrap (first admin creation)
create or replace function prevent_admin_self_promotion()
returns trigger as $$
declare
  admin_count integer;
  current_user_is_admin boolean;
  is_service_role boolean;
begin
  -- Only check if is_admin is being changed from false to true
  if new.is_admin = true and (old.is_admin is null or old.is_admin = false) then
    
    -- ✅ BOOTSTRAP: Check if there are any existing admins FIRST
    -- This allows creating the first admin even without service_role detection
    select count(*) into admin_count
    from public.profiles
    where is_admin = true;
    
    -- ✅ BOOTSTRAP: If no admins exist, allow this promotion (first admin)
    if admin_count = 0 then
      raise notice 'Bootstrap: Creating first admin (no existing admins found)';
      return new;
    end if;
    
    -- Check if this is being executed by service_role (bypasses RLS)
    -- Service role has full access and can set admin status
    -- Note: This check comes after bootstrap to allow first admin creation
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
    
    -- If admins exist, check if current user is an admin
    -- Note: We need to check the OLD record to see if the user being updated is already admin
    -- OR check if the auth.uid() is an admin
    select exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    ) into current_user_is_admin;
    
    -- ✅ SECURITY: Only existing admins can promote others
    if not current_user_is_admin then
      raise exception 'Only existing admins can grant admin privileges. If you are setting up the first admin, ensure you are using the service_role or that no admins exist in the database.';
    end if;
    
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Recreate trigger
create trigger trigger_prevent_admin_self_promotion
  before update on public.profiles
  for each row
  when (new.is_admin is distinct from old.is_admin)
  execute function prevent_admin_self_promotion();

-- Also handle INSERT case (when creating new profiles with is_admin = true)
create or replace function prevent_admin_on_insert()
returns trigger as $$
declare
  admin_count integer;
  is_service_role boolean;
begin
  -- Only check if is_admin is being set to true on insert
  if new.is_admin = true then
    
    -- ✅ BOOTSTRAP: Check if there are any existing admins FIRST
    select count(*) into admin_count
    from public.profiles
    where is_admin = true;
    
    -- ✅ BOOTSTRAP: If no admins exist, allow this (first admin)
    if admin_count = 0 then
      raise notice 'Bootstrap: Creating first admin on insert (no existing admins found)';
      return new;
    end if;
    
    -- Check if this is being executed by service_role
    begin
      select current_setting('role', true) = 'service_role' into is_service_role;
    exception
      when others then
        is_service_role := false;
    end;
    
    if is_service_role then
      -- Service role can always set admin status
      return new;
    end if;
    
    -- ✅ SECURITY: Prevent inserting new admin profiles unless user is already admin
    -- This prevents registration API from creating admin accounts
    raise exception 'Cannot create admin account through insert. Admin accounts must be promoted by existing admins or created via service_role.';
    
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for INSERT
drop trigger if exists trigger_prevent_admin_on_insert on public.profiles;
create trigger trigger_prevent_admin_on_insert
  before insert on public.profiles
  for each row
  when (new.is_admin = true)
  execute function prevent_admin_on_insert();

commit;

-- ============================================
-- SETUP INSTRUCTIONS
-- ============================================
-- 
-- To set your account as the first admin, you have two options:
--
-- Option 1: Using Service Role (Recommended for first admin)
-- Run this in Supabase SQL Editor (uses service_role which bypasses trigger):
-- UPDATE public.profiles SET is_admin = true WHERE email = 'your-email@example.com';
--
-- Option 2: If no admins exist, the trigger will allow it
-- Make sure you're logged in as the user you want to make admin, then:
-- UPDATE public.profiles SET is_admin = true WHERE email = 'your-email@example.com';
--
-- Option 3: Temporarily disable trigger (if needed)
-- BEGIN;
-- ALTER TABLE public.profiles DISABLE TRIGGER trigger_prevent_admin_self_promotion;
-- UPDATE public.profiles SET is_admin = true WHERE email = 'your-email@example.com';
-- ALTER TABLE public.profiles ENABLE TRIGGER trigger_prevent_admin_self_promotion;
-- COMMIT;
--
-- ============================================
-- VERIFICATION
-- ============================================
--
-- Check if you're an admin:
-- SELECT id, email, name, is_admin FROM public.profiles WHERE email = 'your-email@example.com';
--
-- Check admin count:
-- SELECT count(*) as admin_count FROM public.profiles WHERE is_admin = true;
--
-- Check trigger exists:
-- SELECT trigger_name, event_object_table, action_timing, event_manipulation
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND trigger_name LIKE '%admin%';

