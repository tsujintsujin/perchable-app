# Perchable moderation: admin cheat sheet

You are the admin. Everything here is run in the **Supabase SQL editor**
(Dashboard, project "perchable", SQL Editor). The editor bypasses the app's
security rules, so it can see and change things the app never can.

How to use it: copy a query, replace the `<...>` placeholder (keep the quotes),
run it. Every query below was run once against the real database schema inside
a transaction that was rolled back (`supabase/tests/admin_doc_queries.sql`), so
the SQL is known to work.

**A report is a lead, not proof.** The app lets the reporter say who the
content belongs to (`reported_user_id`), so a bad actor could file a report
naming an innocent person. Always open the real content (target type + id)
and check it before you act on the person named.

---

## (a) See the open reports, oldest first

What it does: lists every report nobody has handled yet, with who reported
whom, why, and which thing (`target_type` + `target_id`) was reported.

```sql
select r.id as report_id, r.created_at, r.reason, r.details,
       r.target_type, r.target_id,
       rp.display_name as reporter_name, rp.usertag as reporter_tag,
       tp.display_name as reported_name, tp.usertag as reported_tag,
       r.reported_user_id
from public.reports r
left join public.profiles rp on rp.id = r.reporter_id
left join public.profiles tp on tp.id = r.reported_user_id
where r.status = 'open'
order by r.created_at;
```

`target_type` tells you where to look: `profile` (the person's profile, id =
the user id), `comment`, `dm_message`, `collection_item` (a caption lives on a
collection entry). Only `profile` exists today; the others arrive in later
Builds.

## (b) Close a report

What it does: marks one report as handled and stamps the time. Pick one status:
`reviewed` (looked, nothing needed), `actioned` (you acted), `dismissed`
(not a violation / false report).

```sql
update public.reports
set status = 'actioned', reviewed_at = now()   -- or 'reviewed' / 'dismissed'
where id = '<report_id from query (a)>';
```

## (c) Remove a user's profile content

What it does: blanks the three profile fields other people can see (photo,
usertag, display name). The user can set them again later; if they keep doing
it, ban them (d).

Step 1, clear the profile row:

```sql
update public.profiles
set avatar_url = null, usertag = null, display_name = null
where id = '<user_id>';
```

Step 2, list their stored photo files (read-only; shows what to delete):

```sql
select name from storage.objects
where bucket_id = 'avatars' and name like '<user_id>/%';
```

Step 3, delete those files. **This cannot be undone and cannot be done in SQL**
(Supabase blocks deleting storage files from SQL). In the Dashboard go to
Storage, open the `avatars` bucket, open the folder named after the user id,
select all, Delete. Skipping this leaves the old photo reachable by its
direct link even though the profile no longer points at it.

## (d) Ban and unban

What it does: a banned user cannot sign in again. Use this rather than
deleting the account: a deleted user can just sign up again with Google, a
banned one cannot.

Ban:

```sql
update auth.users set banned_until = 'infinity' where id = '<user_id>';
```

Make it bite right now (otherwise a phone that is already signed in keeps
working for up to about an hour, until its access token expires):

```sql
delete from auth.sessions where user_id = '<user_id>';
delete from auth.refresh_tokens where user_id = '<user_id>';
```

Unban:

```sql
update auth.users set banned_until = null where id = '<user_id>';
```

Check the current state:

```sql
select email, banned_until from auth.users where id = '<user_id>';
```

The ban SQL is proven here at database level. That a real Google sign-in is
then refused is checked in Build 10a step B3, which needs a second Google
account (not done yet). If that check shows the ban does not stop sign-in,
use a far date instead of `'infinity'`, for example `'2999-12-31'`.

## (e) Remove other content (added by later Builds)

- **Remove a comment**: query added by Build 25.
- **Remove a DM message**: query added by Build 27.
- **Remove a caption**: query added by Build 20.

---

## Limits you should know about

- **No rate limit on reports in v1.** One user can file many reports (one per
  target). Accepted for now.
- **`reported_user_id` comes from the reporter's phone**, so it can be wrong
  or hostile. Verify against the real content (see the top of this page).
- **A user who deletes their account also deletes the reports they filed**
  (kept on purpose so "delete my account" leaves no rows behind).
- **Deleting an account erases every report about that person too.** Another
  reason to ban with `banned_until` instead of deleting: a ban keeps the
  evidence.
- **A ban does not delete anything.** Their content stays until you remove it
  with (c) / (e).
- **Tokens outlive a ban for up to about an hour** unless you also delete
  their sessions (the two `delete` lines under (d)).
- The reporter never sees a report back (not even their own): the app has no
  read access to `reports`. Only you, here, can.
