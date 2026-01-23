-- Verification script to check if profiles table has all required columns
-- Run this to verify the schema before registration

-- Check if address column exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'address'
    ) THEN '✅ address column exists'
    ELSE '❌ address column MISSING'
  END as address_status;

-- Check if phone_number column exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'phone_number'
    ) THEN '✅ phone_number column exists'
    ELSE '❌ phone_number column MISSING'
  END as phone_number_status;

-- Check if location column exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'location'
    ) THEN '✅ location column exists'
    ELSE '❌ location column MISSING'
  END as location_status;

-- Check if category column exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'category'
    ) THEN '✅ category column exists'
    ELSE '❌ category column MISSING'
  END as category_status;

-- List all columns in profiles table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

















