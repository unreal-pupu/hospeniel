# Admin Dashboard Setup Guide

## 🔐 Secure Admin Access Setup

### Step 1: Run Database Migrations

Run these migrations in order in your Supabase SQL Editor:

1. `supabase/migrations/20251105_add_admin_support.sql`
   - Adds `is_admin` column to profiles table
   - Sets default to `false` for all users

2. `supabase/migrations/20251105_secure_admin_profiles_rls.sql`
   - Adds RLS policies to prevent self-promotion
   - Creates trigger to prevent non-admins from setting `is_admin = true`

3. `supabase/migrations/20251105_add_admin_rls_policies.sql`
   - Grants admin access to all tables (profiles, vendors, orders, payments, etc.)

### Step 2: Set Your Account as Admin

**✅ IMPORTANT: Run the migration `20251105_fix_admin_bootstrap.sql` first!**
This migration fixes the bootstrap issue and allows creating the first admin.

**Option A: Using Supabase SQL Editor (Recommended - Uses Service Role)**

The Supabase SQL Editor runs with `service_role` privileges, which bypasses the trigger restrictions.

1. Log in to your Supabase dashboard
2. Go to SQL Editor
3. Run this query (replace `YOUR_EMAIL@example.com` with your actual email):

```sql
-- Find your user ID by email
SELECT id, email, name, is_admin FROM public.profiles WHERE email = 'YOUR_EMAIL@example.com';

-- Set yourself as admin (service_role bypasses trigger)
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'YOUR_EMAIL@example.com';

-- Verify it worked
SELECT id, email, name, is_admin FROM public.profiles WHERE email = 'YOUR_EMAIL@example.com';
```

**Option B: Bootstrap Method (If No Admins Exist)**

If there are no existing admins in the database, the trigger will automatically allow the first admin to be created:

```sql
-- Check if any admins exist
SELECT count(*) as admin_count FROM public.profiles WHERE is_admin = true;

-- If count is 0, you can create the first admin
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'YOUR_EMAIL@example.com';
```

**Option C: Using Supabase Dashboard Table Editor**

1. Go to Authentication > Users
2. Find your user account
3. Note the User UID
4. Go to Table Editor > profiles
5. Find your profile row
6. Set `is_admin` to `true`
7. Click Save

**Option D: Temporarily Disable Trigger (Last Resort)**

If the above methods don't work, you can temporarily disable the trigger:

```sql
BEGIN;
ALTER TABLE public.profiles DISABLE TRIGGER trigger_prevent_admin_self_promotion;
UPDATE public.profiles SET is_admin = true WHERE email = 'YOUR_EMAIL@example.com';
ALTER TABLE public.profiles ENABLE TRIGGER trigger_prevent_admin_self_promotion;
COMMIT;
```

### Step 3: (Optional) Set Admin Secret Key

For additional security, you can set an admin secret key:

1. Create a `.env.local` file in your project root (if it doesn't exist)
2. Add this line:
   ```
   ADMIN_SECRET_KEY=your-secret-key-here
   ```
3. Replace `your-secret-key-here` with a strong, random string
4. **Important:** Never commit this file to version control

### Step 4: Verify Access

1. Log out of your account (if logged in)
2. Log back in with your admin account
3. Navigate to `/admin`
4. You should see the admin dashboard
5. If secret key is configured, you'll be prompted to enter it

### Step 5: Test Security

1. Try accessing `/admin` with a non-admin account
2. You should see "Access Denied" message
3. Try registering a new account - it should not be able to set `is_admin = true`

## 🔒 Security Features

### ✅ Implemented Security Measures

1. **Registration Protection**
   - Registration API explicitly rejects `role = "admin"` or `is_admin = true`
   - All new registrations have `is_admin = false` by default
   - Attempts to register as admin delete the created user account

2. **Database-Level Protection**
   - Trigger prevents non-admins from setting `is_admin = true`
   - Only existing admins can promote other users
   - RLS policies restrict admin data access

3. **Route Protection**
   - Admin layout checks `is_admin = true` before rendering
   - Non-admins see "Access Denied" page
   - Admin routes are hidden from navbar

4. **Optional Secret Key**
   - Additional layer of security via environment variable
   - Server-side verification
   - Stored in sessionStorage for the session

### 🚫 What Users Cannot Do

- ❌ Register as admin through the registration form
- ❌ Set `is_admin = true` through API calls
- ❌ Access `/admin` routes without admin privileges
- ❌ See admin links in the navbar
- ❌ Self-promote to admin (database trigger prevents this)

## 📝 Admin Account Management

### To Add Another Admin (After Initial Setup)

Only existing admins can promote others:

1. Log in as admin
2. Go to Admin Dashboard > Users
3. Or run this SQL (as admin):
```sql
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'new-admin@example.com';
```

### To Remove Admin Access

```sql
UPDATE public.profiles 
SET is_admin = false 
WHERE email = 'admin@example.com';
```

## 🛡️ Best Practices

1. **Keep Secret Key Secure**
   - Never commit `ADMIN_SECRET_KEY` to version control
   - Use a strong, random string
   - Rotate periodically if compromised

2. **Monitor Admin Access**
   - Check admin dashboard logs regularly
   - Review who has admin access
   - Remove admin access for inactive accounts

3. **Use Strong Passwords**
   - Admin accounts should have strong, unique passwords
   - Enable 2FA if available

4. **Limit Admin Accounts**
   - Only grant admin access to trusted users
   - Use principle of least privilege

## 🔍 Troubleshooting

### "Access Denied" Even Though I'm Admin

1. Verify `is_admin = true` in profiles table:
   ```sql
   SELECT id, email, is_admin FROM public.profiles WHERE email = 'your-email@example.com';
   ```

2. Clear browser cache and cookies
3. Log out and log back in
4. Check browser console for errors

### Secret Key Not Working

1. Verify `ADMIN_SECRET_KEY` is set in `.env.local`
2. Restart your Next.js development server
3. Check that the key matches exactly (case-sensitive)

### Can't Set Admin Status

- Make sure you're running the migrations in order
- Check that the trigger exists:
  ```sql
  SELECT * FROM information_schema.triggers 
  WHERE trigger_name = 'trigger_prevent_admin_self_promotion';
  ```

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Check Supabase logs
3. Verify all migrations ran successfully
4. Ensure your account has `is_admin = true` in the database

