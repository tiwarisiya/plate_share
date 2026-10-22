-- C3: photo scan pre-fill.
--
-- When a restaurant scans a food photo, /api/scan-food stores what the
-- model suggested here. Once the restaurant submits the offer or listing,
-- the app links the scan to that donation, so suggested values can be
-- compared with what was actually submitted (the donation row). Photos
-- themselves aren't stored by the scan.

begin;

create table if not exists public.food_scans (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.profiles(id) on delete cascade,
  donation_id uuid references public.donations(id) on delete set null,
  provider text not null,
  model text not null,
  suggestions jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists food_scans_restaurant_idx on public.food_scans (restaurant_id, created_at desc);
create index if not exists food_scans_donation_idx on public.food_scans (donation_id);

alter table public.food_scans enable row level security;

grant select, insert, update on public.food_scans to authenticated;

drop policy if exists food_scans_select_own on public.food_scans;
create policy food_scans_select_own
  on public.food_scans for select to authenticated
  using (restaurant_id = auth.uid());

drop policy if exists food_scans_insert_own on public.food_scans;
create policy food_scans_insert_own
  on public.food_scans for insert to authenticated
  with check (
    restaurant_id = auth.uid()
    and donation_id is null
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'restaurant')
  );

-- Linking only: the scan's suggestions can't be edited afterwards.
create or replace function public.guard_food_scan_update()
returns trigger
language plpgsql
as $$
begin
  if new.restaurant_id is distinct from old.restaurant_id
    or new.provider is distinct from old.provider
    or new.model is distinct from old.model
    or new.suggestions is distinct from old.suggestions
    or new.created_at is distinct from old.created_at then
    raise exception 'Only the donation link of a food scan can change';
  end if;

  if old.donation_id is not null then
    raise exception 'Food scan is already linked';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_food_scans_guard on public.food_scans;
create trigger trg_food_scans_guard
  before update on public.food_scans
  for each row execute function public.guard_food_scan_update();

drop policy if exists food_scans_link_own on public.food_scans;
create policy food_scans_link_own
  on public.food_scans for update to authenticated
  using (restaurant_id = auth.uid())
  with check (
    restaurant_id = auth.uid()
    and donation_id is not null
    and exists (select 1 from public.donations d where d.id = food_scans.donation_id and d.restaurant_id = auth.uid())
  );

commit;
