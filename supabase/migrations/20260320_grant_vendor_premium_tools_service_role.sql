-- Fix 42501 "permission denied for table vendor_purchased_tools" when using
-- SUPABASE_SERVICE_ROLE_KEY from API routes (Next.js server).
-- RLS bypass does not grant table privileges; service_role must have explicit GRANTs.

begin;

grant usage on schema public to service_role;

-- Premium tool purchases (written by /api/vendor-tools/* via service role)
grant select, insert, update, delete on table public.vendor_purchased_tools to service_role;

-- payments: idempotent re-grant (may already exist from earlier migrations)
grant select, insert, update, delete on table public.payments to service_role;

-- Feature entitlement tables (only if migrations were applied)
do $$
begin
  if to_regclass('public.features') is not null then
    execute 'grant select, insert, update, delete on table public.features to service_role';
  end if;
  if to_regclass('public.vendor_entitlements') is not null then
    execute 'grant select, insert, update, delete on table public.vendor_entitlements to service_role';
  end if;
end $$;

commit;
