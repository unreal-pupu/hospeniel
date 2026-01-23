-- Quick fix: Add title column to notifications table if it doesn't exist
-- This fixes the "column title does not exist" error when creating delivery tasks

begin;

-- Add title column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'notifications'
    and column_name = 'title'
  ) then
    alter table public.notifications
    add column title text;
    
    raise notice 'Added title column to notifications table';
  else
    raise notice 'title column already exists in notifications table';
  end if;
end $$;

commit;

-- Verification query (run separately):
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'notifications'
--   AND column_name = 'title';



