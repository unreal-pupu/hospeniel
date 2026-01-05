-- Add avatar_url column for user profile images on the users settings table
-- This does NOT affect vendors; vendors maintain separate settings.

begin;

-- Ensure table exists before altering (no-op if it already exists)
-- Add avatar_url to user_settings for storing public image URLs
alter table if exists public.user_settings
  add column if not exists avatar_url text;

-- Optional: helpful index if filtering by avatar_url becomes common (skip if unnecessary)
-- create index if not exists user_settings_avatar_url_idx on public.user_settings using btree (avatar_url);

commit;










