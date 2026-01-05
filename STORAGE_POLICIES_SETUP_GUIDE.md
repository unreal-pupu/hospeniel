# Storage Policies Setup Guide for menu-images Bucket

If you encounter permission errors when running the SQL migration, you can set up the storage policies through the Supabase Dashboard instead.

## Option 1: Using Supabase Dashboard (Recommended if SQL fails)

### Step 1: Create the Bucket (if not already created)
1. Go to **Supabase Dashboard** → **Storage**
2. Click **"New bucket"**
3. Name: `menu-images`
4. **Public bucket**: ✅ Enabled (check this box)
5. Click **"Create bucket"**

### Step 2: Set Up Storage Policies via Dashboard

1. Go to **Storage** → **Policies** (or click on the `menu-images` bucket → **Policies** tab)
2. You'll see the `storage.objects` table with policies
3. Click **"New Policy"** for each policy below:

#### Policy 1: Authenticated users can upload menu images

- **Policy name**: `Authenticated users can upload menu images`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **Policy definition** (USING expression): Leave empty
- **Policy definition** (WITH CHECK expression):
```sql
bucket_id = 'menu-images' AND name LIKE (auth.uid()::text || '/%')
```

#### Policy 2: Public can read menu images

- **Policy name**: `Public can read menu images`
- **Allowed operation**: `SELECT`
- **Target roles**: `public`
- **Policy definition** (USING expression):
```sql
bucket_id = 'menu-images'
```
- **Policy definition** (WITH CHECK expression): Leave empty

#### Policy 3: Users can update own menu images

- **Policy name**: `Users can update own menu images`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **Policy definition** (USING expression):
```sql
bucket_id = 'menu-images' AND name LIKE (auth.uid()::text || '/%')
```
- **Policy definition** (WITH CHECK expression):
```sql
bucket_id = 'menu-images' AND name LIKE (auth.uid()::text || '/%')
```

#### Policy 4: Users can delete own menu images

- **Policy name**: `Users can delete own menu images`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **Policy definition** (USING expression):
```sql
bucket_id = 'menu-images' AND name LIKE (auth.uid()::text || '/%')
```
- **Policy definition** (WITH CHECK expression): Leave empty

### Step 3: Verify Policies

After creating all policies, verify they exist:

1. Go to **Storage** → **Policies**
2. Filter by `storage.objects` table
3. You should see all 4 policies listed

## Option 2: Using SQL Migration (If you have permissions)

If you have the necessary permissions, you can run the SQL migration:

```sql
-- Run: supabase/migrations/20251105_setup_menu_images_storage_policies.sql
```

The migration now uses conditional policy creation and doesn't require table ownership.

## Policy Explanations

### Policy 1: Upload (INSERT)
- Allows authenticated users to upload images
- Restricts uploads to files in their own folder (path must start with `userId/`)
- Example: User with ID `123e4567-e89b-12d3-a456-426614174000` can upload to:
  - ✅ `123e4567-e89b-12d3-a456-426614174000/image.jpg`
  - ❌ `other-user-id/image.jpg`

### Policy 2: Read (SELECT)
- Allows anyone (including unauthenticated users) to read images
- Required for displaying menu images on public pages
- Only applies to the `menu-images` bucket

### Policy 3: Update (UPDATE)
- Allows authenticated users to update their own images
- Same folder restriction as upload policy

### Policy 4: Delete (DELETE)
- Allows authenticated users to delete their own images
- Same folder restriction as upload policy

## Verification

After setting up the policies, test the flow:

1. Log in as a vendor
2. Go to Menu Management
3. Try to create a menu item with an image
4. The image should upload successfully
5. The image should be accessible via the public URL

## Troubleshooting

### Error: "Permission denied for table storage.objects"
- **Solution**: Use the Dashboard method (Option 1) instead of SQL

### Error: "Policy already exists"
- **Solution**: The policy is already created. You can skip creating it again or delete the existing one first (if you have permissions)

### Error: "Bucket not found"
- **Solution**: Create the `menu-images` bucket in the Dashboard first

### Images not uploading
- Check that Policy 1 (INSERT) is created correctly
- Verify the bucket is set to Public
- Check browser console for detailed error messages
- Verify the file path starts with `userId/` (the app code handles this)

### Images not displaying
- Check that Policy 2 (SELECT) is created and allows public access
- Verify the bucket is set to Public
- Check that the image URL is correct

## Alternative: Using Supabase CLI (Advanced)

If you have Supabase CLI set up with service role access, you can also apply the migration using:

```bash
supabase db push
```

This uses service role credentials which have the necessary permissions.

