-- Create storage bucket for vendor profile images
-- This migration creates the vendor-images bucket and sets up RLS policies

-- Note: Storage bucket creation must be done via Supabase Dashboard or API
-- This SQL file documents the required bucket and policies

-- ============================================
-- STORAGE BUCKET: vendor-images
-- ============================================
-- 
-- To create the bucket:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New bucket"
-- 3. Name: vendor-images
-- 4. Public: Yes (if you want public access to images)
-- 5. File size limit: 5MB (recommended)
-- 6. Allowed MIME types: image/* (recommended)
--
-- ============================================
-- STORAGE RLS POLICIES
-- ============================================
--
-- Policy 1: Allow authenticated users to upload images to their own folder
-- CREATE POLICY "Vendors can upload their own images"
-- ON storage.objects
-- FOR INSERT
-- TO authenticated
-- WITH CHECK (
--   bucket_id = 'vendor-images' AND
--   (storage.foldername(name))[1] = auth.uid()::text
-- );
--
-- Policy 2: Allow authenticated users to update their own images
-- CREATE POLICY "Vendors can update their own images"
-- ON storage.objects
-- FOR UPDATE
-- TO authenticated
-- USING (
--   bucket_id = 'vendor-images' AND
--   (storage.foldername(name))[1] = auth.uid()::text
-- );
--
-- Policy 3: Allow authenticated users to delete their own images
-- CREATE POLICY "Vendors can delete their own images"
-- ON storage.objects
-- FOR DELETE
-- TO authenticated
-- USING (
--   bucket_id = 'vendor-images' AND
--   (storage.foldername(name))[1] = auth.uid()::text
-- );
--
-- Policy 4: Allow public read access to images
-- CREATE POLICY "Public can view vendor images"
-- ON storage.objects
-- FOR SELECT
-- TO public
-- USING (bucket_id = 'vendor-images');
--
-- ============================================
-- VERIFICATION
-- ============================================
--
-- After creating the bucket and policies, verify with:
--
-- SELECT * FROM storage.buckets WHERE name = 'vendor-images';
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';






