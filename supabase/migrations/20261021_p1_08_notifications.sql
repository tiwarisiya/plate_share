-- P1 item 8: notifications.
--
-- Triggers write a row to public.notifications for the other party when:
--   new_response       a restaurant responds (or re-responds) to a request
--   response_accepted  a shelter accepts a restaurant's response
--   listing_claimed    a shelter claims a restaurant's listing
--   new_message        a chat message arrives
--   pickup_confirmed   the other side confirms the pickup hand-off
-- The app shows unread counts from this table. The send-notification-email
-- Edge Function (supabase/functions) emails each new row once a database
-- webhook is pointed at it; emailed_at records that. Users can turn email
-- off with profiles.email_notifications.

begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  request_id uuid references public.shelter_requests(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  emailed_at timestamptz
);

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('new_response', 'response_accepted', 'listing_claimed', 'new_message', 'pickup_confirmed'));

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

grant select on public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

-- No insert/update/delete policies: rows come from the triggers below and
-- are marked read through mark_notifications_read.

alter table public.profiles
  add column if not exists email_notifications boolean not null default true;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.notify(
  p_user_id uuid,
  p_kind text,
  p_request_id uuid,
  p_actor_id uuid,
  p_body text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, kind, request_id, actor_id, body)
  select p_user_id, p_kind, p_request_id, p_actor_id, p_body
  where p_user_id is not null and p_user_id is distinct from p_actor_id;
$$;

revoke all on function public.notify(uuid, text, uuid, uuid, text) from public;

-- The restaurant matched to a request (via its accepted response).
create or replace function public.matched_restaurant_id(p_request_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select rr.restaurant_id
  from public.request_responses rr
  where rr.request_id = p_request_id
    and rr.status = 'accepted'
  limit 1;
$$;

revoke all on function public.matched_restaurant_id(uuid) from public;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.notify_on_response_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.shelter_requests%rowtype;
  v_restaurant_name text;
  v_shelter_name text;
begin
  select * into v_request from public.shelter_requests where id = new.request_id;
  select name into v_restaurant_name from public.profiles where id = new.restaurant_id;
  select name into v_shelter_name from public.profiles where id = v_request.shelter_id;

  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    perform public.notify(
      v_request.shelter_id, 'new_response', new.request_id, new.restaurant_id,
      format('%s responded to "%s".', coalesce(v_restaurant_name, 'A restaurant'), v_request.title)
    );
  elsif new.status = 'accepted' and (tg_op = 'INSERT' or old.status is distinct from 'accepted') then
    if v_request.origin = 'listing' then
      perform public.notify(
        new.restaurant_id, 'listing_claimed', new.request_id, v_request.shelter_id,
        format('%s claimed your listing "%s".', coalesce(v_shelter_name, 'A shelter'), v_request.title)
      );
    else
      perform public.notify(
        new.restaurant_id, 'response_accepted', new.request_id, v_request.shelter_id,
        format('%s accepted your response to "%s".', coalesce(v_shelter_name, 'A shelter'), v_request.title)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_request_responses_notify on public.request_responses;
create trigger trg_request_responses_notify
  after insert or update of status on public.request_responses
  for each row execute function public.notify_on_response_change();

create or replace function public.notify_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.shelter_requests%rowtype;
  v_sender_name text;
  v_recipient uuid;
begin
  select * into v_request from public.shelter_requests where id = new.request_id;
  select name into v_sender_name from public.profiles where id = new.sender_id;

  v_recipient := case
    when new.sender_role = 'shelter' then public.matched_restaurant_id(new.request_id)
    else v_request.shelter_id
  end;

  perform public.notify(
    v_recipient, 'new_message', new.request_id, new.sender_id,
    format('%s: %s', coalesce(v_sender_name, 'New message'), left(new.message, 140))
  );

  return new;
end;
$$;

drop trigger if exists trg_chat_messages_notify on public.chat_messages;
create trigger trg_chat_messages_notify
  after insert on public.chat_messages
  for each row execute function public.notify_on_chat_message();

create or replace function public.notify_on_pickup_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid := public.matched_restaurant_id(new.id);
begin
  if new.restaurant_pickup_confirmed_at is not null and old.restaurant_pickup_confirmed_at is null then
    perform public.notify(
      new.shelter_id, 'pickup_confirmed', new.id, v_restaurant,
      format('The restaurant confirmed handing off "%s".%s', new.title,
        case when new.shelter_pickup_confirmed_at is null then ' Confirm when you receive it.' else '' end)
    );
  end if;

  if new.shelter_pickup_confirmed_at is not null and old.shelter_pickup_confirmed_at is null then
    perform public.notify(
      v_restaurant, 'pickup_confirmed', new.id, new.shelter_id,
      format('The shelter confirmed receiving "%s".%s', new.title,
        case when new.restaurant_pickup_confirmed_at is null then ' Confirm the hand-off to complete it.' else '' end)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_shelter_requests_notify_pickup on public.shelter_requests;
create trigger trg_shelter_requests_notify_pickup
  after update of restaurant_pickup_confirmed_at, shelter_pickup_confirmed_at on public.shelter_requests
  for each row execute function public.notify_on_pickup_confirmation();

revoke all on function public.notify_on_response_change() from public;
revoke all on function public.notify_on_chat_message() from public;
revoke all on function public.notify_on_pickup_confirmation() from public;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------

-- Marks the caller's unread notifications read, optionally only those for
-- one request and/or of the given kinds.
create or replace function public.mark_notifications_read(
  p_request_id uuid default null,
  p_kinds text[] default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (p_request_id is null or request_id = p_request_id)
    and (p_kinds is null or kind = any (p_kinds));
$$;

revoke all on function public.mark_notifications_read(uuid, text[]) from public;
grant execute on function public.mark_notifications_read(uuid, text[]) to authenticated;

-- Realtime, so badges update without a reload (skipped where the
-- publication doesn't exist).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$$;

commit;
