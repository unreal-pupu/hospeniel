# Safe Migration Guide: Fix Orders Foreign Key Constraints

## Problem
When attempting to alter column types on the `orders` table, PostgreSQL throws an error:
```
Error: cannot alter type of a column used in a policy definition. 
DETAIL: policy Allow vendors to view their orders on table orders depends on column 'user_id'
```

This happens because RLS policies reference the columns we're trying to modify.

## Solution
A safe migration has been created that:
1. **Temporarily drops ALL RLS policies** on the orders table
2. **Fixes column types** (converts to UUID if needed)
3. **Fixes foreign key constraints** (ensures they reference `auth.users(id)`)
4. **Recreates RLS policies** with the correct structure

## Migration File
Use the safe migration: `supabase/migrations/20251105_fix_orders_foreign_keys_safe.sql`

## How to Apply

### Option 1: Using Supabase CLI
```bash
# Apply the migration
supabase migration up

# Or apply a specific migration file
supabase db push
```

### Option 2: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `20251105_fix_orders_foreign_keys_safe.sql`
4. Paste and execute the SQL

## What the Migration Does

### Step-by-Step Process:

1. **Drops All RLS Policies**
   - Queries `pg_policies` to find all policies on the `orders` table
   - Drops each policy safely
   - Logs which policies were dropped

2. **Drops Foreign Key Constraints**
   - Finds all foreign key constraints on the `orders` table
   - Drops them to allow column type changes
   - Uses `CASCADE` to handle dependencies

3. **Fixes Column Types**
   - Checks if `user_id` and `vendor_id` columns exist
   - If they exist but aren't UUID type, converts them
   - Handles existing data safely (converts valid UUIDs, nullifies invalid ones)
   - Sets `NOT NULL` constraint only if no nulls exist

4. **Recreates Foreign Key Constraints**
   - `user_id` → `auth.users(id)`
   - `vendor_id` → `auth.users(id)`
   - `product_id` → `public.menu_items(id)`

5. **Creates Indexes**
   - Indexes on `user_id`, `vendor_id`, and `product_id` for performance

6. **Recreates RLS Policies**
   - **Vendors can view own orders**: `vendor_id = auth.uid()`
   - **Vendors can update own orders**: `vendor_id = auth.uid()`
   - **Users can view own orders**: `user_id = auth.uid()`
   - **Users can create orders**: `user_id = auth.uid()`

## Safety Features

✅ **Transactional**: All changes are wrapped in a transaction  
✅ **Idempotent**: Can be run multiple times safely  
✅ **Data Preservation**: Existing data is preserved during type conversion  
✅ **Error Handling**: Includes error handling for each step  
✅ **Logging**: Provides detailed logging of what's being done  

## Verification

After running the migration, verify the changes:

### 1. Check Foreign Key Constraints
```sql
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'orders';
```

**Expected Results:**
- `orders_user_id_fkey`: `user_id` → `auth.users(id)`
- `orders_vendor_id_fkey`: `vendor_id` → `auth.users(id)`
- `orders_product_id_fkey`: `product_id` → `public.menu_items(id)`

### 2. Check RLS Policies
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'orders';
```

**Expected Policies:**
- `Vendors can view own orders` (SELECT)
- `Vendors can update own orders` (UPDATE)
- `Users can view own orders` (SELECT)
- `Users can create orders` (INSERT)

### 3. Check Column Types
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
ORDER BY ordinal_position;
```

**Expected:**
- `user_id`: `uuid`, `NOT NULL`
- `vendor_id`: `uuid`, `NOT NULL`
- `product_id`: `uuid`, `NULLABLE`

## Testing

After applying the migration:

1. **Test User Order Creation**
   ```sql
   -- As a logged-in user, try to create an order
   INSERT INTO public.orders (user_id, vendor_id, product_id, quantity, total_price, status)
   VALUES (
     auth.uid(), -- Your user ID
     'vendor-uuid-here', -- A vendor's auth.users(id)
     'product-uuid-here', -- A menu item ID
     1,
     1000.00,
     'Pending'
   );
   ```

2. **Test Vendor Viewing Orders**
   ```sql
   -- As a vendor, try to view your orders
   SELECT * FROM public.orders WHERE vendor_id = auth.uid();
   ```

3. **Test User Viewing Own Orders**
   ```sql
   -- As a user, try to view your orders
   SELECT * FROM public.orders WHERE user_id = auth.uid();
   ```

## Troubleshooting

### If Migration Fails

1. **Check for Existing Data**
   ```sql
   -- Check if there are any orders with invalid user_id or vendor_id
   SELECT id, user_id, vendor_id 
   FROM public.orders 
   WHERE user_id IS NULL OR vendor_id IS NULL;
   ```

2. **Check for Invalid UUIDs**
   ```sql
   -- If columns are text type, check for invalid UUIDs
   SELECT id, user_id, vendor_id
   FROM public.orders
   WHERE user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR vendor_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
   ```

3. **Check Policy Dependencies**
   ```sql
   -- Verify all policies were dropped
   SELECT policyname FROM pg_policies 
   WHERE schemaname = 'public' AND tablename = 'orders';
   ```
   This should return no rows if policies were successfully dropped.

### If Policies Don't Get Recreated

If policies fail to recreate, you can manually create them:

```sql
-- Policy 1: Vendors can view their own orders
CREATE POLICY "Vendors can view own orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (vendor_id = auth.uid());

-- Policy 2: Vendors can update their own orders
CREATE POLICY "Vendors can update own orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- Policy 3: Users can view their own orders
CREATE POLICY "Users can view own orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy 4: Users can create orders
CREATE POLICY "Users can create orders"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
```

## Rollback (If Needed)

If you need to rollback the migration:

1. **Drop the new policies** (if they were created):
   ```sql
   DROP POLICY IF EXISTS "Vendors can view own orders" ON public.orders;
   DROP POLICY IF EXISTS "Vendors can update own orders" ON public.orders;
   DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
   DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
   ```

2. **Drop foreign key constraints**:
   ```sql
   ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
   ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_vendor_id_fkey;
   ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_product_id_fkey;
   ```

3. **Restore original policies** (if you have a backup)

## Important Notes

- ⚠️ **Backup First**: Always backup your database before running migrations
- ⚠️ **Test in Development**: Test the migration in a development environment first
- ⚠️ **Null Values**: If columns have null values, they'll remain nullable
- ⚠️ **Data Loss**: Invalid UUIDs will be set to NULL during conversion

## Support

If you encounter issues:
1. Check the migration logs for specific error messages
2. Verify that `auth.users` table exists and has data
3. Verify that `menu_items` table exists (for product_id constraint)
4. Check that user IDs being inserted actually exist in `auth.users`







