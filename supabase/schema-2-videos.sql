-- =========================================================
-- Elazar Bitton site: database setup, phase 2 (videos)
-- Run after schema.sql. Paste into Supabase → SQL Editor → Run. Safe to run again.
--
-- videos      every video the scan finds on YouTube and Cloudinary (or added by link)
-- placements  which videos are shown in which area of the site, and in what order.
--             A video that isn't placed anywhere is not shown: that's the approval.
-- =========================================================

create table if not exists public.videos (
  id text primary key,                          -- 'yt:<video id>' or 'cld:<public id>'
  source text not null check (source in ('youtube', 'cloudinary')),
  kind text not null check (kind in ('song', 'short', 'wedding', 'event')),
  title text not null default '',               -- the name as it is on YouTube / Cloudinary
  data jsonb not null default '{}'::jsonb,      -- source details (YouTube id and date, Cloudinary version and format...)
  is_new boolean not null default true,         -- found by the scan and not looked at yet
  gone boolean not null default false,          -- no longer found at the source (removed from Cloudinary)
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table if not exists public.placements (
  area text not null check (area in ('music', 'moments', 'weddings', 'events')),
  video_id text not null references public.videos (id) on delete cascade,
  position int not null,
  primary key (area, video_id)
);
create index if not exists placements_area_position on public.placements (area, position);

alter table public.videos enable row level security;
alter table public.placements enable row level security;
grant select on public.videos, public.placements to anon, authenticated;
grant insert, update, delete on public.videos, public.placements to authenticated;

drop policy if exists "anyone reads videos" on public.videos;
create policy "anyone reads videos" on public.videos for select to anon, authenticated using (true);
drop policy if exists "admins write videos" on public.videos;
create policy "admins write videos" on public.videos for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "anyone reads placements" on public.placements;
create policy "anyone reads placements" on public.placements for select to anon, authenticated using (true);
drop policy if exists "admins write placements" on public.placements;
create policy "admins write placements" on public.placements for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- save one area's list in a single step: exactly these videos, in this order.
-- "seen" clears the "new" mark from videos that were on screen when he saved.
create or replace function public.save_placements(p_area text, p_ids text[], p_seen text[] default '{}')
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  delete from public.placements where area = p_area;
  insert into public.placements (area, video_id, position)
    select p_area, t.id, t.ord::int from unnest(p_ids) with ordinality as t(id, ord);
  update public.videos set is_new = false where id = any(p_ids) or id = any(p_seen);
end;
$$;
grant execute on function public.save_placements(text, text[], text[]) to authenticated;

-- after a scan: videos of a source that weren't found are marked gone (and the site stops showing them);
-- ones that are back are un-marked
create or replace function public.mark_gone(p_source text, p_present text[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  update public.videos set gone = not (id = any(p_present)) where source = p_source;
end;
$$;
grant execute on function public.mark_gone(text, text[]) to authenticated;
