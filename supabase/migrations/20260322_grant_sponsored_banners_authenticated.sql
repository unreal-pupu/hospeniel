begin;

-- Ensure authenticated role can manage/read sponsored banners.
-- Without these GRANTs, RLS policies may not be sufficient and clients can get
-- "permission denied for table sponsored_banners" (42501).

do $$
begin
  if to_regclass('public.sponsored_banners') is not null then
    execute 'grant select, insert, update, delete on table public.sponsored_banners to authenticated';
  end if;
  if to_regclass('public.sponsored_banner_events') is not null then
    execute 'grant select, insert, update, delete on table public.sponsored_banner_events to authenticated';
  end if;
end $$;

commit;

