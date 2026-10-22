-- P1 item 7: location-aware matching.
--
-- 1) Coordinates on profiles, shelter requests and donations (offers and
--    listings). The app geocodes addresses through /api/geocode (US Census
--    geocoder, falling back to the ZIP centroid) and writes them with the
--    row; geocode_source records which one matched.
-- 2) profiles.service_radius_miles: how far a restaurant serves / a shelter
--    can travel. Used to filter requests and listings by distance.
-- 3) Offers copy the restaurant's coordinates unless the pickup address is
--    overridden, in which case the client passes the override's
--    coordinates. Claimed listings copy the shelter's coordinates.

begin;

alter table public.profiles
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists geocode_source text,
  add column if not exists service_radius_miles numeric not null default 10;

alter table public.profiles drop constraint if exists profiles_geocode_source_check;
alter table public.profiles
  add constraint profiles_geocode_source_check
  check (geocode_source is null or geocode_source in ('address', 'zip'));

alter table public.profiles drop constraint if exists profiles_service_radius_check;
alter table public.profiles
  add constraint profiles_service_radius_check
  check (service_radius_miles > 0 and service_radius_miles <= 100);

alter table public.shelter_requests
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.donations
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

-- New signature (adds override coordinates): drop the item-10 version so
-- PostgREST doesn't see two overloads.
drop function if exists public.submit_request_response(uuid, text, text, text, integer, text, text, text, text, timestamptz, timestamptz, text, text[], text, numeric, boolean);

create or replace function public.submit_request_response(
  p_request_id uuid,
  p_proposed_pickup_window text default null,
  p_response_note text default null,
  p_food_type text default null,
  p_quantity integer default null,
  p_pickup_address text default null,
  p_pickup_city text default null,
  p_pickup_state text default null,
  p_pickup_zip text default null,
  p_prepared_at timestamptz default null,
  p_use_by timestamptz default null,
  p_storage_type text default null,
  p_allergens text[] default '{}',
  p_allergen_notes text default null,
  p_estimated_weight_lbs numeric default null,
  p_safety_checklist_confirmed boolean default false,
  p_pickup_latitude double precision default null,
  p_pickup_longitude double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_request public.shelter_requests%rowtype;
  v_existing public.request_responses%rowtype;
  v_override boolean;
  v_donation_id uuid;
  v_response_id uuid;
begin
  perform set_config('plateshare.allow_transition', 'on', true);

  select * into v_profile from public.profiles where id = auth.uid();
  if not found or v_profile.role <> 'restaurant' then
    raise exception 'Only restaurants can respond to requests';
  end if;

  if not coalesce(p_safety_checklist_confirmed, false) then
    raise exception 'Confirm the food-safety checklist before submitting';
  end if;

  select * into v_request
  from public.shelter_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_request.status not in ('open', 'responded') then
    raise exception 'Request is no longer open';
  end if;

  if p_quantity is not null and p_quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  select * into v_existing
  from public.request_responses
  where request_id = p_request_id
    and restaurant_id = auth.uid()
  for update;

  if found and v_existing.status in ('pending', 'accepted') then
    raise exception 'You already have an active response for this request';
  end if;

  v_override := nullif(trim(coalesce(p_pickup_address, '')), '') is not null;

  insert into public.donations (
    restaurant_id, restaurant_name, food_type, quantity, pickup_window,
    address, city, state, zip_code, pickup_address_override, status,
    prepared_at, use_by, storage_type, allergens, allergen_notes,
    estimated_weight_lbs, safety_checklist_confirmed_at, latitude, longitude
  )
  values (
    auth.uid(),
    v_profile.name,
    coalesce(nullif(trim(coalesce(p_food_type, '')), ''), v_profile.cuisine),
    p_quantity,
    coalesce(nullif(trim(coalesce(p_proposed_pickup_window, '')), ''), v_profile.default_pickup_window),
    case when v_override then p_pickup_address else v_profile.address end,
    case when v_override then p_pickup_city else v_profile.city end,
    case when v_override then p_pickup_state else v_profile.state end,
    case when v_override then p_pickup_zip else v_profile.zip_code end,
    v_override,
    'posted',
    p_prepared_at,
    p_use_by,
    p_storage_type,
    coalesce(p_allergens, '{}'),
    nullif(trim(coalesce(p_allergen_notes, '')), ''),
    p_estimated_weight_lbs,
    now(),
    case when v_override then p_pickup_latitude else v_profile.latitude end,
    case when v_override then p_pickup_longitude else v_profile.longitude end
  )
  returning id into v_donation_id;

  if v_existing.id is not null then
    update public.request_responses
    set
      donation_id = v_donation_id,
      proposed_pickup_window = nullif(trim(coalesce(p_proposed_pickup_window, '')), ''),
      response_note = nullif(trim(coalesce(p_response_note, '')), ''),
      status = 'pending'
    where id = v_existing.id
    returning id into v_response_id;
  else
    insert into public.request_responses (
      request_id, restaurant_id, donation_id, proposed_pickup_window, response_note, status
    )
    values (
      p_request_id,
      auth.uid(),
      v_donation_id,
      nullif(trim(coalesce(p_proposed_pickup_window, '')), ''),
      nullif(trim(coalesce(p_response_note, '')), ''),
      'pending'
    )
    returning id into v_response_id;
  end if;

  if v_request.status = 'open' then
    update public.shelter_requests set status = 'responded' where id = p_request_id;
  end if;

  return v_response_id;
end;
$$;

revoke all on function public.submit_request_response(uuid, text, text, text, integer, text, text, text, text, timestamptz, timestamptz, text, text[], text, numeric, boolean, double precision, double precision) from public;
grant execute on function public.submit_request_response(uuid, text, text, text, integer, text, text, text, text, timestamptz, timestamptz, text, text[], text, numeric, boolean, double precision, double precision) to authenticated;

-- Same as item 6, plus the shelter's coordinates on the new request.
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
    shelter_contact_email, shelter_contact_phone, origin, latitude, longitude
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
    'listing',
    v_shelter.latitude,
    v_shelter.longitude
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

commit;
