-- Create orders table for vendor order management
-- This table stores orders placed by users on vendor products

begin;

-- Create orders table if it doesn't exist
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  vendor_id uuid references auth.users(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references public.menu_items(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  total_price numeric(10, 2) not null check (total_price >= 0),
  status text not null default 'Pending' check (status in ('Pending', 'Accepted', 'Completed', 'Cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create index for faster queries
create index if not exists idx_orders_vendor_id on public.orders(vendor_id);
create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_created_at on public.orders(created_at desc);

-- Create function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
drop trigger if exists update_orders_updated_at on public.orders;
create trigger update_orders_updated_at
  before update on public.orders
  for each row
  execute function update_updated_at_column();

-- Grant permissions
grant usage on schema public to authenticated;
grant select, insert, update on public.orders to authenticated;

-- Enable RLS
alter table if exists public.orders enable row level security;

-- Drop existing policies if any
drop policy if exists "Vendors can view own orders" on public.orders;
drop policy if exists "Vendors can update own orders" on public.orders;
drop policy if exists "Users can view own orders" on public.orders;
drop policy if exists "Users can create orders" on public.orders;

-- Policy 1: Vendors can view their own orders
create policy "Vendors can view own orders"
  on public.orders
  for select
  to authenticated
  using (vendor_id = auth.uid());

-- Policy 2: Vendors can update their own orders
create policy "Vendors can update own orders"
  on public.orders
  for update
  to authenticated
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

-- Policy 3: Users can view their own orders
create policy "Users can view own orders"
  on public.orders
  for select
  to authenticated
  using (user_id = auth.uid());

-- Policy 4: Users can create orders
create policy "Users can create orders"
  on public.orders
  for insert
  to authenticated
  with check (user_id = auth.uid());

commit;

-- Verification queries (run separately to confirm):
--
-- 1. Check table structure:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'orders'
-- ORDER BY ordinal_position;
--
-- 2. Check RLS policies:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'orders';
--
-- 3. Check indexes:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'orders'
--   AND schemaname = 'public';

