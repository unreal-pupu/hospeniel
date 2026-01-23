-- RLS policies for public.user_settings so users can manage their own settings
-- Vendors remain separate (no changes to vendor-specific tables).

begin;

-- Enable RLS (safe if already enabled)
alter table if exists public.user_settings enable row level security;

-- Optional but recommended for upsert on user_id
create unique index if not exists user_settings_user_id_uidx on public.user_settings (user_id);

-- Allow users to read only their own settings
create policy if not exists "Users can select own settings"
  on public.user_settings
  for select
  to authenticated
  using (user_id = auth.uid());

-- Allow users to insert their own settings row
create policy if not exists "Users can insert own settings"
  on public.user_settings
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Allow users to update only their own settings row
create policy if not exists "Users can update own settings"
  on public.user_settings
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;



































