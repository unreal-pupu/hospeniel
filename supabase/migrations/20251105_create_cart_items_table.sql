-- Create cart_items table for multi-vendor cart system
-- This table stores cart items for authenticated users
-- Each item links to a product (menu_item) and vendor

begin;

-- Create cart_items table
create table if not exists public.cart_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  vendor_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references public.menu_items(id) on delete cascade not null,
  quantity integer not null default 1 check (quantity > 0),
  price numeric(10, 2) not null check (price >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Prevent duplicate items (same user, vendor, product)
  unique(user_id, vendor_id, product_id)
);

-- Create indexes for better query performance
create index if not exists idx_cart_items_user_id on public.cart_items(user_id);
create index if not exists idx_cart_items_vendor_id on public.cart_items(vendor_id);
create index if not exists idx_cart_items_product_id on public.cart_items(product_id);
create index if not exists idx_cart_items_created_at on public.cart_items(created_at desc);

-- Create function to update updated_at timestamp
create or replace function update_cart_items_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
drop trigger if exists update_cart_items_updated_at on public.cart_items;
create trigger update_cart_items_updated_at
  before update on public.cart_items
  for each row
  execute function update_cart_items_updated_at();

-- Grant permissions
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;

-- Enable RLS
alter table if exists public.cart_items enable row level security;

-- Drop existing policies if any (to prevent conflicts)
drop policy if exists "Users can view own cart items" on public.cart_items;
drop policy if exists "Users can insert own cart items" on public.cart_items;
drop policy if exists "Users can update own cart items" on public.cart_items;
drop policy if exists "Users can delete own cart items" on public.cart_items;

-- Policy 1: Users can view their own cart items
create policy "Users can view own cart items"
  on public.cart_items
  for select
  to authenticated
  using (user_id = auth.uid());

-- Policy 2: Users can insert their own cart items
create policy "Users can insert own cart items"
  on public.cart_items
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Policy 3: Users can update their own cart items
create policy "Users can update own cart items"
  on public.cart_items
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Policy 4: Users can delete their own cart items
create policy "Users can delete own cart items"
  on public.cart_items
  for delete
  to authenticated
  using (user_id = auth.uid());

commit;

-- Enable real-time for cart_items table
-- Note: This may fail if real-time is already enabled, which is fine
do $$
begin
  -- Check if table is already in the publication
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'cart_items'
      and schemaname = 'public'
  ) then
    alter publication supabase_realtime add table public.cart_items;
    raise notice 'Real-time enabled for cart_items table';
  else
    raise notice 'Real-time already enabled for cart_items table';
  end if;
exception
  when others then
    raise notice 'Note: Real-time setup skipped (may already be enabled): %', sqlerrm;
end $$;

-- Verification queries (run separately to confirm):
--
-- 1. Check table structure:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'cart_items'
-- ORDER BY ordinal_position;
--
-- 2. Check RLS policies:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'cart_items';
--
-- 3. Check indexes:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'cart_items'
--   AND schemaname = 'public';
--
-- 4. Check real-time status:
-- SELECT tablename, schemaname
-- FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime'
--   AND tablename = 'cart_items';
--
-- 5. Test insert (as authenticated user):
-- INSERT INTO public.cart_items (user_id, vendor_id, product_id, quantity, price)
-- VALUES (auth.uid(), 'vendor-uuid', 'product-uuid', 1, 1000.00);







