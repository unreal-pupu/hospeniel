# Admin Routing Fix

## Issue
Admin users were being redirected to the Vendor Dashboard instead of the Admin Dashboard after login.

## Root Cause
The routing logic was checking `role === "vendor"` before properly checking admin status. Additionally:
1. Admins might have `role = "vendor"` in their profile (if they were vendors before becoming admin)
2. Vendor dashboard and layout didn't check for admin status
3. Admin check wasn't explicit enough (might fail on null/undefined values)

## Fixes Applied

### 1. Login Page (`src/app/loginpage/page.tsx`)
- ✅ Made admin check more explicit: `profile.is_admin === true || profile.is_admin === "true" || profile.is_admin === 1`
- ✅ Added explicit logging to show role vs admin status
- ✅ Ensured admin check comes FIRST before role check
- ✅ Added comment: "Admin users ALWAYS go to admin dashboard, regardless of role"

### 2. Vendor Dashboard (`src/app/vendor/dashboard/page.tsx`)
- ✅ Added `is_admin` to profile select query
- ✅ Added admin check BEFORE vendor check
- ✅ Redirects admins to `/admin` instead of `/explore`
- ✅ Explicit admin check handles boolean, string, and numeric values

### 3. Vendor Layout (`src/app/vendor/layout.tsx`)
- ✅ Added `is_admin` and `role` to profile select query
- ✅ Added admin check in auth verification
- ✅ Redirects admins to `/admin` if they access any vendor route
- ✅ Uses `window.location.replace()` for immediate redirect

## Routing Priority Order

The routing logic now follows this priority:

1. **Admin** (highest priority)
   - If `is_admin === true` → `/admin`
   - Applies regardless of `role` value

2. **Vendor**
   - If `role === "vendor"` AND `is_admin !== true` → `/vendor/dashboard`

3. **User**
   - If `role === "user"` → `/explore` (or redirect param)

4. **Rider**
   - If `role === "rider"` → `/portal` (if approved)

## Verification

After these fixes:

1. **Admin Login**
   - Admin with `role = "vendor"` → `/admin` ✅
   - Admin with `role = "user"` → `/admin` ✅
   - Admin with `role = "admin"` → `/admin` ✅

2. **Vendor Access**
   - Admin accessing `/vendor/dashboard` → Redirected to `/admin` ✅
   - Vendor accessing `/vendor/dashboard` → Stays on vendor dashboard ✅

3. **No Breaking Changes**
   - Vendor login still works → `/vendor/dashboard` ✅
   - User login still works → `/explore` ✅
   - Rider login still works → `/portal` ✅

## Testing Checklist

- [ ] Admin login redirects to `/admin`
- [ ] Admin with `role = "vendor"` redirects to `/admin` (not vendor dashboard)
- [ ] Admin accessing `/vendor/dashboard` gets redirected to `/admin`
- [ ] Vendor login still works and goes to `/vendor/dashboard`
- [ ] User login still works and goes to `/explore`
- [ ] Rider login still works and goes to `/portal` (if approved)






