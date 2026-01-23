begin;

grant select, insert on table public.payment_audit_logs to service_role;

commit;
