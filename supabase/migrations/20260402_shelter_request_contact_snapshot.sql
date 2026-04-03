-- Snapshot shelter contact details on requests for reliable restaurant-side visibility.

alter table if exists public.shelter_requests
  add column if not exists shelter_contact_email text,
  add column if not exists shelter_contact_phone text;

update public.shelter_requests sr
set
  shelter_contact_email = coalesce(sr.shelter_contact_email, p.email),
  shelter_contact_phone = coalesce(sr.shelter_contact_phone, p.phone)
from public.profiles p
where p.id = sr.shelter_id
  and (
    sr.shelter_contact_email is null
    or sr.shelter_contact_phone is null
  );
