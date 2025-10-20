-- Supabase album system setup
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "moddatetime" with schema extensions;

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_item_id uuid references public.media_items(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.album_items (
  album_id uuid not null references public.albums(id) on delete cascade,
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  position int,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (album_id, media_item_id)
);

create index if not exists idx_album_items_album on public.album_items(album_id);
create index if not exists idx_album_items_media on public.album_items(media_item_id);
create index if not exists idx_media_items_created_at on public.media_items(created_at);

alter table if exists public.media_items
  add column if not exists is_featured boolean not null default false;

alter table if exists public.media_items
  add column if not exists size_bytes bigint;

alter table public.albums enable row level security;
alter table public.album_items enable row level security;

drop policy if exists "Public read albums" on public.albums;
create policy "Public read albums"
  on public.albums
  for select
  using (true);

drop policy if exists "Admins write albums" on public.albums;
create policy "Admins write albums"
  on public.albums
  for all to authenticated
  using (lower(auth.email()) = 'moses233@qq.com')
  with check (lower(auth.email()) = 'moses233@qq.com');

drop policy if exists "Public read album_items" on public.album_items;
create policy "Public read album_items"
  on public.album_items
  for select
  using (true);

drop policy if exists "Admins write album_items" on public.album_items;
create policy "Admins write album_items"
  on public.album_items
  for all to authenticated
  using (lower(auth.email()) = 'moses233@qq.com')
  with check (lower(auth.email()) = 'moses233@qq.com');

create or replace view public.albums_with_stats as
select
  a.id,
  a.title,
  a.description,
  a.cover_item_id,
  a.created_at,
  count(ai.media_item_id)::int as item_count,
  coalesce(sum(mi.size_bytes), 0)::bigint as total_size_bytes,
  max(mi.created_at) as last_added_at
from public.albums a
left join public.album_items ai on ai.album_id = a.id
left join public.media_items mi on mi.id = ai.media_item_id
group by a.id;
