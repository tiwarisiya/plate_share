-- Live updates for listings.
--
-- The listing pages and dashboards subscribe to changes on donations, but
-- the table was never added to the supabase_realtime publication, so a
-- claimed listing only showed up after a reload. Adds each app table the
-- UI subscribes to, if it isn't published yet. Skipped where the
-- publication doesn't exist (e.g. a plain Postgres test database).
-- Row-level security still applies to what each user receives.

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach t in array array['donations', 'shelter_requests', 'request_responses', 'chat_messages', 'notifications'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
