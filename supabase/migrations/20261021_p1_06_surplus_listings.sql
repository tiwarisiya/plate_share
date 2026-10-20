-- P1 item 6: restaurants post surplus food that shelters can claim.
--
-- A listing is a donation with kind = 'listing' (responses' offers are
-- kind = 'offer'). Shelters see posted, unexpired listings and claim one
-- with claim_listing, which creates a matched shelter_requests row
-- (origin = 'listing') plus an accepted response, so chat, the matched
-- views and the pickup handshake work exactly as for a request.
--
-- Status changes on donations now go through functions only, like
-- requests: claim_listing, withdraw_listing, and the P0/P1 transition
-- functions.

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

alter table public.donations
  add column if not exists kind text not null default 'offer',
  add column if not exists description text,
  add column if not exists pickup_by timestamptz,
  add column if not exists photo_path text;

alter table public.donations drop constraint if exists donations_kind_check;
alter table public.donations
  add constraint donations_kind_check check (kind in ('offer', 'listing'));

alter table public.donations drop constraint if exists donations_status_check;
alter table public.donations
  add constraint donations_status_check
  check (status in ('posted', 'matched', 'completed', 'cancelled'));

create index if not exists idx_donations_kind_status on public.donations (kind, status);

alter table public.shelter_requests
  add column if not exists origin text not null default 'request';

alter table public.shelter_requests drop constraint if exists shelter_requests_origin_check;
alter table public.shelter_requests
  add constraint shelter_requests_origin_check check (origin in ('request', 'listing'));

-- ---------------------------------------------------------------------------
-- 2. Guard: status / match / kind change only inside transition functions
-- ---------------------------------------------------------------------------

create or replace function public.guard_donation_update()
returns trigger
language plpgsql
as $$
begin
  if public.transition_allowed() then
    return new;
  end if;

  if new.status is distinct from old.status
    or new.matched_shelter_id is distinct from old.matched_shelter_id
    or new.kind is distinct from old.kind
    or new.restaurant_id is distinct from old.restaurant_id then
    raise exception 'Donation status, match and owner change only through claim_listing, withdraw_listing or the request transition functions';
  end if;

  if old.status <> 'posted' then
    raise exception 'Only posted donations can be edited';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_donations_guard on public.donations;
create trigger trg_donations_guard
  before update on public.donations
  for each row execute function public.guard_donation_update();

-- The P0 transition functions update donations; they already set the flag.

-- ---------------------------------------------------------------------------
-- 3. Policies
-- ---------------------------------------------------------------------------

-- Restaurants insert listings directly (offers come from
-- submit_request_response).
drop policy if exists donations_restaurant_insert_own on public.donations;
create policy donations_restaurant_insert_own
  on public.donations for insert to authenticated
  with check (
    restaurant_id = auth.uid()
    and kind = 'listing'
    and status = 'posted'
    and matched_shelter_id is null
    and safety_checklist_confirmed_at is not null
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'restaurant')
  );

drop policy if exists donations_shelter_select_visible on public.donations;
create policy donations_shelter_select_visible
  on public.donations for select to authenticated
  using (
    matched_shelter_id = auth.uid()
    or public.donation_offered_to_current_shelter(id)
    or (
      kind = 'listing'
      and status = 'posted'
      and (pickup_by is null or pickup_by > now())
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'shelter')
    )
  );

-- Shelters see the restaurant behind a listing they can see or claimed.
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
  )
  or exists (
    select 1
    from public.donations d
    join public.profiles me on me.id = auth.uid() and me.role = 'shelter'
    where d.restaurant_id = target_profile_id
      and d.kind = 'listing'
      and d.status = 'posted'
      and (d.pickup_by is null or d.pickup_by > now())
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Functions
-- ---------------------------------------------------------------------------

create or replace function public.claim_listing(p_donation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shelter public.profiles%rowtype;
  v_donation public.donations%rowtype;
  v_request_id uuid;
begin
  perform set_config('plateshare.allow_transition', 'on', true);

  select * into v_shelter from public.profiles where id = auth.uid();
  if not found or v_shelter.role <> 'shelter' then
    raise exception 'Only shelters can claim listings';
  end if;

  select * into v_donation
  from public.donations
  where id = p_donation_id
  for update;

  if not found or v_donation.kind <> 'listing' then
    raise exception 'Listing not found';
  end if;

  if v_donation.status <> 'posted' then
    raise exception 'This listing has already been claimed or withdrawn';
  end if;

  if v_donation.pickup_by is not null and v_donation.pickup_by <= now() then
    raise exception 'This listing has expired';
  end if;

  insert into public.shelter_requests (
    shelter_id, title, request_type, food_needed, quantity, pickup_window,
    address, city, state, zip_code, notes, status, matched_donation_id,
    shelter_contact_email, shelter_contact_phone, origin
  )
  values (
    auth.uid(),
    coalesce(v_donation.food_type, 'Claimed listing'),
    'Claimed listing',
    v_donation.food_type,
    v_donation.quantity,
    v_donation.pickup_window,
    v_shelter.address,
    v_shelter.city,
    v_shelter.state,
    v_shelter.zip_code,
    v_donation.description,
    'matched',
    v_donation.id,
    v_shelter.email,
    v_shelter.phone,
    'listing'
  )
  returning id into v_request_id;

  insert into public.request_responses (
    request_id, restaurant_id, donation_id, proposed_pickup_window, status
  )
  values (v_request_id, v_donation.restaurant_id, v_donation.id, v_donation.pickup_window, 'accepted');

  update public.donations
  set status = 'matched', matched_shelter_id = auth.uid()
  where id = v_donation.id;

  return v_request_id;
end;
$$;

create or replace function public.withdraw_listing(p_donation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('plateshare.allow_transition', 'on', true);

  update public.donations
  set status = 'cancelled'
  where id = p_donation_id
    and kind = 'listing'
    and status = 'posted'
    and restaurant_id = auth.uid();

  if not found then
    raise exception 'Only your own unclaimed listings can be withdrawn';
  end if;
end;
$$;

revoke all on function public.claim_listing(uuid) from public;
revoke all on function public.withdraw_listing(uuid) from public;
grant execute on function public.claim_listing(uuid) to authenticated;
grant execute on function public.withdraw_listing(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Photo storage (skipped where the storage schema doesn't exist)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('listing-photos', 'listing-photos', true)
    on conflict (id) do nothing;

    execute 'drop policy if exists listing_photos_insert_own on storage.objects';
    execute $p$
      create policy listing_photos_insert_own
        on storage.objects for insert to authenticated
        with check (
          bucket_id = 'listing-photos'
          and (storage.foldername(name))[1] = auth.uid()::text
        )
    $p$;

    execute 'drop policy if exists listing_photos_delete_own on storage.objects';
    execute $p$
      create policy listing_photos_delete_own
        on storage.objects for delete to authenticated
        using (
          bucket_id = 'listing-photos'
          and (storage.foldername(name))[1] = auth.uid()::text
        )
    $p$;
  end if;
end;
$$;

commit;
