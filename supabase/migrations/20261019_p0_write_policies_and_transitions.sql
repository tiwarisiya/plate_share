-- P0: one status vocabulary, explicit write policies, and server-side
-- status transitions.
--
-- 1) shelter_requests uses 'completed' (not 'fulfilled'); donations may be
--    'completed' too. Old 'fulfilled' rows are migrated.
-- 2) The full RLS policy set for shelter_requests, donations and
--    request_responses is (re)created here, replacing hand-made policies
--    that let any restaurant update any request and any user update any
--    donation.
-- 3) Status and match changes happen only inside the functions below
--    (accept_request_response, complete_request, cancel_request). A trigger
--    rejects any other attempt, so RLS "update own row" can't be used to
--    flip a request to matched or a response to accepted.

begin;

-- ---------------------------------------------------------------------------
-- 1. Status vocabulary
-- ---------------------------------------------------------------------------

alter table public.shelter_requests drop constraint if exists shelter_requests_status_check;
update public.shelter_requests set status = 'completed' where status = 'fulfilled';
alter table public.shelter_requests
  add constraint shelter_requests_status_check
  check (status in ('open', 'responded', 'matched', 'completed', 'cancelled'));

alter table public.donations drop constraint if exists donations_status_check;
update public.donations set status = 'completed' where status = 'fulfilled';
alter table public.donations
  add constraint donations_status_check
  check (status in ('posted', 'matched', 'completed'));

-- ---------------------------------------------------------------------------
-- 2. Transition guards
-- ---------------------------------------------------------------------------

-- The transition functions set this flag for the rest of their transaction.
-- Clients can't set it: PostgREST runs each request in its own transaction
-- and set_config is not exposed as an RPC.
create or replace function public.transition_allowed()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('plateshare.allow_transition', true), '') = 'on';
$$;

create or replace function public.guard_shelter_request_update()
returns trigger
language plpgsql
as $$
begin
  if public.transition_allowed() then
    return new;
  end if;

  if new.status is distinct from old.status
    or new.matched_donation_id is distinct from old.matched_donation_id then
    raise exception 'Request status can only change through accept_request_response, complete_request or cancel_request';
  end if;

  if new.shelter_id is distinct from old.shelter_id then
    raise exception 'Request owner cannot change';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_shelter_requests_guard on public.shelter_requests;
create trigger trg_shelter_requests_guard
  before update on public.shelter_requests
  for each row execute function public.guard_shelter_request_update();

create or replace function public.guard_request_response_update()
returns trigger
language plpgsql
as $$
begin
  if public.transition_allowed() then
    return new;
  end if;

  if new.request_id is distinct from old.request_id
    or new.restaurant_id is distinct from old.restaurant_id then
    raise exception 'Response request and restaurant cannot change';
  end if;

  if new.status is distinct from old.status
    and (old.status = 'accepted' or new.status in ('accepted', 'rejected')) then
    raise exception 'Responses are accepted or rejected only through accept_request_response';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_request_responses_guard on public.request_responses;
create trigger trg_request_responses_guard
  before update on public.request_responses
  for each row execute function public.guard_request_response_update();

-- ---------------------------------------------------------------------------
-- 3. Policies
-- ---------------------------------------------------------------------------

do $$
declare
  p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('shelter_requests', 'donations', 'request_responses')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end;
$$;

-- shelter_requests ----------------------------------------------------------

create policy shelter_requests_select_own
  on public.shelter_requests for select to authenticated
  using (shelter_id = auth.uid());

create policy shelter_requests_restaurant_read
  on public.shelter_requests for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'restaurant')
    and (
      status in ('open', 'responded')
      or (
        status in ('matched', 'completed', 'cancelled')
        and exists (
          select 1 from public.donations d
          where d.id = shelter_requests.matched_donation_id
            and d.restaurant_id = auth.uid()
        )
      )
    )
  );

create policy shelter_requests_insert_own
  on public.shelter_requests for insert to authenticated
  with check (
    shelter_id = auth.uid()
    and status = 'open'
    and matched_donation_id is null
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'shelter')
  );

-- Field edits only; the guard trigger blocks status/match changes.
create policy shelter_requests_update_own
  on public.shelter_requests for update to authenticated
  using (shelter_id = auth.uid())
  with check (shelter_id = auth.uid());

create policy shelter_requests_delete_own
  on public.shelter_requests for delete to authenticated
  using (shelter_id = auth.uid());

-- donations -----------------------------------------------------------------

create policy donations_restaurant_select_own
  on public.donations for select to authenticated
  using (
    restaurant_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'restaurant')
  );

create policy donations_shelter_select_visible
  on public.donations for select to authenticated
  using (
    status in ('posted', 'matched')
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'shelter')
  );

create policy donations_restaurant_insert_own
  on public.donations for insert to authenticated
  with check (
    restaurant_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'restaurant')
  );

create policy donations_restaurant_update_own
  on public.donations for update to authenticated
  using (
    restaurant_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'restaurant')
  )
  with check (
    restaurant_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'restaurant')
  );

-- request_responses ---------------------------------------------------------

create policy request_responses_select_restaurant_own
  on public.request_responses for select to authenticated
  using (restaurant_id = auth.uid());

create policy request_responses_select_shelter_own_requests
  on public.request_responses for select to authenticated
  using (
    exists (
      select 1 from public.shelter_requests sr
      where sr.id = request_responses.request_id
        and sr.shelter_id = auth.uid()
    )
  );

create policy request_responses_insert_restaurant_own
  on public.request_responses for insert to authenticated
  with check (
    restaurant_id = auth.uid()
    and status = 'pending'
    and (
      donation_id is null
      or exists (select 1 from public.donations d where d.id = request_responses.donation_id and d.restaurant_id = auth.uid())
    )
    and exists (
      select 1 from public.shelter_requests sr
      where sr.id = request_responses.request_id
        and sr.status in ('open', 'responded')
    )
  );

-- A restaurant can resubmit (pending) or withdraw (cancelled) its own
-- response while the request is still open. Shelters accept through the RPC.
create policy request_responses_update_restaurant_own
  on public.request_responses for update to authenticated
  using (restaurant_id = auth.uid())
  with check (
    restaurant_id = auth.uid()
    and status in ('pending', 'cancelled')
    and (
      donation_id is null
      or exists (select 1 from public.donations d where d.id = request_responses.donation_id and d.restaurant_id = auth.uid())
    )
    and exists (
      select 1 from public.shelter_requests sr
      where sr.id = request_responses.request_id
        and sr.status in ('open', 'responded')
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Transition functions
-- ---------------------------------------------------------------------------

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
  perform set_config('plateshare.allow_transition', 'on', true);

  select * into v_request
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

  select * into v_response
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

  if v_response.donation_id is not null and not exists (
    select 1 from public.donations d
    where d.id = v_response.donation_id
      and d.restaurant_id = v_response.restaurant_id
  ) then
    raise exception 'Response donation does not belong to the responding restaurant';
  end if;

  update public.shelter_requests
  set
    status = 'matched',
    matched_donation_id = v_response.donation_id,
    pickup_window = coalesce(v_response.proposed_pickup_window, pickup_window)
  where id = p_request_id;

  update public.request_responses
  set status = 'accepted'
  where id = p_response_id;

  update public.request_responses
  set status = 'rejected'
  where request_id = p_request_id
    and status = 'pending'
    and id <> p_response_id;

  if v_response.donation_id is not null then
    update public.donations
    set status = 'matched', matched_shelter_id = v_request.shelter_id
    where id = v_response.donation_id;
  end if;
end;
$$;

create or replace function public.complete_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.shelter_requests%rowtype;
  v_donation_id uuid;
begin
  perform set_config('plateshare.allow_transition', 'on', true);

  select * into v_request
  from public.shelter_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_request.shelter_id <> auth.uid() then
    raise exception 'Not authorized to complete this request';
  end if;

  if v_request.status <> 'matched' then
    raise exception 'Only matched requests can be completed';
  end if;

  v_donation_id := v_request.matched_donation_id;
  if v_donation_id is null then
    select rr.donation_id into v_donation_id
    from public.request_responses rr
    where rr.request_id = p_request_id
      and rr.status = 'accepted'
    limit 1;
  end if;

  update public.shelter_requests
  set status = 'completed',
      matched_donation_id = v_donation_id
  where id = p_request_id;

  if v_donation_id is not null then
    update public.donations
    set status = 'completed'
    where id = v_donation_id
      and matched_shelter_id = v_request.shelter_id;
  end if;
end;
$$;

create or replace function public.cancel_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.shelter_requests%rowtype;
begin
  perform set_config('plateshare.allow_transition', 'on', true);

  select * into v_request
  from public.shelter_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_request.shelter_id <> auth.uid() then
    raise exception 'Not authorized to cancel this request';
  end if;

  if v_request.status not in ('open', 'responded') then
    raise exception 'Only open requests can be cancelled';
  end if;

  update public.shelter_requests
  set status = 'cancelled'
  where id = p_request_id;

  update public.request_responses
  set status = 'cancelled'
  where request_id = p_request_id
    and status = 'pending';
end;
$$;

-- The matched restaurant may adjust the pickup window, and nothing else.
create or replace function public.update_matched_pickup_window(
  p_request_id uuid,
  p_pickup_window text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.shelter_requests sr
  set pickup_window = p_pickup_window
  where sr.id = p_request_id
    and sr.status = 'matched'
    and exists (
      select 1 from public.donations d
      where d.id = sr.matched_donation_id
        and d.restaurant_id = auth.uid()
    );

  if not found then
    raise exception 'Only the matched restaurant can update the pickup window of a matched request';
  end if;
end;
$$;

revoke all on function public.accept_request_response(uuid, uuid) from public;
revoke all on function public.complete_request(uuid) from public;
revoke all on function public.cancel_request(uuid) from public;
revoke all on function public.update_matched_pickup_window(uuid, text) from public;
grant execute on function public.accept_request_response(uuid, uuid) to authenticated;
grant execute on function public.complete_request(uuid) to authenticated;
grant execute on function public.cancel_request(uuid) to authenticated;
grant execute on function public.update_matched_pickup_window(uuid, text) to authenticated;

commit;
