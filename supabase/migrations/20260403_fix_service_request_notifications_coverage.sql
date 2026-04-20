-- Previously contained subscription-based notification logic. This version is schema-safe:
-- no subscription fields and no local plpgsql variables referenced in SQL expressions.

begin;

drop trigger if exists trigger_notify_vendor_service_request on public.service_requests;
drop function if exists public.notify_vendor_service_request();

create or replace function public.notify_vendor_service_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.notifications (vendor_id, message, type, created_at, metadata)
  values (
    new.vendor_id,
    (
      'New service request from '
      || coalesce(
        (
          select pr.name
          from public.profiles as pr
          where pr.id = new.user_id
          limit 1
        ),
        'a customer'
      )
      || case
          when new.message is not null and length(trim(new.message)) > 0
            then E'\n\n' || new.message
          else ''
        end
      || case
          when new.contact_info is not null and length(trim(new.contact_info)) > 0
            then E'\n\nContact: ' || new.contact_info
          else ''
        end
    ),
    'system',
    timezone('utc'::text, now()),
    jsonb_build_object(
      'type', 'service_request',
      'service_request_id', new.id,
      'user_id', new.user_id,
      'requester_name',
      (
        select pr.name
        from public.profiles as pr
        where pr.id = new.user_id
        limit 1
      ),
      'contact_info', new.contact_info
    )
  );

  return new;
exception
  when others then
    raise warning 'notify_vendor_service_request: request % failed: %', new.id, sqlerrm;
    return new;
end;
$function$;

grant execute on function public.notify_vendor_service_request() to authenticated;
grant execute on function public.notify_vendor_service_request() to service_role;

create trigger trigger_notify_vendor_service_request
  after insert on public.service_requests
  for each row
  execute function public.notify_vendor_service_request();

commit;
