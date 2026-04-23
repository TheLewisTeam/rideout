-- Rideout — Supabase schema
-- Paste this entire file into Supabase → SQL Editor → New query → Run.
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT where possible.

-- ============================================================
-- TABLES
-- ============================================================

-- Riders: one row per rider code. Live position is upserted here.
create table if not exists public.riders (
  code           text primary key,
  name           text,
  avatar         text,
  last_lat       double precision,
  last_lng       double precision,
  last_speed     double precision,
  last_seen_at   timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Pages: a guardian paging a rider. Rider subscribes by rider_code.
create table if not exists public.pages (
  id          uuid primary key default gen_random_uuid(),
  rider_code  text not null,
  from_name   text,
  from_phone  text,
  message     text,
  sent_at     timestamptz default now(),
  ack         boolean default false,
  acked_at    timestamptz
);
create index if not exists pages_rider_code_sent_at_idx
  on public.pages (rider_code, sent_at desc);

-- Links: guardian ↔ rider association. One guardian phone per rider_code.
create table if not exists public.links (
  id              uuid primary key default gen_random_uuid(),
  rider_code      text not null,
  guardian_name   text,
  guardian_phone  text,
  created_at      timestamptz default now()
);
create index if not exists links_rider_code_idx
  on public.links (rider_code);
create unique index if not exists links_rider_guardian_unique
  on public.links (rider_code, guardian_phone);

-- ============================================================
-- RLS — open policies (anon key can read/write).
-- This is an open social-network style app with no auth yet.
-- Tighten these once you add Supabase Auth.
-- ============================================================

alter table public.riders enable row level security;
alter table public.pages  enable row level security;
alter table public.links  enable row level security;

drop policy if exists "anon all riders" on public.riders;
create policy "anon all riders"
  on public.riders for all using (true) with check (true);

drop policy if exists "anon all pages" on public.pages;
create policy "anon all pages"
  on public.pages for all using (true) with check (true);

drop policy if exists "anon all links" on public.links;
create policy "anon all links"
  on public.links for all using (true) with check (true);

-- ============================================================
-- Realtime — stream row changes to subscribed clients.
-- ============================================================

alter publication supabase_realtime add table public.riders;
alter publication supabase_realtime add table public.pages;
alter publication supabase_realtime add table public.links;

-- ============================================================
-- updated_at trigger for riders
-- ============================================================

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists riders_touch_updated_at on public.riders;
create trigger riders_touch_updated_at
  before update on public.riders
  for each row execute function public.touch_updated_at();
