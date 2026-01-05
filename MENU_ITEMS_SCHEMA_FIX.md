# Menu Items Schema Fix Summary

## Issue
The application was throwing an error: "Failed to create item: Could not find the 'availability' column of 'menu_items' in the schema cache."

The schema needed to be updated to match the expected structure:
- Use `title` instead of `name`
- Use `availability` as boolean (default true) instead of text

## Changes Made

### 1. Database Migration
Created `supabase/migrations/20251105_fix_menu_items_schema.sql` which:
- Renames `name` column to `title` (if exists)
- Converts `availability` from text to boolean
- Ensures all required columns exist:
  - `id` (uuid, primary key)
  - `vendor_id` (uuid, references auth.users)
  - `title` (text, not null)
  - `description` (text, nullable)
  - `price` (numeric, not null)
  - `availability` (boolean, not null, default true)
  - `image_url` (text, nullable)
  - `created_at` (timestamp with time zone, default now())

### 2. Frontend Updates

#### `src/app/vendor/menu/page.tsx`
- Updated `MenuItem` interface:
  - Changed `name: string` to `title: string`
  - Changed `availability: "available" | "out_of_stock"` to `availability: boolean`
- Updated form state to use `title` and boolean `availability`
- Changed availability input from select dropdown to checkbox
- Updated all references from `item.name` to `item.title`
- Updated availability display logic to use boolean
- Updated `toggleAvailability` function to toggle boolean value

#### `src/app/explore/page.tsx`
- Updated `MenuItem` interface to match new schema
- Changed `item.name` to `item.title` in display
- Added filter to only show available items (`availability = true`)

## Steps to Apply

### Step 1: Run the Database Migration
Run the migration in Supabase:
```sql
-- Run: supabase/migrations/20251105_fix_menu_items_schema.sql
```

This will:
1. Rename `name` to `title` if the column exists
2. Convert `availability` from text to boolean (if it exists as text)
3. Add any missing columns
4. Set proper defaults and constraints

### Step 2: Verify the Schema
After running the migration, verify the table structure:
```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'menu_items'
ORDER BY ordinal_position;
```

Expected columns:
- `id` (uuid)
- `vendor_id` (uuid)
- `title` (text)
- `description` (text, nullable)
- `price` (numeric)
- `availability` (boolean, default true)
- `image_url` (text, nullable)
- `created_at` (timestamp with time zone)

### Step 3: Test the Application
1. Log in as a vendor
2. Go to Menu Management
3. Create a new menu item:
   - Enter a title
   - Add description (optional)
   - Set price
   - Check/uncheck availability checkbox
   - Upload an image
4. Verify the item is created successfully
5. Verify the item appears in the menu list
6. Test editing and deleting items
7. Test toggling availability

### Step 4: Verify in Explore Page
1. Go to the Explore page
2. Select a vendor
3. Verify menu items display correctly with titles
4. Verify only available items are shown

## Migration Notes

The migration handles several scenarios:
1. **If `name` column exists**: Renames it to `title`
2. **If `availability` is text**: Converts values:
   - `'available'` → `true`
   - `'out_of_stock'` → `false`
   - `null` → `true` (default)
3. **If columns don't exist**: Creates them with proper types and defaults
4. **Data preservation**: Existing data is preserved during conversion

## Breaking Changes

⚠️ **Note**: If you have existing data:
- The `name` column will be renamed to `title` (data preserved)
- The `availability` column will be converted from text to boolean:
  - `'available'` → `true`
  - `'out_of_stock'` → `false`
  - Other values → `true` (default)

## Frontend Changes Summary

### Before
```typescript
interface MenuItem {
  name: string;
  availability: "available" | "out_of_stock";
}

// Form
<Input value={formData.name} />
<select value={formData.availability}>
  <option value="available">Available</option>
  <option value="out_of_stock">Out of Stock</option>
</select>
```

### After
```typescript
interface MenuItem {
  title: string;
  availability: boolean;
}

// Form
<Input value={formData.title} />
<input 
  type="checkbox" 
  checked={formData.availability} 
/>
```

## Troubleshooting

### Error: "column 'name' does not exist"
- **Cause**: Migration renamed `name` to `title`, but frontend still uses `name`
- **Solution**: Make sure you've updated the frontend code to use `title`

### Error: "column 'availability' does not exist"
- **Cause**: Migration hasn't been run or failed
- **Solution**: Run the migration again and check for errors

### Error: "operator does not exist: boolean = text"
- **Cause**: Old code trying to compare boolean with text
- **Solution**: Update code to use boolean values instead of text

### Availability shows incorrectly
- **Cause**: Data conversion issue during migration
- **Solution**: Check the migration logs and verify the conversion worked correctly

## Verification Queries

After migration, run these to verify:

```sql
-- Check column types
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'menu_items';

-- Check sample data
SELECT id, title, availability, price 
FROM menu_items 
LIMIT 5;

-- Verify availability is boolean
SELECT 
  title,
  availability,
  pg_typeof(availability) as availability_type
FROM menu_items 
LIMIT 5;
```

## Next Steps

After applying these changes:
1. Test creating menu items with images
2. Test updating menu items
3. Test deleting menu items
4. Test toggling availability
5. Verify items display correctly in the explore page
6. Verify image uploads work correctly

If you encounter any issues, check:
- Browser console for errors
- Supabase logs for database errors
- Network tab for API errors
- Database schema matches expected structure








