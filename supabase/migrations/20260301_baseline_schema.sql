-- Baseline schema, captured from the live database on 2026-10-19.
-- The original tables were created by hand in the Supabase dashboard, so the
-- later migrations only alter them. Everything here is idempotent: on the
-- live database it is a no-op; on a fresh database it creates the tables the
-- later migrations expect. RLS policies for the core tables live in
-- 20261019_p0_write_policies_and_transitions.sql.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('restaurant', 'shelter')),
  name text,
  created_at timestamptz default now(),
  contact_name text,
  phone text,
  address text,
  city text,
  state text,
  zip_code text,
  updated_at timestamptz default now(),
  email text,
  organization_notes text
);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.profiles(id),
  food_type text,
  quantity integer,
  address text,
  pickup_window text,
  status text default 'posted' check (status in ('posted', 'matched')),
  matched_shelter_id uuid references public.profiles(id),
  created_at timestamptz default now(),
  restaurant_name text,
  city text,
  state text,
  zip_code text
);

create table if not exists public.shelter_requests (
  id uuid primary key default gen_random_uuid(),
  shelter_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  food_needed text,
  quantity integer,
  food_restrictions text,
  pickup_window text,
  address text,
  city text,
  state text,
  zip_code text,
  notes text,
  status text not null default 'open'
    check (status in ('open', 'responded', 'matched', 'fulfilled', 'cancelled')),
  matched_donation_id uuid references public.donations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  urgency text default 'medium' check (urgency in ('low', 'medium', 'high')),
  coordination_notes text,
  shelter_contact_email text,
  shelter_contact_phone text,
  request_type text
);

create table if not exists public.request_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.shelter_requests(id) on delete cascade,
  restaurant_id uuid not null references public.profiles(id) on delete cascade,
  donation_id uuid references public.donations(id) on delete set null,
  proposed_pickup_window text,
  response_note text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, restaurant_id)
);

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_donations_created_at on public.donations (created_at desc);
create index if not exists idx_donations_restaurant_id on public.donations (restaurant_id);
create index if not exists idx_donations_status on public.donations (status);
create index if not exists idx_shelter_requests_created_at on public.shelter_requests (created_at desc);
create index if not exists idx_shelter_requests_shelter_id on public.shelter_requests (shelter_id);
create index if not exists idx_shelter_requests_status on public.shelter_requests (status);
create index if not exists request_responses_request_id_idx on public.request_responses (request_id);
create index if not exists request_responses_restaurant_id_idx on public.request_responses (restaurant_id);

alter table public.profiles enable row level security;
alter table public.donations enable row level security;
alter table public.shelter_requests enable row level security;
alter table public.request_responses enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_shelter_requests_updated_at on public.shelter_requests;
create trigger trg_shelter_requests_updated_at
  before update on public.shelter_requests
  for each row execute function public.set_updated_at();

drop trigger if exists set_request_responses_updated_at on public.request_responses;
create trigger set_request_responses_updated_at
  before update on public.request_responses
  for each row execute function public.set_updated_at_timestamp();
