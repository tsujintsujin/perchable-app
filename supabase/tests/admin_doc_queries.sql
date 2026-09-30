-- Runs every query in docs/ADMIN-MODERATION.md (a)-(d) once, on seeded data,
-- in one rolled-back transaction (the doc's placeholder ids are replaced by
-- the seeded ids below). Run with:
--   node supabase/tests/run-sql.mjs supabase/tests/admin_doc_queries.sql --migration supabase/migrations/20260930000000_moderation.sql
-- Output: one line per step, "step | rows as JSON".
begin;
-- @@MIGRATION@@

create temp table o(seq serial, step text, result jsonb);

-- Seed: reporter X, reported user Y, one open profile report, Y has an avatar object and a session.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('11111111-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','x@example.test','{"full_name":"Reporter X"}',now(),now()),
  ('22222222-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','y@example.test','{"full_name":"Bad Actor Y","picture":"https://x/y.png"}',now(),now());
update public.profiles set usertag = 'reporterx' where id = '11111111-0000-0000-0000-000000000001';
update public.profiles set usertag = 'badactory' where id = '22222222-0000-0000-0000-000000000002';
insert into public.reports (id, reporter_id, target_type, target_id, reported_user_id, reason, details)
values ('99999999-0000-0000-0000-000000000009','11111111-0000-0000-0000-000000000001','profile','22222222-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000002','harassment','abusive name');
insert into storage.objects (bucket_id, name) values ('avatars','22222222-0000-0000-0000-000000000002/avatar.jpg');
insert into auth.sessions (id, user_id, created_at, updated_at) values ('88888888-0000-0000-0000-000000000008','22222222-0000-0000-0000-000000000002',now(),now());
insert into auth.refresh_tokens (instance_id, token, user_id, revoked, session_id) values ('00000000-0000-0000-0000-000000000000','tok-y','22222222-0000-0000-0000-000000000002',false,'88888888-0000-0000-0000-000000000008');

-- (a) open reports, oldest first
insert into o(step, result)
select 'a_open_reports', coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
  select r.id as report_id, r.created_at, r.reason, r.details, r.target_type, r.target_id,
         rp.display_name as reporter_name, rp.usertag as reporter_tag,
         tp.display_name as reported_name, tp.usertag as reported_tag, tu.email as reported_email, r.reported_user_id
  from public.reports r
  left join public.profiles rp on rp.id = r.reporter_id
  left join public.profiles tp on tp.id = r.reported_user_id
  left join auth.users tu on tu.id = r.reported_user_id
  where r.status = 'open'
  order by r.created_at
) t;

-- (b) mark a report actioned (returning shows the changed row; a wrong id returns no row)
with u as (
  update public.reports set status = 'actioned', reviewed_at = now()
  where id = '99999999-0000-0000-0000-000000000009'
  returning id, status, reviewed_at
)
insert into o(step, result) select 'b_update_returning', to_jsonb(u) from u;
with u as (
  update public.reports set status = 'actioned', reviewed_at = now()
  where id = '00000000-0000-0000-0000-000000000000'
  returning id
)
insert into o(step, result) select 'b_wrong_id_rows_returned', to_jsonb(count(*)) from u;
insert into o(step, result)
select 'b_open_reports_left', to_jsonb(count(*)) from public.reports where status = 'open';

-- (c) list the avatar files, then clear the profile
insert into o(step, result)
select 'c_avatar_files', coalesce(jsonb_agg(name), '[]') from storage.objects where bucket_id = 'avatars' and name like '22222222-0000-0000-0000-000000000002/%';
with u as (
  update public.profiles set avatar_url = null, usertag = null, display_name = null
  where id = '22222222-0000-0000-0000-000000000002'
  returning id, display_name, usertag, avatar_url
)
insert into o(step, result) select 'c_update_returning', to_jsonb(u) from u;

-- (d) the ban block exactly as in the doc: update, two deletes, then a final select
update auth.users set banned_until = now() + interval '100 years' where id = '22222222-0000-0000-0000-000000000002';
delete from auth.sessions where user_id = '22222222-0000-0000-0000-000000000002';
delete from auth.refresh_tokens where user_id = '22222222-0000-0000-0000-000000000002';
insert into o(step, result)
select 'd_ban_block_final_select', to_jsonb(t) from (select email, banned_until from auth.users where id = '22222222-0000-0000-0000-000000000002') t;
insert into o(step, result)
select 'd_wrong_id_final_select_rows', to_jsonb(count(*)) from auth.users where id = '00000000-0000-0000-0000-000000000000';
insert into o(step, result)
select 'd_sessions_and_tokens_left', to_jsonb(t) from (select
  (select count(*) from auth.sessions where user_id = '22222222-0000-0000-0000-000000000002') as sessions,
  (select count(*) from auth.refresh_tokens where user_id = '22222222-0000-0000-0000-000000000002') as refresh_tokens) t;
with u as (
  update auth.users set banned_until = null where id = '22222222-0000-0000-0000-000000000002'
  returning email, banned_until
)
insert into o(step, result) select 'd_unban_returning', to_jsonb(u) from u;

select json_agg(json_build_object('step', step, 'result', result) order by seq) from o;
rollback;
