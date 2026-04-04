-- Align public read on vendor_service_profiles with Explore / profiles (source of truth for chef vs home cook).
-- Previously, anon could only read rows where vendors.category was chef/home_cook; vendors.category can lag
-- profiles.category, so browser fetches on /vendors/profile/[id] returned no service profile image while
-- /api/service-profile-vendors (service role) still showed the image on Explore.

begin;

drop policy if exists "Public can view service profiles" on public.vendor_service_profiles;

create policy "Public can view service profiles"
  on public.vendor_service_profiles
  for select
  to public
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = vendor_service_profiles.profile_id
        and p.role = 'vendor'
        and p.category in ('chef', 'home_cook')
    )
  );

commit;
