# Orders Foreign Key Constraint Fix

## Problem
Users were unable to place orders due to a foreign key constraint violation:
```
"Data validation error: insert or update on table 'orders' violates foreign key constraint 'orders_user_id_fkey'"
```

## Root Cause
The foreign key constraint `orders_user_id_fkey` was likely referencing the wrong table (e.g., a non-existent `users` table in the `public` schema) instead of `auth.users(id)`.

## Solution

### 1. Database Migration
Created a new migration file: `supabase/migrations/20251105_fix_orders_foreign_keys.sql`

This migration:
- Drops any existing foreign key constraints that reference incorrect tables
- Ensures `user_id` and `vendor_id` columns reference `auth.users(id)` correctly
- Ensures `product_id` column references `public.menu_items(id)` correctly
- Creates proper indexes for performance

### 2. Frontend Validation
Added comprehensive validation in all order creation flows:

#### Files Updated:
- `src/app/cart/page.tsx`
- `src/app/explore/page.tsx`
- `src/app/vendors/[id]/page.tsx`

#### Validations Added:
1. **User Authentication**: Verifies user is authenticated and session is valid
2. **UUID Validation**: Validates that `user_id`, `vendor_id`, and `product_id` are valid UUIDs
3. **Required Fields**: Ensures all required fields are present before inserting
4. **Debug Logging**: Adds console logs to help diagnose issues

## How to Apply the Fix

### Step 1: Run the Migration
Apply the migration to your Supabase database:

```bash
# Using Supabase CLI
supabase migration up

# Or apply directly in Supabase Dashboard SQL Editor
# Copy and paste the contents of: supabase/migrations/20251105_fix_orders_foreign_keys.sql
```

### Step 2: Verify Foreign Key Constraints
Run this query in Supabase SQL Editor to verify the constraints:

```sql
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'orders';
```

**Expected Results:**
- `orders_user_id_fkey`: `user_id` → `auth.users(id)`
- `orders_vendor_id_fkey`: `vendor_id` → `auth.users(id)`
- `orders_product_id_fkey`: `product_id` → `public.menu_items(id)`

### Step 3: Verify User Exists
Verify that the authenticated user exists in `auth.users`:

```sql
SELECT id, email, created_at 
FROM auth.users 
LIMIT 10;
```

### Step 4: Test Order Creation
1. Log in as a user
2. Add items to cart or place a direct order
3. Check browser console for debug logs
4. Verify order appears in vendor dashboard

## Expected Behavior After Fix

### For Users:
- ✅ Can place orders from cart
- ✅ Can place direct orders from explore page
- ✅ Can place orders from vendor profile page
- ✅ Clear error messages if validation fails

### For Vendors:
- ✅ Can see new orders in real-time
- ✅ Orders show correct user and product information
- ✅ Can update order status

## Troubleshooting

### If the error persists:

1. **Check Console Logs**: Look for debug logs showing the user ID and order data being inserted

2. **Verify User ID**: Ensure the user ID from `auth.getUser()` matches an ID in `auth.users`:
   ```sql
   SELECT id FROM auth.users WHERE id = 'USER_ID_HERE';
   ```

3. **Verify Vendor ID**: Ensure the vendor's `profile_id` exists in `auth.users`:
   ```sql
   SELECT id FROM auth.users WHERE id = 'VENDOR_PROFILE_ID_HERE';
   ```

4. **Verify Product ID**: Ensure the product ID exists in `menu_items`:
   ```sql
   SELECT id FROM public.menu_items WHERE id = 'PRODUCT_ID_HERE';
   ```

5. **Check RLS Policies**: Ensure RLS policies allow order insertion:
   ```sql
   SELECT * FROM pg_policies 
   WHERE schemaname = 'public' 
   AND tablename = 'orders';
   ```

6. **Re-run Migration**: If constraints are still incorrect, you may need to manually drop and recreate them:
   ```sql
   -- Drop constraint
   ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey CASCADE;
   
   -- Recreate with correct reference
   ALTER TABLE public.orders
   ADD CONSTRAINT orders_user_id_fkey
   FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
   ```

## Database Schema

### Orders Table Structure:
```sql
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_price numeric(10, 2) NOT NULL CHECK (total_price >= 0),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Completed', 'Cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### RLS Policies:
- **Users can create orders**: `user_id = auth.uid()`
- **Users can view own orders**: `user_id = auth.uid()`
- **Vendors can view own orders**: `vendor_id = auth.uid()`
- **Vendors can update own orders**: `vendor_id = auth.uid()`

## Notes

- Both `user_id` and `vendor_id` reference `auth.users(id)` because both users and vendors are authenticated through Supabase Auth
- Vendors are identified by their `profile_id` in the `vendors` table, which also references `auth.users(id)`
- The `product_id` can be null if a menu item is deleted (soft delete behavior)
- All IDs must be valid UUIDs matching the format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`







