-- Enforce vendor trial expiry (30 days) across vendor-facing tables
-- Vendors on free_trial older than 30 days are denied access server-side

begin;

-- Helper: true if vendor is allowed to access platform
create or replace function public.is_vendor_trial_active(user_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce((
    select case
      when p.role is distinct from 'vendor' then true
      when p.subscription_plan is distinct from 'free_trial' then true
      when p.created_at is null then true
      when p.created_at > now() - interval '30 days' then true
      else false
    end
    from public.profiles p
    where p.id = user_id
  ), true);
$$;

-- Restrictive policy: vendors must have active trial or paid plan
-- Apply to vendor-facing tables to prevent bypass
do $$
begin
  -- vendors
  execute 'drop policy if exists "Vendor trial must be active" on public.vendors';
  execute 'create policy "Vendor trial must be active" on public.vendors as restrictive
    for all to authenticated
    using (public.is_vendor_trial_active((select auth.uid())))
    with check (public.is_vendor_trial_active((select auth.uid())))';

  -- menu_items
  execute 'drop policy if exists "Vendor trial must be active" on public.menu_items';
  execute 'create policy "Vendor trial must be active" on public.menu_items as restrictive
    for all to authenticated
    using (public.is_vendor_trial_active((select auth.uid())))
    with check (public.is_vendor_trial_active((select auth.uid())))';

  -- orders
  execute 'drop policy if exists "Vendor trial must be active" on public.orders';
  execute 'create policy "Vendor trial must be active" on public.orders as restrictive
    for all to authenticated
    using (public.is_vendor_trial_active((select auth.uid())))
    with check (public.is_vendor_trial_active((select auth.uid())))';

  -- service_requests
  execute 'drop policy if exists "Vendor trial must be active" on public.service_requests';
  execute 'create policy "Vendor trial must be active" on public.service_requests as restrictive
    for all to authenticated
    using (public.is_vendor_trial_active((select auth.uid())))
    with check (public.is_vendor_trial_active((select auth.uid())))';

  -- service_request_replies
  execute 'drop policy if exists "Vendor trial must be active" on public.service_request_replies';
  execute 'create policy "Vendor trial must be active" on public.service_request_replies as restrictive
    for all to authenticated
    using (public.is_vendor_trial_active((select auth.uid())))
    with check (public.is_vendor_trial_active((select auth.uid())))';

  -- vendor_service_profiles
  execute 'drop policy if exists "Vendor trial must be active" on public.vendor_service_profiles';
  execute 'create policy "Vendor trial must be active" on public.vendor_service_profiles as restrictive
    for all to authenticated
    using (public.is_vendor_trial_active((select auth.uid())))
    with check (public.is_vendor_trial_active((select auth.uid())))';

  -- notifications
  execute 'drop policy if exists "Vendor trial must be active" on public.notifications';
  execute 'create policy "Vendor trial must be active" on public.notifications as restrictive
    for all to authenticated
    using (public.is_vendor_trial_active((select auth.uid())))
    with check (public.is_vendor_trial_active((select auth.uid())))';

  -- delivery_tasks
  execute 'drop policy if exists "Vendor trial must be active" on public.delivery_tasks';
  execute 'create policy "Vendor trial must be active" on public.delivery_tasks as restrictive
    for all to authenticated
    using (public.is_vendor_trial_active((select auth.uid())))
    with check (public.is_vendor_trial_active((select auth.uid())))';

  -- vendor_payouts
  execute 'drop policy if exists "Vendor trial must be active" on public.vendor_payouts';
  execute 'create policy "Vendor trial must be active" on public.vendor_payouts as restrictive
    for all to authenticated
    using (public.is_vendor_trial_active((select auth.uid())))
    with check (public.is_vendor_trial_active((select auth.uid())))';
end $$;

commit;
