-- Hard reset profiles RLS policies to remove any recursive definitions.
-- This migration is idempotent and safe to re-run.

alter table if exists public.profiles enable row level security;

grant select, insert, update on public.profiles to authenticated;

create or replace function public.can_restaurant_view_shelter_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.request_responses rr
    join public.shelter_requests sr on sr.id = rr.request_id
    where rr.restaurant_id = auth.uid()
      and sr.shelter_id = target_profile_id
  )
  or exists (
    select 1
    from public.shelter_requests sr
    join public.donations d on d.id = sr.matched_donation_id
    where d.restaurant_id = auth.uid()
      and sr.shelter_id = target_profile_id
      and sr.status = 'matched'
  );
$$;

create or replace function public.can_shelter_view_restaurant_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.request_responses rr
    join public.shelter_requests sr on sr.id = rr.request_id
    where sr.shelter_id = auth.uid()
      and rr.restaurant_id = target_profile_id
  );
$$;

revoke all on function public.can_restaurant_view_shelter_profile(uuid) from public;
grant execute on function public.can_restaurant_view_shelter_profile(uuid) to authenticated;

revoke all on function public.can_shelter_view_restaurant_profile(uuid) from public;
grant execute on function public.can_shelter_view_restaurant_profile(uuid) to authenticated;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', p.policyname);
  end loop;
end $$;

create policy "profiles_select_self_authenticated"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_insert_self_authenticated"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles_update_self_authenticated"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_select_related_shelter_contacts_for_restaurants"
  on public.profiles
  for select
  to authenticated
  using (
    role = 'shelter'
    and public.can_restaurant_view_shelter_profile(id)
  );

create policy "profiles_select_related_restaurants_for_shelters"
  on public.profiles
  for select
  to authenticated
  using (
    role = 'restaurant'
    and public.can_shelter_view_restaurant_profile(id)
  );
