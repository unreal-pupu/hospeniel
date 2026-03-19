-- Allow admins to read all vendor_purchased_tools for the Admin Vendors page

begin;

drop policy if exists "Admins can select all vendor purchased tools" on public.vendor_purchased_tools;

create policy "Admins can select all vendor purchased tools"
  on public.vendor_purchased_tools
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and (role = 'admin' or is_admin = true)
    )
  );

commit;
