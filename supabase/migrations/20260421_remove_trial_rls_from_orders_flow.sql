-- Remove legacy subscription/trial restrictive RLS from orders flow.
-- This policy blocks chefs/home cooks/vendors from reading paid orders after checkout.

begin;

drop policy if exists "Vendor trial must be active" on public.orders;

commit;

