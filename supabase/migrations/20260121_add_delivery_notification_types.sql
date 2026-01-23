-- Extend notifications type constraint for delivery workflow notifications

begin;

do $$
begin
  alter table public.notifications
    drop constraint if exists notifications_type_check;

  alter table public.notifications
    add constraint notifications_type_check
    check (type in (
      'order_update',
      'system',
      'payment',
      'subscription',
      'new_order',
      'order_accepted',
      'order_rejected',
      'order_completed',
      'order_cancelled',
      'order_status_update',
      'new_task',
      'delivery_request',
      'rider_assigned',
      'order_in_transit',
      'delivery_completed',
      'order_delivered',
      'delivery_assigned',
      'delivery_route_assigned',
      'delivery_pickup'
    ));

  raise notice 'Updated notifications type constraint with delivery workflow types';
exception
  when others then
    raise notice 'Could not update notifications type constraint: %', sqlerrm;
end $$;

commit;

