-- Remove trial restriction policy for menu_items inserts/updates
-- Keeps RLS enabled and existing vendor ownership policies intact

begin;

drop policy if exists "Vendor trial must be active" on public.menu_items;

commit;
