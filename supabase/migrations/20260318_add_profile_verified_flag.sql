-- Add verified flag to profiles (source of truth for vendor verification)
alter table if exists public.profiles
  add column if not exists verified boolean default false;
