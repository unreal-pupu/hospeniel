# RLS Infinite Recursion Fix

## Problem

The RLS policies on the `profiles` table were causing infinite recursion when users tried to log in or load their profile. The error was:

```
Error loading profile: infinite recursion detected in policy for relation "profiles"
```

## Root Cause

The admin policies were checking if a user is admin by directly querying the `profiles` table:

```sql
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  )
)
```

When a user tried to read their profile:
1. The policy would query `profiles` to check if they're admin
2. That query would trigger the same RLS policies
3. Which would query `profiles` again
4. Infinite recursion! 🔄

## Solution

Created a `security definer` function `is_admin(user_id uuid)` that bypasses RLS when checking admin status. This function:
- Uses `security definer` to run with elevated privileges
- Bypasses RLS policies when querying the profiles table
- Returns a simple boolean value
- Can be safely used in RLS policies without causing recursion

## Migration Files

### 1. `20251105_fix_profiles_rls_recursion.sql` (Main Fix)

This migration:
- Creates the `is_admin(uuid)` security definer function
- Drops all existing policies on `profiles` table
- Recreates policies in correct order:
  1. **Users can view own profile** (highest priority, no recursion)
  2. **Users can update own profile**
  3. **Admins can view all profiles** (uses `is_admin()` function)
  4. **Admins can update all profiles** (uses `is_admin()` function)
  5. **Public can view profiles for listings** (for Explore page)

### 2. Updated Existing Migrations

- `20251105_add_admin_rls_policies.sql` - Updated to use `is_admin()` function
- `20251105_secure_admin_profiles_rls.sql` - Updated to use `is_admin()` function
- `20251105_add_profiles_rls_policies.sql` - Commented to note policies are in fix migration

## How It Works

### Before (Causing Recursion):
```sql
-- Policy queries profiles table directly
create policy "Admins can view all profiles"
  on public.profiles
  for select
  using (
    exists (
      select 1 from public.profiles  -- ❌ This triggers RLS policies again!
      where id = auth.uid() and is_admin = true
    )
  );
```

### After (No Recursion):
```sql
-- Security definer function bypasses RLS
create or replace function is_admin(user_id uuid)
returns boolean
language plpgsql
security definer  -- ✅ Bypasses RLS!
set search_path = public
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

-- Policy uses the function
create policy "Admins can view all profiles"
  on public.profiles
  for select
  using (is_admin(auth.uid()));  -- ✅ No recursion!
```

## Policy Order Matters

The policies are created in this specific order to ensure correct evaluation:

1. **"Users can view own profile"** - Checks `id = auth.uid()` first (fast, no recursion)
2. **"Users can update own profile"** - Allows users to update their own profile
3. **"Admins can view all profiles"** - Uses `is_admin()` function (no recursion)
4. **"Admins can update all profiles"** - Uses `is_admin()` function (no recursion)
5. **"Public can view profiles for listings"** - Fallback for public listings

PostgreSQL evaluates policies in order and uses the first matching policy.

## Testing

After running the migration, test:

1. **User Login:**
   ```sql
   -- Should work without recursion
   SELECT * FROM public.profiles WHERE id = auth.uid();
   ```

2. **Admin Access:**
   ```sql
   -- Should work without recursion
   SELECT * FROM public.profiles LIMIT 10;
   ```

3. **Function Test:**
   ```sql
   -- Test the is_admin() function
   SELECT is_admin(auth.uid());
   ```

4. **Check Policies:**
   ```sql
   SELECT schemaname, tablename, policyname, cmd, qual
   FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'profiles'
   ORDER BY policyname;
   ```

## Verification

Run these queries to verify the fix:

```sql
-- 1. Check function exists
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'is_admin';

-- 2. Check policies
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- 3. Test function
SELECT is_admin(auth.uid());

-- 4. Test profile access (should work without recursion)
SELECT id, email, name, is_admin 
FROM public.profiles 
WHERE id = auth.uid();
```

## Benefits

1. ✅ **No Recursion** - Security definer function bypasses RLS
2. ✅ **Better Performance** - Function is cached and optimized
3. ✅ **Consistent** - All admin policies use the same function
4. ✅ **Maintainable** - Single function to update if logic changes
5. ✅ **Secure** - Still enforces RLS, but in a non-recursive way

## Important Notes

- The `is_admin()` function must use `security definer` to bypass RLS
- The function must be granted `execute` permission to `authenticated` and `service_role`
- Policy order matters - "own profile" policies should come before admin policies
- The function is safe to use in triggers and other policies

## Related Files

- `supabase/migrations/20251105_fix_profiles_rls_recursion.sql` - Main fix
- `supabase/migrations/20251105_add_admin_rls_policies.sql` - Updated admin policies
- `supabase/migrations/20251105_secure_admin_profiles_rls.sql` - Updated trigger functions
- `supabase/migrations/20251105_add_profiles_rls_policies.sql` - Initial policies (now deprecated)

## Next Steps

1. Run the migration `20251105_fix_profiles_rls_recursion.sql`
2. Test user login - should work without errors
3. Test admin access - should work without errors
4. Verify all policies are using `is_admin()` function
5. Monitor for any remaining recursion issues





