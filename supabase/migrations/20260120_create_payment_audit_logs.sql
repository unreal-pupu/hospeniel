begin;

create table if not exists public.payment_audit_logs (
  id uuid default gen_random_uuid() primary key,
  paystack_reference text not null,
  service_request_id uuid references public.service_requests(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  vendor_id uuid references auth.users(id) on delete set null,
  verification_status text not null,
  paystack_response jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_payment_audit_logs_reference on public.payment_audit_logs(paystack_reference);
create index if not exists idx_payment_audit_logs_service_request_id on public.payment_audit_logs(service_request_id);
create index if not exists idx_payment_audit_logs_created_at on public.payment_audit_logs(created_at);

alter table public.payment_audit_logs enable row level security;

commit;
