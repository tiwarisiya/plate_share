-- P1 item 11 (first step): pickup method on offers and listings.
--
-- 'self' (the shelter collects, today's flow) or 'courier' (a delivery
-- provider brings the food to the shelter). Courier booking needs DoorDash
-- Drive / Uber Direct credentials and isn't built yet; this only stores
-- the choice so the deliveries work can build on it.

begin;

alter table public.donations
  add column if not exists pickup_method text not null default 'self';

alter table public.donations drop constraint if exists donations_pickup_method_check;
alter table public.donations
  add constraint donations_pickup_method_check check (pickup_method in ('self', 'courier'));

-- New signature (adds p_pickup_method): drop the item-7 version so
-- PostgREST doesn't see two overloads.
drop function if exists public.submit_request_response(uuid, text, text, text, integer, text, text, text, text, timestamptz, timestamptz, text, text[], text, numeric, boolean, double precision, double precision);

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
  p_pickup_longitude double precision default null,
  p_pickup_method text default 'self'
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
    estimated_weight_lbs, safety_checklist_confirmed_at, latitude, longitude, pickup_method
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
    case when v_override then p_pickup_longitude else v_profile.longitude end,
    coalesce(p_pickup_method, 'self')
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

revoke all on function public.submit_request_response(uuid, text, text, text, integer, text, text, text, text, timestamptz, timestamptz, text, text[], text, numeric, boolean, double precision, double precision, text) from public;
grant execute on function public.submit_request_response(uuid, text, text, text, integer, text, text, text, text, timestamptz, timestamptz, text, text[], text, numeric, boolean, double precision, double precision, text) to authenticated;

commit;
