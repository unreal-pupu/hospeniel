# Explore Page Fix - Display All Menu Items

## Issue
The Explore page was not showing menu items from all vendors. Users could only see menu items after clicking on a specific vendor.

## Changes Made

### 1. Database Migrations

#### `supabase/migrations/20251105_allow_public_read_menu_items.sql`
- Allows public (unauthenticated) and authenticated users to read menu_items
- Grants SELECT permission to `anon` role
- Creates a policy that allows public read access

#### `supabase/migrations/20251105_allow_public_read_vendors.sql`
- Allows public (unauthenticated) and authenticated users to read vendors
- Grants SELECT permission to `anon` role
- Creates a policy that allows public read access

### 2. Frontend Updates

#### `src/app/explore/page.tsx`

**Interface Updates:**
- Added `vendors` property to `MenuItem` interface to include vendor information
- Added `profile_id` property to `Vendor` interface

**New Functions:**
- `fetchAllMenuItems()`: Fetches all menu items from all vendors with vendor information
  - Fetches menu items first
  - Fetches vendor information separately
  - Joins vendor data with menu items based on `menu_items.vendor_id = vendors.profile_id`

**Updated Functions:**
- `fetchVendorMenu()`: Updated to fetch vendor information separately and join with menu items
- `handleVendorClick()`: Updated to use `profile_id` when fetching vendor menu

**UI Changes:**
- Changed default view to show all menu items instead of vendors
- Added "View All Items" and "View Vendors" toggle buttons
- Menu items now display:
  - Product image
  - Product title
  - Vendor name with avatar
  - Vendor location
  - Description
  - Price
  - Availability status badge
  - Order button
- Grid layout with responsive columns (1 on mobile, 2 on tablet, 3 on desktop, 4 on large screens)

## Database Schema Notes

**Important Relationships:**
- `menu_items.vendor_id` references `auth.users(id)`
- `vendors.profile_id` references `auth.users(id)`
- Therefore: `menu_items.vendor_id = vendors.profile_id` (both reference the same `auth.users.id`)

This is why we join menu items with vendors using `vendors.profile_id = menu_items.vendor_id`.

## Steps to Apply

### Step 1: Run Database Migrations

Run these migrations in order:

1. **Allow public read access to menu_items:**
   ```sql
   -- Run: supabase/migrations/20251105_allow_public_read_menu_items.sql
   ```

2. **Allow public read access to vendors:**
   ```sql
   -- Run: supabase/migrations/20251105_allow_public_read_vendors.sql
   ```

### Step 2: Verify RLS Policies

After running migrations, verify the policies:

```sql
-- Check menu_items policies
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'menu_items';

-- Check vendors policies
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'vendors';
```

You should see:
- `menu_items`: "Public can view menu items" policy with `public` role
- `vendors`: "Public can view vendors" policy with `public` role

### Step 3: Test the Application

1. **Log in as a regular user**
2. **Go to the Explore page**
3. **Verify:**
   - All menu items from all vendors are displayed
   - Each menu item shows:
     - Product image
     - Product title
     - Vendor name with avatar
     - Vendor location (if available)
     - Description
     - Price
     - Availability status
   - Menu items are in a responsive grid layout
   - "Order Now" button works for available items
   - Out of stock items are disabled

4. **Test vendor filtering:**
   - Click "View Vendors" to see vendor list
   - Click on a vendor to see only their menu items
   - Click "Back to All Items" to see all menu items again

## Features

### Menu Item Display
- ✅ Product image with fallback
- ✅ Product title
- ✅ Vendor name with avatar
- ✅ Vendor location
- ✅ Description (truncated with line-clamp)
- ✅ Price (formatted with ₦ and locale)
- ✅ Availability status badge (green for available, red for out of stock)
- ✅ Order button (disabled for out of stock items)

### Responsive Design
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 columns
- Large screens: 4 columns

### Error Handling
- Gracefully handles missing vendor information
- Shows placeholder images for missing product images
- Displays "No description available" for items without descriptions
- Handles cases where vendor information is not found

## Troubleshooting

### Menu items not showing
1. **Check RLS policies:**
   - Verify public read access is enabled for both `menu_items` and `vendors`
   - Run the verification queries above

2. **Check browser console:**
   - Look for errors in the console
   - Check Network tab for failed API requests

3. **Verify data:**
   - Check that menu items exist in the database
   - Verify that `menu_items.availability = true` for items you expect to see
   - Verify that vendors have `profile_id` set correctly

### Vendor information not showing
1. **Check vendor data:**
   - Verify that vendors have `profile_id` set
   - Verify that `menu_items.vendor_id` matches `vendors.profile_id`

2. **Check joins:**
   - The join uses `vendors.profile_id = menu_items.vendor_id`
   - Both should reference the same `auth.users.id`

### Images not loading
1. **Check image URLs:**
   - Verify that `image_url` is set correctly in the database
   - Check that the storage bucket is public
   - Verify storage policies allow public read access

## Testing Checklist

- [ ] All menu items from all vendors are displayed
- [ ] Vendor information is shown for each menu item
- [ ] Menu items are in a responsive grid layout
- [ ] Availability status is shown correctly
- [ ] Order button works for available items
- [ ] Order button is disabled for out of stock items
- [ ] "View Vendors" button shows vendor list
- [ ] Clicking a vendor shows only their menu items
- [ ] "Back to All Items" shows all menu items again
- [ ] Images load correctly (or show placeholder)
- [ ] Price is formatted correctly
- [ ] Description is truncated properly
- [ ] Page works on mobile, tablet, and desktop

## Next Steps

After verifying the fix works:
1. Test with multiple vendors and menu items
2. Verify performance with large datasets
3. Consider adding filters (by location, price range, etc.)
4. Consider adding search functionality
5. Consider adding pagination for large result sets








