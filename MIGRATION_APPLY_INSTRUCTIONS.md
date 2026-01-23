# How to Apply the vendor_location Migration

## Issue
The API is trying to insert `vendor_location` into the `delivery_tasks` table, but this column doesn't exist yet in Supabase. The migration file exists but needs to be applied.

## Solution: Apply the Migration

You have two options to apply the migration:

### Option 1: Using Supabase Dashboard (Recommended for Quick Fix)

1. **Open Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to **SQL Editor**

2. **Run the Migration**
   - Open the file: `supabase/migrations/20260112182304_add_vendor_location_to_delivery_tasks.sql`
   - Copy the entire contents of the file
   - Paste into the SQL Editor
   - Click **Run** or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

3. **Verify Success**
   - You should see "Success. No rows returned" or similar success message
   - The migration will:
     - Add the `vendor_location` column to `delivery_tasks` table
     - Create an index on `vendor_location`
     - Update the notification trigger function
     - Update the RLS policy

4. **Refresh Schema Cache (Important!)**
   - Go to **Settings** → **API**
   - Click **"Reload schema"** or **"Refresh schema cache"**
   - Wait a few seconds for the cache to refresh

### Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Make sure you're in the project root directory
cd /path/to/hospineil

# Link to your Supabase project (if not already linked)
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push

# OR apply migrations up
supabase migration up
```

## Verify the Migration

After applying the migration, verify the column exists:

```sql
-- Check if vendor_location column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'delivery_tasks'
  AND column_name = 'vendor_location';
```

You should see:
```
column_name      | data_type | is_nullable
vendor_location  | text      | YES
```

## Test the Fix

1. **Try creating a delivery task again**
   - As a vendor, accept an order
   - Click "Request Rider"
   - The request should now succeed

2. **Check the logs**
   - The error about missing `vendor_location` column should be gone
   - You should see: `📍 Vendor location: [location name]`

## What This Migration Does

1. **Adds `vendor_location` column** to `delivery_tasks` table
2. **Creates index** for better query performance
3. **Backfills existing records** with vendor locations
4. **Updates notification trigger** to only notify riders in the same location
5. **Updates RLS policy** to filter tasks by location

## Important Notes

- The migration is **safe to run multiple times** (uses `IF NOT EXISTS`)
- It will **not delete or modify existing data**
- It will **backfill** existing delivery tasks with vendor locations
- After running, you may need to wait a few seconds for the schema cache to refresh
