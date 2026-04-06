-- Emergency repair for shelter_requests SELECT visibility.
-- Recreates both shelter and restaurant read policies to avoid lockout.

alter table if exists public.shelter_requests enable row level security;

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
      status in ('open', 'responded')
      or (
        status in ('matched', 'completed', 'fulfilled', 'cancelled')
        and (
          exists (
            select 1
            from public.request_responses rr
            where rr.request_id = public.shelter_requests.id
              and rr.restaurant_id = auth.uid()
          )
          or exists (
            select 1
            from public.donations d
            where d.id = public.shelter_requests.matched_donation_id
              and d.restaurant_id = auth.uid()
          )
        )
      )
    )
  );
