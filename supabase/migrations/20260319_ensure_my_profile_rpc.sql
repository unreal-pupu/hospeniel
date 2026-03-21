-- RPC: create a default profiles row for the current auth user if missing (RLS-safe via security definer).
-- Used after sign-in when the auth trigger did not run (legacy users) or mobile timing hid the row briefly.

begin;

create or replace function public.ensure_my_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  au text;
  umeta jsonb;
  r text;
  uname text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.profiles p where p.id = uid) then
    return;
  end if;

  select u.email, u.raw_user_meta_data
  into au, umeta
  from auth.users u
  where u.id = uid;

  if not found then
    raise exception 'Auth user not found';
  end if;

  r := coalesce(nullif(trim(umeta->>'role'), ''), 'user');
  uname := coalesce(
    nullif(trim(umeta->>'name'), ''),
    nullif(split_part(coalesce(au, ''), '@', 1), ''),
    'User'
  );

  -- Align with public.handle_new_user() (full branch: rider_approval_status + is_available)
  insert into public.profiles (
    id,
    email,
    name,
    role,
    address,
    is_admin,
    rider_approval_status,
    is_available,
    location,
    category,
    phone_number
  ) values (
    uid,
    coalesce(au, ''),
    uname,
    r,
    '',
    false,
    case when r = 'rider' then 'pending'::text else null end,
    true,
    null,
    null,
    null
  )
  on conflict (id) do nothing;
end;
$$;

comment on function public.ensure_my_profile() is
  'Ensures public.profiles has a row for auth.uid(); idempotent. Security definer; only inserts for self.';

grant execute on function public.ensure_my_profile() to authenticated;
grant execute on function public.ensure_my_profile() to service_role;

commit;
