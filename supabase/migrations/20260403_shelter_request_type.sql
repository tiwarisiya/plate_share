-- Add explicit request type for shelter requests.
-- Keeps compatibility with existing rows by backfilling from food_needed/title.

alter table if exists public.shelter_requests
  add column if not exists request_type text;

update public.shelter_requests
set request_type = coalesce(nullif(food_needed, ''), nullif(title, ''))
where request_type is null;
