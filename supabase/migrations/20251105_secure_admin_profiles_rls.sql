-- Secure admin profiles with RLS
-- Only admins can view other admin profiles
-- Non-admins cannot see is_admin field or admin accounts

begin;

-- NOTE: Profile RLS policies are now handled by 20251105_fix_profiles_rls_recursion.sql
-- to avoid infinite recursion. Do not create policies here that query the profiles table
-- directly, as this causes infinite recursion.

-- Create helper function if it doesn't exist (used by trigger functions)
create or replace function is_admin(user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _is_admin boolean;
begin
  -- This query bypasses RLS because the function is security definer
  select coalesce(is_admin, false) into _is_admin
  from public.profiles
  where id = user_id;
  
  return coalesce(_is_admin, false);
end;
$$;

grant execute on function is_admin(uuid) to authenticated;
grant execute on function is_admin(uuid) to service_role;

-- Policy: Prevent non-admins from updating is_admin field
-- This is enforced at the application level, but we add a check constraint
-- Note: RLS policies can't prevent specific column updates, but we can add a trigger

-- Create function to prevent non-admin users from setting is_admin = true
-- ✅ BOOTSTRAP SUPPORT: Allows creating first admin when no admins exist
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

-- Create trigger to enforce admin promotion rules
drop trigger if exists trigger_prevent_admin_self_promotion on public.profiles;
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

-- Verification queries (run separately):
--
-- Check trigger exists:
-- SELECT trigger_name, event_object_table, action_timing, event_manipulation
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND trigger_name = 'trigger_prevent_admin_self_promotion';
--
-- Test: Try to set is_admin = true as non-admin (should fail):
-- UPDATE public.profiles SET is_admin = true WHERE id = auth.uid();
-- (This should raise an error if you're not an admin)

