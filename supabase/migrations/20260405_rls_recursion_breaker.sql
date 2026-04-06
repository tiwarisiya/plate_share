-- Break RLS recursion between shelter_requests and request_responses.
--
-- Root cause:
-- - shelter_requests SELECT referenced request_responses
-- - request_responses SELECT referenced shelter_requests
-- This creates cyclic policy evaluation and triggers 42P17.

alter table if exists public.shelter_requests enable row level security;
alter table if exists public.request_responses enable row level security;

-- Rebuild shelter_requests SELECT policies (non-recursive).
drop policy if exists shelter_requests_select_own on public.shelter_requests;
drop policy if exists shelter_requests_restaurant_read on public.shelter_requests;

create policy shelter_requests_select_own
  on public.shelter_requests
  for select
  to authenticated
  using (shelter_id = auth.uid());

create policy shelter_requests_restaurant_read
  on public.shelter_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'restaurant'
    )
    and (
      -- Restaurant marketplace queue.
      status in ('open', 'responded')
      -- Lifecycle states are visible only for restaurant-linked matched donation.
      or (
        status in ('matched', 'completed', 'fulfilled', 'cancelled')
        and exists (
          select 1
          from public.donations d
          where d.id = public.shelter_requests.matched_donation_id
            and d.restaurant_id = auth.uid()
        )
      )
    )
  );

-- Rebuild request_responses SELECT policies only, to avoid cyclic evaluation.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'request_responses'
      and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.request_responses', p.policyname);
  end loop;
end $$;

create policy request_responses_select_restaurant_own
  on public.request_responses
  for select
  to authenticated
  using (restaurant_id = auth.uid());

create policy request_responses_select_shelter_own_requests
  on public.request_responses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.shelter_requests sr
      where sr.id = public.request_responses.request_id
        and sr.shelter_id = auth.uid()
    )
  );
