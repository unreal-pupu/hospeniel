-- Fix admin access for rider_payouts and rider_payment_details
-- Allow admins identified by profiles.role = 'admin' or is_admin = true

begin;

-- rider_payouts policies
drop policy if exists "Admins can view all rider payouts" on public.rider_payouts;
drop policy if exists "Admins can insert rider payouts" on public.rider_payouts;
drop policy if exists "Admins can update rider payouts" on public.rider_payouts;

create policy "Admins can view all rider payouts"
  on public.rider_payouts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and (is_admin = true or role = 'admin')
    )
  );

create policy "Admins can insert rider payouts"
  on public.rider_payouts
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and (is_admin = true or role = 'admin')
    )
  );

create policy "Admins can update rider payouts"
  on public.rider_payouts
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and (is_admin = true or role = 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and (is_admin = true or role = 'admin')
    )
  );

-- rider_payment_details admin read policy
drop policy if exists "Admins can view all rider payment details" on public.rider_payment_details;

create policy "Admins can view all rider payment details"
  on public.rider_payment_details
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and (is_admin = true or role = 'admin')
    )
  );

commit;

