-- Chat backend for matched shelter requests and restaurants

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.shelter_requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('restaurant', 'shelter')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_request_id_created_at_idx
  on public.chat_messages (request_id, created_at);

alter table public.chat_messages enable row level security;

grant select, insert on public.chat_messages to authenticated;

-- Read chat messages only if the user is either:
-- 1) the shelter who owns the request, or
-- 2) the matched restaurant for that request.
drop policy if exists "chat_messages_select_participants" on public.chat_messages;
create policy "chat_messages_select_participants"
  on public.chat_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.shelter_requests sr
      where sr.id = chat_messages.request_id
        and (
          sr.shelter_id = auth.uid()
          or exists (
            select 1
            from public.donations d
            where d.id = sr.matched_donation_id
              and d.restaurant_id = auth.uid()
          )
        )
    )
  );

-- Insert chat messages only for participants in a matched request.
drop policy if exists "chat_messages_insert_participants" on public.chat_messages;
create policy "chat_messages_insert_participants"
  on public.chat_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.shelter_requests sr
      where sr.id = chat_messages.request_id
        and sr.status = 'matched'
        and (
          sr.shelter_id = auth.uid()
          or exists (
            select 1
            from public.donations d
            where d.id = sr.matched_donation_id
              and d.restaurant_id = auth.uid()
          )
        )
    )
  );
