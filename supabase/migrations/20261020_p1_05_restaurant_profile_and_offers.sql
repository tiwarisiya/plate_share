-- P1 item 5: restaurant profile data lives on profiles; donations are
-- per-offer records.
--
-- Before: onboarding inserted a donation row to hold the restaurant's food
-- types and address, settings edited the address on that row, and every
-- response to a shelter request reused it. So "profile complete" depended on
-- a donation existing and all of a restaurant's matches pointed at one row.
--
-- After:
-- 1) profiles.cuisine and profiles.default_pickup_window hold the restaurant
--    defaults (address/city/state/zip were already on profiles). Backfilled
--    from each restaurant's latest donation row.
-- 2) submit_request_response creates a new donation (the offer) for every
--    response, with an optional pickup-address override that defaults to the
--    profile address, mirroring the shelter request location override.
-- 3) Shelters only see donations offered on their own requests or matched to
--    them, instead of every posted/matched donation.

begin;

-- ---------------------------------------------------------------------------
-- 1. Restaurant defaults on profiles
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists cuisine text,
  add column if not exists default_pickup_window text;

with latest as (
  select distinct on (d.restaurant_id)
    d.restaurant_id, d.food_type, d.pickup_window, d.address, d.city, d.state, d.zip_code
  from public.donations d
  order by d.restaurant_id, d.created_at desc
)
update public.profiles p
set
  cuisine = coalesce(p.cuisine, latest.food_type),
  default_pickup_window = coalesce(p.default_pickup_window, latest.pickup_window),
  address = coalesce(p.address, latest.address),
  city = coalesce(p.city, latest.city),
  state = coalesce(p.state, latest.state),
  zip_code = coalesce(p.zip_code, latest.zip_code)
from latest
where latest.restaurant_id = p.id
  and p.role = 'restaurant';

-- ---------------------------------------------------------------------------
-- 2. Offers
-- ---------------------------------------------------------------------------

-- Whether the offer's pickup address was typed for this offer rather than
-- copied from the profile.
alter table public.donations
  add column if not exists pickup_address_override boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_donations_updated_at on public.donations;
create trigger trg_donations_updated_at
  before update on public.donations
  for each row execute function public.set_updated_at();

-- One call creates (or, on resubmission, refreshes) the offer and the
-- pending response together, so a response can't point at another
-- response's offer and no orphan offers are left behind on failure.
create or replace function public.submit_request_response(
  p_request_id uuid,
  p_proposed_pickup_window text default null,
  p_response_note text default null,
  p_food_type text default null,
  p_quantity integer default null,
  p_pickup_address text default null,
  p_pickup_city text default null,
  p_pickup_state text default null,
  p_pickup_zip text default null
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
    address, city, state, zip_code, pickup_address_override, status
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
    'posted'
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

revoke all on function public.submit_request_response(uuid, text, text, text, integer, text, text, text, text) from public;
grant execute on function public.submit_request_response(uuid, text, text, text, integer, text, text, text, text) to authenticated;

-- Responses are created through submit_request_response only, so each one
-- has its own offer. Restaurants can still withdraw (update to cancelled).
drop policy if exists request_responses_insert_restaurant_own on public.request_responses;

drop policy if exists request_responses_update_restaurant_own on public.request_responses;
create policy request_responses_update_restaurant_own
  on public.request_responses for update to authenticated
  using (restaurant_id = auth.uid())
  with check (
    restaurant_id = auth.uid()
    and status = 'cancelled'
    and exists (
      select 1 from public.shelter_requests sr
      where sr.id = request_responses.request_id
        and sr.status in ('open', 'responded')
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Shelter visibility of offers
-- ---------------------------------------------------------------------------

-- security definer so the donations policy doesn't evaluate the
-- request_responses and shelter_requests policies (which reference
-- donations) and recurse.
create or replace function public.donation_offered_to_current_shelter(p_donation_id uuid)
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
    where rr.donation_id = p_donation_id
      and sr.shelter_id = auth.uid()
  );
$$;

revoke all on function public.donation_offered_to_current_shelter(uuid) from public;
grant execute on function public.donation_offered_to_current_shelter(uuid) to authenticated;

drop policy if exists donations_shelter_select_visible on public.donations;
create policy donations_shelter_select_visible
  on public.donations for select to authenticated
  using (
    matched_shelter_id = auth.uid()
    or public.donation_offered_to_current_shelter(id)
  );

commit;
