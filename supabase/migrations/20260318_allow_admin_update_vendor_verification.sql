-- Allow admins to update vendor verification status
-- Uses existing public.is_admin(auth.uid()) helper

drop policy if exists "Admins can update vendors" on public.vendors;

create policy "Admins can update vendors"
on public.vendors
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
