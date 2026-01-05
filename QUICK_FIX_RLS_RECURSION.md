# Quick Fix: RLS Infinite Recursion Error

## Problem
You're getting this error when trying to log in:
```
Error loading profile: infinite recursion detected in policy for relation "profiles"
```

## Solution
Run the SQL migration to fix the RLS policies on the `profiles` table.

## How to Fix

### Option 1: Use the Standalone SQL File (Recommended)

1. Open the file: `fix_rls_recursion_standalone.sql`
2. Copy the entire contents (everything between `begin;` and `commit;`)
3. Go to your Supabase Dashboard → SQL Editor
4. Paste the SQL code
5. Click "Run" or press `Ctrl+Enter`
6. Wait for "Success" message

### Option 2: Use the Migration File

1. Go to your Supabase Dashboard → SQL Editor
2. Open the file: `supabase/migrations/20251105_fix_profiles_rls_recursion.sql`
3. Copy everything from `begin;` to `commit;` (skip the verification comments at the end)
4. Paste into SQL Editor
5. Click "Run"

## What This Fix Does

1. **Creates `is_admin()` function**: A security definer function that bypasses RLS to check admin status without recursion
2. **Drops old policies**: Removes policies that cause recursion
3. **Creates new policies**: Policies in correct order that use the `is_admin()` function
4. **Updates triggers**: Ensures trigger functions use the new helper function

## Verification

After running the migration, test it:

```sql
-- Test 1: Check if you can load your profile (should work now)
SELECT id, email, name, is_admin 
FROM public.profiles 
WHERE id = auth.uid();

-- Test 2: Check if is_admin() function works
SELECT public.is_admin(auth.uid());

-- Test 3: Check policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY policyname;
```

## Safety

- ✅ **Idempotent**: Safe to run multiple times
- ✅ **Non-destructive**: Doesn't delete data, only updates policies
- ✅ **Backward compatible**: Works with existing users and admin accounts
- ✅ **No downtime**: Can be run while application is running

## If You Still Get Errors

1. **Check if RLS is enabled**:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' AND tablename = 'profiles';
   ```

2. **Check if function exists**:
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' AND routine_name = 'is_admin';
   ```

3. **Check policies**:
   ```sql
   SELECT policyname, cmd, qual 
   FROM pg_policies 
   WHERE tablename = 'profiles';
   ```

4. **Try dropping and recreating**:
   - If you get permission errors, make sure you're using the Supabase SQL Editor (which runs as service_role)

## After Fix

- Users can log in without recursion errors
- Users can view their own profile
- Admins can view all profiles
- Admin dashboard works correctly
- No more infinite recursion

## Need Help?

If you still encounter issues:
1. Check the Supabase logs for detailed error messages
2. Verify your user account exists in the `profiles` table
3. Make sure you're running the SQL as the service role (Supabase SQL Editor does this automatically)





