-- Build 7 (Module: Profile) — Supabase Storage bucket `avatars` + RLS.
-- PLAN.md Build 7 done-means: "user ... uploads a photo (Supabase Storage);
-- both persist after app restart".
--
-- NOT APPLIED BY BELLA — the Manager reviews and applies it.

-- Public read: avatars are shown on every profile a user views (Build 6's
-- profiles.select RLS already makes profile rows public within the app —
-- follow/profile-modal, comments, DMs in later modules all display other
-- users' photos), and a profile photo isn't sensitive beyond what's already
-- publicly visible in-app. A public bucket serves files via a plain public
-- URL with no signed-URL expiry/refresh logic needed anywhere the app
-- renders an Avatar — simpler than the alternative (private bucket +
-- short-lived signed URLs re-fetched per render) for content that was never
-- meant to be private. Write access is still fully locked down below.
--
-- file_size_limit is bytes (Supabase storage.buckets column, confirmed
-- against the storage service's own migrations — this is NOT kilobytes,
-- an earlier schema version used max_file_size_kb but that was renamed/
-- converted to file_size_limit in bytes). ~2MB per the Build 7 brief.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects already has RLS enabled by default on every Supabase
-- project (it's a Supabase-managed table) — no `alter table ... enable row
-- level security` needed/possible here as a non-owner role.

-- Public read for this bucket only. A `public` bucket already serves GETs
-- via the unauthenticated /object/public/ endpoint without going through
-- this policy, but authenticated reads (e.g. a signed-in client using the
-- regular object API instead of the public URL) still need it — added for
-- completeness, not just the public-URL path.
-- Manager review: no public select policy. The bucket is public, so image
-- URLs are served without one; a public select policy would also let anyone
-- LIST every user's files. Own-folder select is kept because upsert
-- (replacing your avatar) needs select + insert + update.
create policy "avatars_select_own_folder"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Path convention: <uid>/<filename> (e.g. `<uid>/avatar.jpg`) — every
-- write policy below checks the first path segment
-- (`storage.foldername(name)`, an array of the path's folder components)
-- against the caller's own auth.uid(), so a user can only ever write inside
-- their own folder, never another user's.
create policy "avatars_insert_own_folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own_folder"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own_folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
