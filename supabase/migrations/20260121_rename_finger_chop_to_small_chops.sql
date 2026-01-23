-- Rename category value from finger_chop to small_chops
-- Keep profiles as source of truth and align vendors/category constraints

begin;

-- 1) Update existing rows
update public.profiles
set category = 'small_chops'
where category = 'finger_chop';

update public.vendors
set category = 'small_chops'
where category = 'finger_chop';

-- 2) Drop existing category check constraints (unknown names)
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid
    where rel.relname = 'profiles'
      and con.contype = 'c'
      and att.attname = 'category'
  loop
    execute format('alter table public.profiles drop constraint if exists %I', constraint_name);
  end loop;
end $$;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid
    where rel.relname = 'vendors'
      and con.contype = 'c'
      and att.attname = 'category'
  loop
    execute format('alter table public.vendors drop constraint if exists %I', constraint_name);
  end loop;
end $$;

-- 3) Recreate constraints with new value
alter table public.profiles
  add constraint profiles_category_check
  check (category is null or category in ('food_vendor', 'chef', 'baker', 'small_chops', 'home_cook'));

alter table public.vendors
  add constraint vendors_category_check
  check (category is null or category in ('food_vendor', 'chef', 'baker', 'small_chops', 'home_cook'));

commit;
