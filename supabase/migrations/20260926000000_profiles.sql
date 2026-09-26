-- Build 6 (Module: Auth/Profile) — public.profiles: the table, its RLS, and
-- the trigger that auto-creates a row on first Google sign-in.
-- PLAN.md Build 6 done-means: "first sign-in auto-creates a profiles row
-- (id, google name, default avatar, empty usertag)".
-- PLAN.md Build 9 (account deletion) needs the ON DELETE CASCADE on the
-- auth.users FK below so deleting the Auth user removes this row too.
--
-- NOT APPLIED BY BELLA — the Manager reviews and runs this.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  -- Nullable: empty at first sign-in per Build 6; set once by the user in
  -- Build 7. Stored lowercase only — the CHECK below enforces that (and
  -- with it, case-consistent uniqueness) rather than a separate
  -- lower(usertag) index.
  usertag text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_usertag_format check (
    usertag is null or usertag ~ '^[a-z][a-z0-9_]{2,19}$'
  )
);

alter table public.profiles enable row level security;

-- Profiles are public within the app — later modules (follow, profile
-- modal, comments) show one user's profile to another, so any signed-in
-- user may read any row. No policy is defined for `anon`: a signed-out app
-- never shows profile data (matches Build 8's regression requirement).
create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

-- A user may only update their own row. No insert or delete policy exists
-- for any client role — creation is exclusively the trigger below (Build 6
-- scope), and deletion is exclusively the auth.users FK's ON DELETE CASCADE
-- (Build 9 scope). With RLS enabled and no matching policy, both stay
-- denied to every client role by default.
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Client roles get exactly select + update — no insert/delete grant, so
-- there's no path to bypass the "no client insert/delete" rule even if a
-- future migration adds a permissive policy by mistake.
-- Update is column-limited (Manager review): id/created_at/updated_at are
-- never client-writable, even on the user's own row.
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, usertag) on public.profiles to authenticated;

-- Keeps updated_at current on every row update (used by Build 7's edit
-- flow and any later module that writes to this row).
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

-- Runs after every new Supabase Auth user (any provider, not just Google,
-- though v1 only ships Google sign-in). Google's raw user metadata uses
-- different keys depending on the sign-in flow, so both are checked:
-- full_name/name for the display name, avatar_url/picture for the photo.
-- usertag is left null (Build 6 done-means: "empty usertag" — Build 7 is
-- the only place it's ever set, via the update policy above, never here).
-- security definer + empty search_path so it runs with the privileges
-- needed to write public.profiles regardless of who triggers auth.users,
-- without being hijackable by a same-named function earlier in some
-- caller's search_path.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill: any auth.users row that predates this migration (Justin's own
-- account, created during Build 5 QA before public.profiles existed) gets
-- a profiles row now, via the same metadata mapping as the trigger above.
insert into public.profiles (id, display_name, avatar_url)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Trigger-only functions: not callable by API roles.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
