-- Respond/accept lifecycle integrity safeguards.
-- 1) Ensure one response per (request, restaurant).
-- 2) Accept flow runs atomically and only from pending/open|responded states.

create unique index if not exists request_responses_request_id_restaurant_id_uidx
  on public.request_responses (request_id, restaurant_id);

create or replace function public.accept_request_response(
  p_request_id uuid,
  p_response_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.shelter_requests%rowtype;
  v_response public.request_responses%rowtype;
begin
  select *
  into v_request
  from public.shelter_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_request.shelter_id <> auth.uid() then
    raise exception 'Not authorized to accept responses for this request';
  end if;

  if v_request.status not in ('open', 'responded') then
    raise exception 'Request is not in an acceptable state';
  end if;

  select *
  into v_response
  from public.request_responses
  where id = p_response_id
    and request_id = p_request_id
  for update;

  if not found then
    raise exception 'Response not found for this request';
  end if;

  if v_response.status <> 'pending' then
    raise exception 'Only pending responses can be accepted';
  end if;

  update public.shelter_requests
  set
    status = 'matched',
    matched_donation_id = v_response.donation_id,
    pickup_window = coalesce(v_response.proposed_pickup_window, pickup_window)
  where id = p_request_id
    and status in ('open', 'responded');

  if not found then
    raise exception 'Request could not be moved to matched';
  end if;

  update public.request_responses
  set status = 'accepted'
  where id = p_response_id
    and request_id = p_request_id
    and status = 'pending';

  if not found then
    raise exception 'Response could not be accepted';
  end if;

  update public.request_responses
  set status = 'rejected'
  where request_id = p_request_id
    and status = 'pending'
    and id <> p_response_id;

  if v_response.donation_id is not null then
    update public.donations
    set
      status = 'matched',
      matched_shelter_id = v_request.shelter_id
    where id = v_response.donation_id;
  end if;
end;
$$;

revoke all on function public.accept_request_response(uuid, uuid) from public;
grant execute on function public.accept_request_response(uuid, uuid) to authenticated;
