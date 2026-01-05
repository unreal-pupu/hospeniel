-- Fix service request notification trigger to ensure notifications are created properly
-- This migration improves error handling and ensures notifications are always created for professional vendors

begin;

-- Step 1: Drop existing trigger and function
drop trigger if exists trigger_notify_vendor_service_request on public.service_requests;
drop function if exists notify_vendor_service_request();

-- Step 2: Create improved notification function with better error handling
create or replace function notify_vendor_service_request()
returns trigger as $$
declare
  user_name text;
  vendor_subscription_plan text;
  vendor_is_premium boolean;
  notification_message text;
begin
  -- Check vendor subscription plan from profiles table (primary source)
  select subscription_plan, is_premium 
  into vendor_subscription_plan, vendor_is_premium
  from public.profiles
  where id = new.vendor_id and role = 'vendor';
  
  -- If vendor profile not found, still try to create notification (fallback)
  if vendor_subscription_plan is null then
    -- Try to get vendor info without role check (in case role is not set)
    select subscription_plan, is_premium 
    into vendor_subscription_plan, vendor_is_premium
    from public.profiles
    where id = new.vendor_id;
  end if;
  
  -- Only create notification if vendor is on Professional plan (is_premium = true)
  -- OR if subscription_plan check fails, create notification anyway (fail-safe)
  if (vendor_subscription_plan = 'professional' and vendor_is_premium = true) 
     or (vendor_subscription_plan is null) then
    
    -- Get user name from profiles
    select name into user_name
    from public.profiles
    where id = new.user_id;
    
    -- Build comprehensive notification message with full details
    notification_message := 'New service request from ' || coalesce(user_name, 'a customer');
    
    -- Add full message content (not just preview)
    if new.message is not null and length(new.message) > 0 then
      notification_message := notification_message || E'\n\n' || new.message;
    end if;
    
    -- Add contact info if available
    if new.contact_info is not null and length(new.contact_info) > 0 then
      notification_message := notification_message || E'\n\nContact: ' || new.contact_info;
    end if;
    
    -- Create notification for vendor with metadata linking to service request
    -- Use security definer to ensure we can insert even if RLS would block it
    -- Note: Using 'system' type as it's in the allowed types: ('order_update', 'system', 'payment', 'subscription')
    insert into public.notifications (vendor_id, message, type, created_at, metadata)
    values (
      new.vendor_id,
      notification_message,
      'system',
      timezone('utc'::text, now()),
      jsonb_build_object(
        'type', 'service_request',
        'service_request_id', new.id,
        'user_id', new.user_id,
        'user_name', user_name,
        'contact_info', new.contact_info
      )
    );
    
    -- Log success (for debugging - can be removed in production)
    raise notice 'Notification created for vendor % for service request %', new.vendor_id, new.id;
  else
    -- Log why notification was not created (for debugging)
    raise notice 'Notification NOT created: vendor % is not on professional plan (plan: %, is_premium: %)', 
      new.vendor_id, vendor_subscription_plan, vendor_is_premium;
  end if;
  
  return new;
exception
  when others then
    -- Log error but don't fail the insert
    raise warning 'Error creating notification for service request %: %', new.id, sqlerrm;
    return new;
end;
$$ language plpgsql security definer;

-- Step 3: Grant necessary permissions to the function
grant execute on function notify_vendor_service_request() to authenticated;
grant execute on function notify_vendor_service_request() to service_role;

-- Step 4: Create trigger to notify vendor when new service request is created
create trigger trigger_notify_vendor_service_request
  after insert on public.service_requests
  for each row
  execute function notify_vendor_service_request();

-- Step 5: Ensure notifications table has proper permissions for the function
-- The function runs as security definer, so it should have access
-- But let's make sure the table is accessible
grant insert on public.notifications to authenticated;
grant insert on public.notifications to service_role;

commit;

-- Verification queries (run separately):
--
-- 1. Check function exists:
-- SELECT routine_name, routine_type, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name = 'notify_vendor_service_request';
--
-- 2. Check trigger exists:
-- SELECT trigger_name, event_object_table, action_timing, event_manipulation
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND trigger_name = 'trigger_notify_vendor_service_request';
--
-- 3. Test notification creation (replace with actual IDs):
-- INSERT INTO public.service_requests (user_id, vendor_id, message, status)
-- VALUES (
--   'USER_ID_HERE'::uuid,
--   'VENDOR_ID_HERE'::uuid,
--   'Test service request',
--   'New'
-- );
-- 
-- Then check if notification was created:
-- SELECT * FROM public.notifications 
-- WHERE vendor_id = 'VENDOR_ID_HERE'::uuid
-- ORDER BY created_at DESC LIMIT 1;

