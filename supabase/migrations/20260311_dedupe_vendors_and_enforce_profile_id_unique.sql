-- Deduplicate vendors by profile_id and enforce uniqueness
-- Keeps the lowest id per profile_id and remaps vendor_ratings to the kept record

begin;

-- Remap vendor_ratings to the kept vendor id (lowest id per profile_id)
with ranked as (
  select
    id,
    profile_id,
    row_number() over (partition by profile_id order by id asc) as rn,
    min(id) over (partition by profile_id) as keep_id
  from public.vendors
  where profile_id is not null
)
update public.vendor_ratings vr
set vendor_id = ranked.keep_id
from ranked
where vr.vendor_id = ranked.id
  and ranked.id <> ranked.keep_id;

-- Delete duplicate vendor rows (keep rn = 1)
with ranked as (
  select
    id,
    profile_id,
    row_number() over (partition by profile_id order by id asc) as rn
  from public.vendors
  where profile_id is not null
)
delete from public.vendors v
using ranked
where v.id = ranked.id
  and ranked.rn > 1;

-- Enforce uniqueness for future inserts
create unique index if not exists vendors_profile_id_unique
  on public.vendors (profile_id)
  where profile_id is not null;

commit;
