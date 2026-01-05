-- Create database triggers for automatic notification creation
-- These triggers automatically create notifications for order and payment events

begin;

-- ============================================
-- FUNCTION: Create notification for vendor when order is placed
-- ============================================
create or replace function notify_vendor_new_order()
returns trigger as $$
declare
  vendor_name text;
  user_name text;
begin
  -- Get vendor name from profiles
  select name into vendor_name
  from public.profiles
  where id = new.vendor_id;
  
  -- Get user name from profiles
  select name into user_name
  from public.profiles
  where id = new.user_id;
  
  -- Create notification for vendor
  insert into public.notifications (vendor_id, message, type)
  values (
    new.vendor_id,
    'You received a new order from ' || coalesce(user_name, 'a customer'),
    'order_update'
  );
  
  return new;
end;
$$ language plpgsql security definer;

-- ============================================
-- FUNCTION: Create notification for user when order status changes
-- ============================================
create or replace function notify_user_order_update()
returns trigger as $$
declare
  vendor_name text;
begin
  -- Notify if status changed to Accepted, Confirmed, or Paid
  if new.status != old.status and new.status in ('Accepted', 'Confirmed', 'Paid') then
    -- Get vendor name from profiles
    select name into vendor_name
    from public.profiles
    where id = new.vendor_id;
    
    -- Create notification for user
    if new.status = 'Paid' then
      insert into public.notifications (user_id, message, type)
      values (
        new.user_id,
        'Your payment for order #' || substring(new.id::text, 1, 8) || ' was successful',
        'payment'
      );
    else
      insert into public.notifications (user_id, message, type)
      values (
        new.user_id,
        'Your order has been ' || lower(new.status) || ' by ' || coalesce(vendor_name, 'the vendor'),
        'order_update'
      );
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- ============================================
-- FUNCTION: Create notification for payment success
-- ============================================
create or replace function notify_payment_success()
returns trigger as $$
begin
  -- Only notify when payment status changes to 'success'
  if new.status = 'success' and (old.status is null or old.status != 'success') then
    -- Create notification for user
    insert into public.notifications (user_id, message, type)
    values (
      new.user_id,
      'Payment of ₦' || to_char(new.total_amount, 'FM999,999,999.00') || ' was successful',
      'payment'
    );
    
    -- Get vendor IDs from orders linked to this payment
    -- Create notifications for all vendors involved
    insert into public.notifications (vendor_id, message, type)
    select distinct
      o.vendor_id,
      'Payment received for order #' || substring(o.id::text, 1, 8),
      'payment'
    from public.orders o
    where o.payment_reference = new.payment_reference
      and o.vendor_id is not null;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- ============================================
-- TRIGGERS
-- ============================================

-- Drop existing triggers if any
drop trigger if exists trigger_notify_vendor_new_order on public.orders;
drop trigger if exists trigger_notify_user_order_update on public.orders;
drop trigger if exists trigger_notify_payment_success on public.payments;

-- Trigger 1: Notify vendor when new order is placed
create trigger trigger_notify_vendor_new_order
  after insert on public.orders
  for each row
  execute function notify_vendor_new_order();

-- Trigger 2: Notify user when order status changes to Accepted or Confirmed
create trigger trigger_notify_user_order_update
  after update on public.orders
  for each row
  when (new.status != old.status)
  execute function notify_user_order_update();

-- Trigger 3: Notify user and vendors when payment is successful
create trigger trigger_notify_payment_success
  after insert or update on public.payments
  for each row
  execute function notify_payment_success();

commit;

-- Verification queries (run separately):
--
-- 1. Check functions:
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name LIKE 'notify%';
--
-- 2. Check triggers:
-- SELECT trigger_name, event_object_table, action_timing, event_manipulation
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND trigger_name LIKE 'trigger_notify%';
--
-- 3. Test order creation (should create vendor notification):
-- INSERT INTO public.orders (user_id, vendor_id, product_id, quantity, total_price, status)
-- VALUES (auth.uid(), 'vendor_id_here', 'product_id_here', 1, 1000.00, 'Pending');
--
-- 4. Test order status update (should create user notification):
-- UPDATE public.orders
-- SET status = 'Accepted'
-- WHERE id = 'order_id_here' AND vendor_id = auth.uid();
--
-- 5. Test payment success (should create user and vendor notifications):
-- UPDATE public.payments
-- SET status = 'success'
-- WHERE id = 'payment_id_here' AND user_id = auth.uid();

