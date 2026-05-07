-- Grant service_role access needed by server-side avatar fallback API.
-- RLS bypass does not automatically include table privileges.

begin;

grant usage on schema public to service_role;
grant select on table public.user_settings to service_role;

commit;
