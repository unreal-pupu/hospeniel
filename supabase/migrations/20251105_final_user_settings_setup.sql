-- FINAL COMPLETE SETUP for user_settings table
-- This includes grants, RLS, and all necessary policies
-- Run this ONE migration to fix all permission issues

begin;

-- Step 1: Ensure schema permissions
grant usage on schema public to authenticated;

-- Step 2: Ensure table structure
alter table if exists public.user_settings
  add column if not exists avatar_url text;

-- Step 3: Ensure unique index for user_id
drop index if exists user_settings_user_id_uidx;
create unique index if not exists user_settings_user_id_uidx 
  on public.user_settings (user_id);

-- Step 4: Grant table permissions to authenticated role
-- This is CRITICAL - even with RLS, PostgreSQL needs explicit grants
grant select, insert, update on public.user_settings to authenticated;

-- Step 5: Enable RLS
alter table if exists public.user_settings enable row level security;

-- Step 6: Drop existing policies (if any) to recreate cleanly
drop policy if exists "Users can select own settings" on public.user_settings;
drop policy if exists "Users can insert own settings" on public.user_settings;
drop policy if exists "Users can update own settings" on public.user_settings;

-- Step 7: Create RLS policies

-- SELECT policy: Users can only read their own settings
create policy "Users can select own settings"
  on public.user_settings
  for select
  to authenticated
  using (user_id = auth.uid());

-- INSERT policy: Users can only insert their own settings
create policy "Users can insert own settings"
  on public.user_settings
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- UPDATE policy: Users can only update their own settings
create policy "Users can update own settings"
  on public.user_settings
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;

-- Verification queries (run separately to confirm):
-- 
-- 1. Check grants:
-- SELECT grantee, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' 
--   AND table_name = 'user_settings'
--   AND grantee = 'authenticated';
--
-- 2. Check RLS policies:
-- SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'user_settings';
--
-- 3. Check if RLS is enabled:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename = 'user_settings';




















