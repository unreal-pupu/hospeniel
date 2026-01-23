# Fix for Rider Registration Auth Error

## Issue
Rider registration fails at `auth.admin.createUser()` with error:
```
Error [AuthApiError]: Database error creating new user
status: 500
code: 'unexpected_failure'
```

## Root Cause
Supabase has a trigger on `auth.users` that automatically creates a profile when a new auth user is created. This trigger was failing because:
1. It didn't handle the `rider` role properly
2. It didn't set `rider_approval_status` for riders
3. It didn't handle `is_available` field (which has NOT NULL constraint)
4. It may have been missing or broken

## Solution
Created migration `20250116_fix_auth_users_profile_trigger.sql` that:
1. ✅ Drops any existing broken triggers
2. ✅ Creates/updates `handle_new_user()` function that:
   - Handles all roles including `rider`
   - Sets `rider_approval_status = 'pending'` for riders
   - Sets `is_available = true` (satisfies NOT NULL constraint)
   - Gracefully handles missing columns (backward compatibility)
   - Uses `on conflict do update` to avoid duplicate key errors
   - Catches exceptions and logs warnings without failing auth creation
3. ✅ Creates trigger `on_auth_user_created` on `auth.users`

## Migration Order
Run migrations in this order:

1. `20250116_add_rider_role_and_approval_status.sql` - Adds rider fields
2. `20250116_add_rider_availability.sql` - Adds is_available field
3. `20250116_fix_auth_users_profile_trigger.sql` - **Fixes the trigger** ⭐
4. `20250116_fix_rider_registration_insert_policy.sql` - Adds INSERT policy

## How It Works

### Trigger Flow
1. User calls `auth.admin.createUser()`
2. Supabase creates user in `auth.users`
3. Trigger `on_auth_user_created` fires
4. Function `handle_new_user()` executes:
   - Extracts role from `user_metadata`
   - Creates profile with appropriate defaults
   - For riders: sets `rider_approval_status = 'pending'` and `is_available = true`
5. Registration API then updates profile with full details (address, phone, etc.)

### Error Handling
- If trigger fails, it logs a warning but **doesn't fail auth creation**
- Registration API will create/update profile anyway via upsert
- This ensures auth user is always created, even if trigger has issues

## Verification

### Check Trigger Exists
```sql
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';
```

### Check Function Exists
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';
```

### Test Registration
1. Register as rider
2. Check that auth user is created successfully
3. Check that profile is created with:
   - `role = 'rider'`
   - `rider_approval_status = 'pending'`
   - `is_available = true`

## Why This Fixes The Issue

**Before:**
- Trigger either didn't exist or failed when creating rider profiles
- Auth user creation failed because trigger raised an exception
- Registration couldn't proceed

**After:**
- Trigger handles all roles including riders
- Sets all required fields with proper defaults
- Catches exceptions gracefully
- Auth user creation always succeeds
- Profile is created/updated by trigger or registration API

## Important Notes

1. **The trigger creates a basic profile** - Registration API will update it with full details (address, phone, etc.)

2. **Backward compatibility** - Function checks if columns exist before using them

3. **Error resilience** - If trigger fails, registration API will still create profile via upsert

4. **No breaking changes** - Vendor and user registration continue to work as before






