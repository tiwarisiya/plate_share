-- P1 item 9: profiles.email always mirrors the login email.
--
-- Settings used to write profiles.email directly, so a user could "change"
-- their email there while still signing in with the old address, and
-- shelters/restaurants would contact an address nobody verified. Now:
-- 1) Any insert/update of profiles takes email from auth.users, whatever
--    the client sent.
-- 2) When the login email changes (after the user confirms the change link
--    sent by supabase.auth.updateUser), the profile follows.
-- 3) Existing mismatches are corrected.

begin;

create or replace function public.profiles_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select u.email into v_email from auth.users u where u.id = new.id;
  if v_email is not null then
    new.email := v_email;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_email_from_auth on public.profiles;
create trigger trg_profiles_email_from_auth
  before insert or update on public.profiles
  for each row execute function public.profiles_email_from_auth();

create or replace function public.sync_profile_email_on_auth_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id
    and email is distinct from new.email;
  return new;
end;
$$;

drop trigger if exists trg_auth_users_sync_profile_email on auth.users;
create trigger trg_auth_users_sync_profile_email
  after update of email on auth.users
  for each row execute function public.sync_profile_email_on_auth_change();

revoke all on function public.profiles_email_from_auth() from public;
revoke all on function public.sync_profile_email_on_auth_change() from public;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and u.email is not null
  and p.email is distinct from u.email;

commit;
