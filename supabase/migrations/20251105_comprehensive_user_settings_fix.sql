-- Comprehensive fix for user_settings table RLS and structure
-- Run this to ensure everything is properly configured

begin;

-- Step 1: Ensure the table exists and has the correct structure
-- Add avatar_url column if it doesn't exist
alter table if exists public.user_settings
  add column if not exists avatar_url text;

-- Step 2: Ensure user_id has a unique constraint/index for upsert operations
-- Drop existing index if it exists to recreate cleanly
drop index if exists user_settings_user_id_uidx;
create unique index user_settings_user_id_uidx on public.user_settings (user_id);

-- Step 3: Enable RLS (idempotent)
alter table if exists public.user_settings enable row level security;

-- Step 4: Drop all existing policies to start fresh
drop policy if exists "Users can select own settings" on public.user_settings;
drop policy if exists "Users can insert own settings" on public.user_settings;
drop policy if exists "Users can update own settings" on public.user_settings;

-- Step 5: Create new policies with explicit names (no "if not exists" for clarity)

-- Policy for SELECT: Users can only see their own settings
create policy "Users can select own settings"
  on public.user_settings
  for select
  to authenticated
  using (user_id = auth.uid());

-- Policy for INSERT: Users can only insert their own settings
create policy "Users can insert own settings"
  on public.user_settings
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Policy for UPDATE: Users can only update their own settings
create policy "Users can update own settings"
  on public.user_settings
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Step 6: Verify policies are active (diagnostic query)
-- This will show all active policies for user_settings
do $$
declare
  policy_count integer;
begin
  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'user_settings';
  
  raise notice 'Active RLS policies for user_settings: %', policy_count;
  
  if policy_count < 3 then
    raise warning 'Expected 3 policies but found %. Please check policy creation.', policy_count;
  end if;
end $$;

commit;

-- Diagnostic query to verify setup (run separately if needed):
-- SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'user_settings';




















