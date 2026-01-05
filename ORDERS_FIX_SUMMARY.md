# Orders Table Fix - Complete Solution

## Issue
Users received error: "Could not find the 'product_id' column of 'orders' in the schema cache."

## Root Cause
The orders table may be missing the `product_id` column or other required columns, or the schema cache is out of date.

## Solution

### 1. Database Migration
Created comprehensive migration: `supabase/migrations/20251105_fix_orders_table_schema.sql`

This migration:
- ✅ Creates orders table if it doesn't exist
- ✅ Adds `product_id` column if missing
- ✅ Adds all other required columns if missing
- ✅ Ensures correct data types and constraints
- ✅ Sets up proper RLS policies
- ✅ Creates necessary indexes
- ✅ Sets up auto-update trigger for `updated_at`

### 2. Frontend Updates
Enhanced `src/app/explore/page.tsx`:
- ✅ Improved error handling with specific error messages
- ✅ Added validation for required fields
- ✅ Added session verification
- ✅ Better error logging for debugging

## Required Columns

The orders table must have:
- `id` (uuid, primary key, default gen_random_uuid())
- `vendor_id` (uuid, references auth.users(id), not null)
- `user_id` (uuid, references auth.users(id), not null)
- `product_id` (uuid, references menu_items(id), nullable)
- `quantity` (integer, default 1, check > 0)
- `total_price` (numeric(10, 2), not null, check >= 0)
- `status` (text, default 'Pending', check in ('Pending', 'Accepted', 'Completed', 'Cancelled'))
- `created_at` (timestamp with time zone, default now())
- `updated_at` (timestamp with time zone, default now())

## RLS Policies

### For Users (Customers):
- ✅ **SELECT**: Users can view their own orders (`user_id = auth.uid()`)
- ✅ **INSERT**: Users can create orders (`user_id = auth.uid()`)

### For Vendors:
- ✅ **SELECT**: Vendors can view orders where `vendor_id = auth.uid()`
- ✅ **UPDATE**: Vendors can update orders where `vendor_id = auth.uid()`

### Important Notes:
- `vendor_id` in orders references `auth.users(id)`
- `vendors.profile_id` also references `auth.users(id)`
- So `orders.vendor_id = vendors.profile_id` (both reference the same auth.users.id)
- When a vendor logs in, `auth.uid()` returns their user ID, which matches their `profile_id`

## Setup Instructions

### Step 1: Run the Migration

Run the migration in Supabase:
```sql
-- Run: supabase/migrations/20251105_fix_orders_table_schema.sql
```

This will:
1. Create the orders table if it doesn't exist
2. Add any missing columns (including `product_id`)
3. Rename `total_amount` to `total_price` if needed
4. Set up RLS policies
5. Create indexes
6. Set up triggers

### Step 1a: Refresh Schema Cache (Important!)

After running the migration, you may need to refresh the schema cache in Supabase:

1. Go to Supabase Dashboard
2. Navigate to **Settings** → **API**
3. Click **"Reload schema"** or **"Refresh schema cache"**
4. Wait for the cache to refresh (usually takes a few seconds)

Alternatively, you can wait a few minutes for the cache to refresh automatically, or restart your Supabase project.

### Step 2: Verify Table Structure

After running the migration, verify the table structure:
```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'orders'
ORDER BY ordinal_position;
```

You should see all 9 columns listed above.

### Step 3: Verify RLS Policies

Check that RLS policies are set up correctly:
```sql
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'orders';
```

You should see 4 policies:
1. "Vendors can view own orders" (SELECT)
2. "Vendors can update own orders" (UPDATE)
3. "Users can view own orders" (SELECT)
4. "Users can create orders" (INSERT)

### Step 4: Test Order Creation

1. **As a User:**
   - Log in as a regular user
   - Go to Explore page
   - Click "Order Now" on a menu item
   - Verify order is created successfully
   - Check browser console for any errors

2. **As a Vendor:**
   - Log in as a vendor
   - Go to Vendor Dashboard → Orders
   - Verify the order appears in the list
   - Verify all order information is displayed correctly

### Step 5: Test Status Updates

1. **As a Vendor:**
   - Accept a pending order
   - Verify status changes to "Accepted"
   - Mark it as completed
   - Verify status changes to "Completed"

## Troubleshooting

### Error: "Could not find the 'product_id' column"
**Solution**: Run the migration `20251105_fix_orders_table_schema.sql` to add the column.

### Error: "new row violates row-level security"
**Possible causes:**
1. User is not authenticated
2. RLS policy is not set up correctly
3. `user_id` doesn't match `auth.uid()`

**Solution:**
- Verify user is logged in
- Check RLS policies are created
- Verify the insert includes `user_id: auth.uid()`

### Error: "foreign key constraint violation"
**Possible causes:**
1. `vendor_id` doesn't exist in auth.users
2. `product_id` doesn't exist in menu_items
3. `user_id` doesn't exist in auth.users

**Solution:**
- Verify the vendor exists and is properly registered
- Verify the menu item exists
- Verify the user is properly authenticated

### Orders not showing in vendor dashboard
**Possible causes:**
1. `vendor_id` doesn't match vendor's `profile_id`
2. RLS policy is blocking the query
3. Real-time subscription is not working

**Solution:**
- Verify `orders.vendor_id = vendors.profile_id` (both should reference the same auth.users.id)
- Check RLS policies allow vendors to view orders
- Check browser console for errors
- Verify real-time is enabled (optional migration)

## Verification Queries

### Check if product_id column exists:
```sql
SELECT column_name 
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'orders'
  AND column_name = 'product_id';
```

### Check all orders columns:
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'orders'
ORDER BY ordinal_position;
```

### Test order insertion:
```sql
-- Replace with actual values
INSERT INTO public.orders (user_id, vendor_id, product_id, quantity, total_price, status)
VALUES (
  auth.uid(),  -- Your user ID
  'vendor-user-id',  -- Vendor's user ID (from vendors.profile_id)
  'product-id',  -- Menu item ID
  1,
  1000.00,
  'Pending'
);
```

### Check vendor's orders:
```sql
-- This should return orders where vendor_id matches the logged-in vendor's user ID
SELECT * FROM public.orders
WHERE vendor_id = auth.uid()
ORDER BY created_at DESC;
```

## Order Flow

1. **User places order:**
   - User clicks "Order Now" on a menu item
   - Frontend sends: `user_id`, `vendor_id`, `product_id`, `quantity`, `total_price`, `status: "Pending"`
   - Order is inserted into `orders` table

2. **Vendor sees order:**
   - Vendor logs into dashboard
   - Vendor's Orders page queries `orders` where `vendor_id = auth.uid()`
   - Order appears in the list with all details

3. **Vendor updates status:**
   - Vendor clicks "Accept" → status changes to "Accepted"
   - Vendor clicks "Mark as Completed" → status changes to "Completed"
   - Vendor clicks "Cancel" → status changes to "Cancelled"

## Next Steps

After fixing the schema:
1. Test order creation from Explore page
2. Verify orders appear in vendor dashboard
3. Test status updates
4. Verify real-time updates work (if enabled)
5. Test with multiple vendors and users

## Files Modified

1. `supabase/migrations/20251105_fix_orders_table_schema.sql` - Comprehensive schema fix
2. `src/app/explore/page.tsx` - Enhanced error handling and validation

## Additional Notes

- The migration is idempotent (can be run multiple times safely)
- It handles both new tables and existing tables with missing columns
- All constraints and defaults are properly set
- RLS policies ensure data security
- Indexes improve query performance

