-- Setup storage policies for menu-images bucket
-- This allows authenticated users to upload images and public read access
-- Note: This migration uses conditional policy creation to avoid ownership requirements

-- Note: The bucket must be created in Supabase Dashboard first:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Create a bucket named "menu-images"
-- 3. Set it to Public (enable public access)
-- 4. Then run this migration to set up RLS policies

-- RLS is already enabled on storage.objects by default in Supabase
-- We don't need to alter the table, which requires ownership

-- Policy 1: Authenticated users can upload images to menu-images bucket
-- Users can only upload to their own folder (userId/filename)
-- Create policy only if it doesn't exist
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can upload menu images'
  ) then
    create policy "Authenticated users can upload menu images"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'menu-images' AND
        name like (auth.uid()::text || '/%')
      );
  end if;
end $$;

-- Policy 2: Public can read images from menu-images bucket
-- This allows anyone (including unauthenticated users) to view menu images
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public can read menu images'
  ) then
    create policy "Public can read menu images"
      on storage.objects
      for select
      to public
      using (bucket_id = 'menu-images');
  end if;
end $$;

-- Policy 3: Authenticated users can update their own images
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can update own menu images'
  ) then
    create policy "Users can update own menu images"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'menu-images' AND
        name like (auth.uid()::text || '/%')
      )
      with check (
        bucket_id = 'menu-images' AND
        name like (auth.uid()::text || '/%')
      );
  end if;
end $$;

-- Policy 4: Authenticated users can delete their own images
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can delete own menu images'
  ) then
    create policy "Users can delete own menu images"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'menu-images' AND
        name like (auth.uid()::text || '/%')
      );
  end if;
end $$;

-- Verification queries (run separately to confirm):
--
-- 1. Check if bucket exists (run in Supabase Dashboard SQL Editor):
-- SELECT * FROM storage.buckets WHERE name = 'menu-images';
--
-- 2. Check storage policies:
-- SELECT * FROM pg_policies 
-- WHERE schemaname = 'storage' 
--   AND tablename = 'objects'
--   AND policyname LIKE '%menu%';
--
-- 3. Test upload (replace with actual user ID and file):
-- -- This would be done through the application, not SQL

-- Important Notes:
-- 1. Make sure the bucket is created in Supabase Dashboard before running this migration
-- 2. The bucket should be set to "Public" (public access enabled)
-- 3. The folder structure assumes files are uploaded as: userId/filename
-- 4. If you change the folder structure in the upload code, update the policies accordingly

