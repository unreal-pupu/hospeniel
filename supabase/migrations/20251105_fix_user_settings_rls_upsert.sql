-- Fix RLS policies for user_settings to properly handle upsert operations
-- This ensures authenticated users can insert/update their own settings

begin;

-- Drop existing policies if they exist (to recreate them cleanly)
drop policy if exists "Users can select own settings" on public.user_settings;
drop policy if exists "Users can insert own settings" on public.user_settings;
drop policy if exists "Users can update own settings" on public.user_settings;

-- Ensure RLS is enabled
alter table if exists public.user_settings enable row level security;

-- Ensure unique index exists for upsert operations
create unique index if not exists user_settings_user_id_uidx on public.user_settings (user_id);

-- Policy 1: Users can SELECT their own settings
create policy "Users can select own settings"
  on public.user_settings
  for select
  to authenticated
  using (user_id = auth.uid());

-- Policy 2: Users can INSERT their own settings
create policy "Users can insert own settings"
  on public.user_settings
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Policy 3: Users can UPDATE their own settings
create policy "Users can update own settings"
  on public.user_settings
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Verify the table structure (optional check)
-- Ensure avatar_url column exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'user_settings' 
    and column_name = 'avatar_url'
  ) then
    alter table public.user_settings add column avatar_url text;
  end if;
end $$;

commit;
































