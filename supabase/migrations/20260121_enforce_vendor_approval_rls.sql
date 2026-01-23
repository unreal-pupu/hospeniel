-- Enforce vendor approval status across vendor-managed tables
begin;

-- Helper expression:
-- Vendor must be approved in profiles to access vendor-specific policies

-- =========================
-- Menu Items
-- =========================
drop policy if exists "Vendors can insert own menu items" on public.menu_items;
drop policy if exists "Vendors can update own menu items" on public.menu_items;
drop policy if exists "Vendors can delete own menu items" on public.menu_items;

create policy "Vendors can insert own menu items"
  on public.menu_items
  for insert
  to authenticated
  with check (
    vendor_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'vendor'
        and p.approval_status = 'approved'
    )
  );

create policy "Vendors can update own menu items"
  on public.menu_items
  for update
  to authenticated
  using (
    vendor_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'vendor'
        and p.approval_status = 'approved'
    )
  )
  with check (
    vendor_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'vendor'
        and p.approval_status = 'approved'
    )
  );

create policy "Vendors can delete own menu items"
  on public.menu_items
  for delete
  to authenticated
  using (
    vendor_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'vendor'
        and p.approval_status = 'approved'
    )
  );

-- =========================
-- Orders (vendor access)
-- =========================
drop policy if exists "Vendors can view own orders" on public.orders;
drop policy if exists "Vendors can update own orders" on public.orders;

create policy "Vendors can view own orders"
  on public.orders
  for select
  to authenticated
  using (
    vendor_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'vendor'
        and p.approval_status = 'approved'
    )
  );

create policy "Vendors can update own orders"
  on public.orders
  for update
  to authenticated
  using (
    vendor_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'vendor'
        and p.approval_status = 'approved'
    )
  )
  with check (
    vendor_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'vendor'
        and p.approval_status = 'approved'
    )
  );

-- =========================
-- Service Requests (vendor access)
-- =========================
drop policy if exists "Vendors can view own service requests" on public.service_requests;
drop policy if exists "Vendors can update own service requests" on public.service_requests;

create policy "Vendors can view own service requests"
  on public.service_requests
  for select
  to authenticated
  using (
    vendor_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'vendor'
        and p.approval_status = 'approved'
    )
  );

create policy "Vendors can update own service requests"
  on public.service_requests
  for update
  to authenticated
  using (
    vendor_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'vendor'
        and p.approval_status = 'approved'
    )
  )
  with check (
    vendor_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'vendor'
        and p.approval_status = 'approved'
    )
  );

-- =========================
-- Service Request Replies (vendor access)
-- =========================
drop policy if exists "Users and vendors can view replies for their service requests" on public.service_request_replies;
drop policy if exists "Users and vendors can send replies for their service requests" on public.service_request_replies;

create policy "Users and vendors can view replies for their service requests"
  on public.service_request_replies
  for select
  to authenticated
  using (
    exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_replies.service_request_id
        and (
          sr.user_id = auth.uid()
          or (
            sr.vendor_id = auth.uid()
            and exists (
              select 1 from public.profiles p
              where p.id = auth.uid()
                and p.role = 'vendor'
                and p.approval_status = 'approved'
            )
          )
        )
    )
  );

create policy "Users and vendors can send replies for their service requests"
  on public.service_request_replies
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_replies.service_request_id
        and (
          (sr.user_id = auth.uid() and service_request_replies.sender_role = 'user')
          or (
            sr.vendor_id = auth.uid()
            and service_request_replies.sender_role = 'vendor'
            and exists (
              select 1 from public.profiles p
              where p.id = auth.uid()
                and p.role = 'vendor'
                and p.approval_status = 'approved'
            )
          )
        )
    )
  );

commit;
