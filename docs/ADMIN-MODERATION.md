# Perchable moderation: admin cheat sheet

You are the admin. Everything here is run in the **Supabase SQL editor**
(Dashboard, project "perchable", SQL Editor). The editor bypasses the app's
security rules, so it can see and change things the app never can.

## Read this before running anything

- **Run one block at a time.** If any text is highlighted in the editor, it
  runs *only* the highlighted text. Clear the selection (or select exactly the
  block you mean) before pressing Run.
- **Replace placeholders completely.** `<user_id>` means: delete the whole
  thing including the `<` and `>`, keep the single quotes, paste the value.
  Example: `where id = '<user_id>'` becomes
  `where id = '0b6f2f0e-3c1a-4d0e-9a55-7d1f5e6c9a11'`.
  Where each value comes from is written next to each query.
- **Check the row count.** Every change below ends by showing you the row it
  changed. **No rows shown = 0 rows changed = you pasted a wrong id.** Nothing
  was harmed; fix the id and run again.
- **A report is a lead, not proof.** The app lets the reporter say who the
  content belongs to (`reported_user_id`), so a hostile user could file a
  report naming an innocent person. Open the real content (`target_type` +
  `target_id`) and check it before acting on the person named.
- Every query here was run once against the real database structure, on
  made-up data, inside a transaction that was rolled back
  (`supabase/tests/admin_doc_queries.sql`), so the SQL is known to run.

### Glossary (5 lines)

- **RLS (row level security):** the database rules that decide which rows the app may see or change. This editor ignores them.
- **Service role:** the all-powerful database key; the SQL editor acts like it. The app never has it.
- **Access token:** the short-lived pass (about an hour) a signed-in phone sends with every request.
- **`dm_message`:** one direct message between two users (arrives in a later Build).
- **`collection_item`:** one movie in someone's collection, which is where its caption lives.

---

## (a) See the open reports, oldest first

What it does: lists every report nobody has handled yet, with who reported
whom, why, and which thing was reported.

```sql
select r.id as report_id, r.created_at, r.reason, r.details,
       r.target_type, r.target_id,
       rp.display_name as reporter_name, rp.usertag as reporter_tag,
       tp.display_name as reported_name, tp.usertag as reported_tag,
       tu.email as reported_email, r.reported_user_id
from public.reports r
left join public.profiles rp on rp.id = r.reporter_id
left join public.profiles tp on tp.id = r.reported_user_id
left join auth.users tu on tu.id = r.reported_user_id
where r.status = 'open'
order by r.created_at;
```

What you'll see: one row per open report. **An empty result means there are no
open reports.** After you close a report with (b), run this again: it should
be gone from the list.

Where the values you need later come from, in this result:
- `report_id` goes into (b).
- `reported_user_id` goes into (c) and (d).
- `reported_name`, `reported_tag` and `reported_email`: **copy these down
  before you use (c) or (d)**, so you can tell who it was afterwards.

`target_type` says where to look: `profile` (the person's profile; `target_id`
is their user id), `comment`, `dm_message`, `collection_item`. Only `profile`
exists today; the others arrive in later Builds.

## (b) Close a report

What it does: marks one report as handled and stamps the time. Pick one
status: `reviewed` (looked, nothing needed), `actioned` (you acted),
`dismissed` (not a violation / false report).

```sql
update public.reports
set status = 'actioned', reviewed_at = now()   -- or 'reviewed' / 'dismissed'
where id = '<report_id>'                        -- the report_id column from (a)
returning id, status, reviewed_at;
```

What you'll see: **one row** showing the new status. No rows = wrong id.
Re-run (a) to confirm the report has left the open list.

## (c) Remove a user's profile content

**Warning first: this permanently blanks the user's usertag, display name and
photo link, and there is no undo.** Copy the old values from (a)
(`reported_name`, `reported_tag`) into a note before you run it. The user can
set new ones later; if they keep doing it, ban them (d).

Step 1, clear the profile row:

```sql
update public.profiles
set avatar_url = null, usertag = null, display_name = null
where id = '<user_id>'                          -- reported_user_id from (a)
returning id, display_name, usertag, avatar_url;
```

What you'll see: **one row** with the three fields empty (`null`). No rows =
wrong id.

Step 2, list their stored photo files (read-only; shows what step 3 removes):

```sql
select name from storage.objects
where bucket_id = 'avatars' and name like '<user_id>/%';
```

What you'll see: one row per file, or nothing if they never uploaded a photo.

Step 3, delete those files. **Permanent, and it cannot be done in SQL**
(Supabase blocks deleting storage files from SQL). In the Dashboard go to
Storage, open the `avatars` bucket, open the folder named after the user id,
select all, Delete. Skipping this leaves the old photo reachable by its
direct link even though the profile no longer points at it. Re-run step 2
afterwards: it should return nothing.

## (d) Ban and unban

What it does: a banned user cannot sign in again. Use this rather than
deleting the account: a deleted user can just sign up again with Google, a
banned one cannot.

**Warning first: this stops the user signing in or refreshing on every device** (a pass they already hold can keep working for up to about an hour — see the honest limit below). The block below
does three things together, so run it as one block (all four lines) and
promptly. Have the person's email from (a) (`reported_email`) noted first.

Ban (one block, run it whole):

```sql
update auth.users set banned_until = now() + interval '100 years' where id = '<user_id>';  -- reported_user_id from (a)
delete from auth.sessions where user_id = '<user_id>';
delete from auth.refresh_tokens where user_id = '<user_id>';
select email, banned_until from auth.users where id = '<user_id>';
```

What you'll see: the editor shows only the last statement's result: **one row
with their email and a `banned_until` date about 100 years from now.** No rows =
wrong id (nothing was banned). Update and delete statements on their own show
"Success. No rows returned"; that is normal.

**Honest limit: this stops the user *refreshing* their sign-in, but it does not
cancel a pass they already hold.** An access token that was already issued
keeps working for direct requests for up to about an hour. In that window a
banned user could still delete their own account and sign up again with
Google. That also erases every report about them, which is exactly what a ban
is meant to avoid. So: run the ban block **as soon as you decide**, and do not
leave a decided ban waiting.

Unban:

```sql
update auth.users set banned_until = null where id = '<user_id>'
returning email, banned_until;
```

What you'll see: **one row** with `banned_until` empty. No rows = wrong id.
Unbanning does not bring back their old sign-in; they just sign in again.

**Status of this proof:** the SQL above is proven to run and to change the
right rows, at database level only. That a real Google sign-in is then refused
has **not** been checked yet: it needs a second Google account (planned check
"B3"). Until then treat the ban as unproven on a real phone.

## (e) Remove other content (added by later Builds)

- **Remove a comment**: query added by Build 25.
- **Remove a DM message**: query added by Build 27.
- **Remove a caption**: query added by Build 20.

---

## Limits you should know about

- **No rate limit on reports in v1.** One user can file many reports (one per
  target). Accepted for now.
- **No cap on how many people one user can block.**
- **`reported_user_id` comes from the reporter's phone**, so it can be wrong
  or hostile. Verify against the real content (see the top of this page).
- **A user can learn whether a given user id exists**, from the error a report
  or block against a made-up id produces. Profiles are already visible to every
  signed-in user, so this reveals nothing new.
- **A user who deletes their account also deletes the reports they filed**
  (kept on purpose so "delete my account" leaves no rows behind).
- **Deleting an account erases every report about that person too.** Another
  reason to ban with `banned_until` instead of deleting: a ban keeps the
  evidence.
- **A ban does not delete anything.** Their content stays until you remove it
  with (c) / (e).
- **A ban does not cancel a pass already issued** for up to about an hour (see
  (d)).
- The reporter never sees a report back (not even their own): the app has no
  read access to `reports`. Only you, here, can.
