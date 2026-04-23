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

-- Rideouts: the shared calendar — every device sees the same events.
create table if not exists public.rideouts (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  types              text[] default '{}',
  date               date not null,
  time               text,
  location           text,
  coords_lat         double precision,
  coords_lng         double precision,
  host_name          text,
  host_code          text,
  host_avatar        text,
  level              text,
  description        text,
  beginner_friendly  boolean default false,
  created_at         timestamptz default now()
);
alter table public.rideouts add column if not exists host_avatar text;
create index if not exists rideouts_date_idx on public.rideouts (date);

-- Rideout joins: who's RSVPing to what. Unique per (rideout, rider).
create table if not exists public.rideout_joins (
  id          uuid primary key default gen_random_uuid(),
  rideout_id  uuid not null references public.rideouts(id) on delete cascade,
  rider_code  text,
  rider_name  text,
  joined_at   timestamptz default now()
);
create unique index if not exists rideout_joins_unique
  on public.rideout_joins (rideout_id, rider_code);
create index if not exists rideout_joins_rideout_idx
  on public.rideout_joins (rideout_id);

-- Chat messages. `room` is either 'global' or a rideout UUID as text.
create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  room         text not null default 'global',
  author_name  text,
  author_code  text,
  avatar       text,
  body         text not null,
  sent_at      timestamptz default now()
);
create index if not exists chat_messages_room_sent_at_idx
  on public.chat_messages (room, sent_at desc);

-- Feed posts: ride recaps shared to the global feed.
create table if not exists public.feed_posts (
  id           uuid primary key default gen_random_uuid(),
  author_name  text,
  author_code  text,
  avatar       text,
  ride_type    text,
  body         text not null,
  image_url    text,
  distance     text,
  duration     text,
  created_at   timestamptz default now()
);
create index if not exists feed_posts_created_at_idx
  on public.feed_posts (created_at desc);

-- Feed post likes: one row per (post, rider). Unique constraint = dedupe.
create table if not exists public.feed_post_likes (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.feed_posts(id) on delete cascade,
  rider_code  text not null,
  liked_at    timestamptz default now()
);
create unique index if not exists feed_post_likes_unique
  on public.feed_post_likes (post_id, rider_code);
create index if not exists feed_post_likes_post_idx
  on public.feed_post_likes (post_id);

-- ============================================================
-- RLS — open policies (anon key can read/write).
-- This is an open social-network style app with no auth yet.
-- Tighten these once you add Supabase Auth.
-- ============================================================

alter table public.riders          enable row level security;
alter table public.pages           enable row level security;
alter table public.links           enable row level security;
alter table public.rideouts        enable row level security;
alter table public.rideout_joins   enable row level security;
alter table public.chat_messages   enable row level security;
alter table public.feed_posts      enable row level security;
alter table public.feed_post_likes enable row level security;

drop policy if exists "anon all riders" on public.riders;
create policy "anon all riders"
  on public.riders for all using (true) with check (true);

drop policy if exists "anon all pages" on public.pages;
create policy "anon all pages"
  on public.pages for all using (true) with check (true);

drop policy if exists "anon all links" on public.links;
create policy "anon all links"
  on public.links for all using (true) with check (true);

drop policy if exists "anon all rideouts" on public.rideouts;
create policy "anon all rideouts"
  on public.rideouts for all using (true) with check (true);

drop policy if exists "anon all joins" on public.rideout_joins;
create policy "anon all joins"
  on public.rideout_joins for all using (true) with check (true);

drop policy if exists "anon all chat" on public.chat_messages;
create policy "anon all chat"
  on public.chat_messages for all using (true) with check (true);

drop policy if exists "anon all feed_posts" on public.feed_posts;
create policy "anon all feed_posts"
  on public.feed_posts for all using (true) with check (true);

drop policy if exists "anon all feed_post_likes" on public.feed_post_likes;
create policy "anon all feed_post_likes"
  on public.feed_post_likes for all using (true) with check (true);

-- ============================================================
-- Realtime — stream row changes to subscribed clients.
-- Safe to re-run: ignores "already member of publication" errors.
-- ============================================================

do $$
begin
  begin alter publication supabase_realtime add table public.riders;
  exception when duplicate_object then null;
  end;
  begin alter publication supabase_realtime add table public.pages;
  exception when duplicate_object then null;
  end;
  begin alter publication supabase_realtime add table public.links;
  exception when duplicate_object then null;
  end;
  begin alter publication supabase_realtime add table public.rideouts;
  exception when duplicate_object then null;
  end;
  begin alter publication supabase_realtime add table public.rideout_joins;
  exception when duplicate_object then null;
  end;
  begin alter publication supabase_realtime add table public.chat_messages;
  exception when duplicate_object then null;
  end;
  begin alter publication supabase_realtime add table public.feed_posts;
  exception when duplicate_object then null;
  end;
  begin alter publication supabase_realtime add table public.feed_post_likes;
  exception when duplicate_object then null;
  end;
end $$;

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
