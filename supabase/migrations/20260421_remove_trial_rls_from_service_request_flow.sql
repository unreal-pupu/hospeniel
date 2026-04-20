-- Remove legacy subscription/trial restrictive RLS from service request flow.
-- These restrictive policies block vendors from reading service_requests/notifications
-- after free_trial expiry, which causes "request sent but vendor sees nothing".

begin;

drop policy if exists "Vendor trial must be active" on public.service_requests;
drop policy if exists "Vendor trial must be active" on public.notifications;
drop policy if exists "Vendor trial must be active" on public.service_request_replies;

commit;

