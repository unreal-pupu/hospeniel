# Rider Registration Fix

## Issue
Rider registration was failing with "Database error creating new user" error.

## Root Causes Identified

1. **Missing `is_available` field**: The registration API wasn't setting `is_available` for riders, but the migration adds this column with `NOT NULL default true`. If the migration hasn't been run, the column won't exist and the insert will fail.

2. **Missing INSERT RLS Policy**: While the registration API uses `service_role` which bypasses RLS, having an explicit INSERT policy ensures consistency.

3. **Insufficient error logging**: The error message wasn't surfacing the exact Supabase error details.

## Fixes Applied

### 1. Updated Registration API (`src/app/api/register/route.ts`)
- ✅ Added `is_available: true` for rider registrations
- ✅ Improved error logging to show exact Supabase error message, code, details, and hint
- ✅ Added cleanup: delete auth user if profile creation fails
- ✅ Added `rider_approval_status` and `is_available` to TypeScript type definition

### 2. Created INSERT Policy Migration (`20250116_fix_rider_registration_insert_policy.sql`)
- ✅ Adds explicit INSERT policy for profiles table
- ✅ Allows users to insert their own profile (id = auth.uid())
- ✅ Ensures service_role has INSERT permission

## Required Migrations

Run these migrations in order:

1. ✅ `20250116_add_rider_role_and_approval_status.sql` - Adds rider approval status
2. ✅ `20250116_add_rider_availability.sql` - Adds is_available column
3. ✅ `20250116_fix_rider_registration_insert_policy.sql` - Adds INSERT policy

## Verification Steps

### 1. Check Migrations Are Run
```sql
-- Check rider_approval_status column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name = 'rider_approval_status';

-- Check is_available column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name = 'is_available';

-- Check INSERT policy exists
SELECT tablename, policyname, cmd, with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
  AND cmd = 'INSERT';
```

### 2. Test Rider Registration
1. Go to `/register`
2. Select "Rider" as account type
3. Fill in all required fields
4. Submit registration
5. Check browser console for detailed error messages if it fails
6. Verify rider is created with:
   - `role = 'rider'`
   - `rider_approval_status = 'pending'`
   - `is_available = true`

### 3. Check Error Logs
If registration still fails, check:
- Browser console for detailed error
- Server logs for exact Supabase error message
- The error should now include: message, code, details, and hint

## Common Issues

### Issue: Column doesn't exist
**Solution**: Run the migrations in order

### Issue: Constraint violation
**Solution**: Check that:
- `rider_approval_status` is one of: `null`, `'pending'`, `'approved'`, `'rejected'`
- `role` doesn't have a constraint blocking `'rider'` (should be text/varchar without constraint)

### Issue: RLS blocking insert
**Solution**: 
- Registration API uses `service_role` which bypasses RLS
- If still failing, run the INSERT policy migration
- Verify service_role has INSERT permission

### Issue: Trigger failing
**Solution**: Check the `notify_admin_rider_registration` trigger:
- Should not fail if no admins exist (should just skip notification)
- Check trigger logs in Supabase

## Testing Checklist

- [ ] All 3 migrations run successfully
- [ ] Rider registration completes without errors
- [ ] Rider profile created with correct fields:
  - [ ] `role = 'rider'`
  - [ ] `rider_approval_status = 'pending'`
  - [ ] `is_available = true`
  - [ ] `phone_number` set correctly
  - [ ] `address` set correctly
- [ ] Admin receives notification (if admins exist)
- [ ] Error messages are detailed and helpful
- [ ] Vendor and user registration still work






