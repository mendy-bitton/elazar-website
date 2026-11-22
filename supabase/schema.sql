-- =========================================================
-- Elazar Bitton site: database setup (phase 1)
-- Paste into Supabase → SQL Editor → Run. Safe to run again.
-- Anyone can read the site's content; only admins can change it.
-- =========================================================

-- 1. Who may manage the site: only users listed here can change anything
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
grant select on public.admins to authenticated;
drop policy if exists "admins see themselves" on public.admins;
create policy "admins see themselves" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- true when the signed-in user is an admin AND passed the second step (the authenticator app code).
-- "aal2" in the login token means the code was entered; a password alone is never enough to change anything.
-- (runs with the owner's rights, so it can read admins)
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
     and exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- keeps updated_at current on every change
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Site settings: one row per area (contact, texts, popup), the value is JSON
create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
grant select on public.settings to anon, authenticated;
grant insert, update, delete on public.settings to authenticated;
drop policy if exists "anyone reads settings" on public.settings;
create policy "anyone reads settings" on public.settings
  for select to anon, authenticated using (true);
drop policy if exists "admins write settings" on public.settings;
create policy "admins write settings" on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- 3. Images (the popup now, posts later): a public bucket; only admins upload or delete
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins upload media" on storage.objects;
create policy "admins upload media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
drop policy if exists "admins update media" on storage.objects;
create policy "admins update media" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin());
drop policy if exists "admins delete media" on storage.objects;
create policy "admins delete media" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- =========================================================
-- 4. After creating Elazar's user (Authentication → Users → Add user),
--    run this line on its own, with his email instead of the example:
--
--    insert into public.admins (user_id) select id from auth.users where email = 'his-email@example.com';
--
-- 5. If he ever loses his phone (the authenticator app), remove his old code so the next
--    login asks him to scan a new QR. Run on its own, with his email:
--
--    delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'his-email@example.com');
-- =========================================================
