-- Fix restaurant read visibility for shelter requests lifecycle states.
--
-- Previous policy only allowed restaurants to read open/matched requests, which hid
-- fulfilled/completed/cancelled requests from the restaurant dashboard completed tab.
--
-- New behavior:
-- 1) Any restaurant can read open/responded requests (marketplace queue).
-- 2) A restaurant can read matched/completed/fulfilled/cancelled only when the request
--    is related to that restaurant via accepted/any response history OR matched donation.

drop policy if exists shelter_requests_restaurant_read on public.shelter_requests;

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
