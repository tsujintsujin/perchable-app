-- Build 10a moderation check. ONE transaction: applies the migration, runs
-- every assertion, rolls back. Nothing persists. Run with:
--   node supabase/tests/run-sql.mjs supabase/tests/moderation_rls.sql --migration supabase/migrations/20260930000000_moderation.sql
-- (the runner pastes the migration at the marker below). Output rows are
-- item | check | expected | actual | PASS/FAIL. Item = failure-mode list number.
begin;
-- @@MIGRATION@@

create temp table r(seq serial, item text, k text, expected text, actual text, ok boolean);
grant all on r to authenticated, anon;
grant usage, select on sequence r_seq_seq to authenticated, anon;

-- Runs q, expects it to fail with the given SQLSTATE; records the outcome.
create function pg_temp.fails(item text, k text, code text, q text) returns void language plpgsql as $$
begin
  begin
    execute q;
    insert into r(item, k, expected, actual, ok) values (item, k, code, 'ALLOWED', false);
  exception when others then
    insert into r(item, k, expected, actual, ok) values (item, k, code, sqlstate, sqlstate = code);
  end;
end $$;

-- Runs q, expects it to succeed; records the outcome.
create function pg_temp.works(item text, k text, q text) returns void language plpgsql as $$
begin
  begin
    execute q;
    insert into r(item, k, expected, actual, ok) values (item, k, 'ok', 'ok', true);
  exception when others then
    insert into r(item, k, expected, actual, ok) values (item, k, 'ok', sqlstate, false);
  end;
end $$;

-- Runs a scalar query and compares its text result to the expected value.
create function pg_temp.eq(item text, k text, want text, q text) returns void language plpgsql as $$
declare got text;
begin
  begin
    execute q into got;
  exception when others then
    got := 'error ' || sqlstate;
  end;
  insert into r(item, k, expected, actual, ok) values (item, k, want, got, got is not distinct from want);
end $$;

-- Users A, B, C (profiles are created by the existing trigger).
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v.email, now(), now()
from (values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.test'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c@example.test')) v(id, email);

-- ===== Item 2: spoofing, as A =====
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',true);
select pg_temp.works('2','report_as_self_ok',
  $q$insert into public.reports(target_type,target_id,reported_user_id,reason) values ('profile','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','spam')$q$);
select pg_temp.fails('2','report_spoofed_reporter_id','42501',
  $q$insert into public.reports(reporter_id,target_type,target_id,reported_user_id,reason) values ('cccccccc-cccc-cccc-cccc-cccccccccccc','profile','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','spam')$q$);
select pg_temp.works('2','block_as_self_ok',
  $q$insert into public.blocked_users(blocker_id,blocked_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$q$);
select pg_temp.fails('2','block_spoofed_blocker_id','42501',
  $q$insert into public.blocked_users(blocker_id,blocked_id) values ('cccccccc-cccc-cccc-cccc-cccccccccccc','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$q$);

-- Proves the RLS policy alone pins reporter_id, by temporarily granting the column.
reset role;
grant insert (reporter_id) on public.reports to authenticated;
set local role authenticated;
select pg_temp.fails('2','report_spoofed_reporter_id_rls_policy_alone','42501',
  $q$insert into public.reports(reporter_id,target_type,target_id,reported_user_id,reason) values ('cccccccc-cccc-cccc-cccc-cccccccccccc','comment',gen_random_uuid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','spam')$q$);
select pg_temp.works('2','report_own_reporter_id_rls_passes',
  $q$insert into public.reports(reporter_id,target_type,target_id,reported_user_id,reason) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','comment',gen_random_uuid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','spam')$q$);
reset role;
revoke insert (reporter_id) on public.reports from authenticated;
set local role authenticated;

-- ===== Item 3: column limits, as A =====
select pg_temp.fails('3','insert_status','42501',
  $q$insert into public.reports(target_type,target_id,reported_user_id,reason,status) values ('comment',gen_random_uuid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','spam','actioned')$q$);
select pg_temp.fails('3','insert_reviewed_at','42501',
  $q$insert into public.reports(target_type,target_id,reported_user_id,reason,reviewed_at) values ('comment',gen_random_uuid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','spam',now())$q$);
select pg_temp.fails('3','insert_id','42501',
  $q$insert into public.reports(id,target_type,target_id,reported_user_id,reason) values (gen_random_uuid(),'comment',gen_random_uuid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','spam')$q$);
select pg_temp.fails('3','insert_created_at','42501',
  $q$insert into public.reports(target_type,target_id,reported_user_id,reason,created_at) values ('comment',gen_random_uuid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','spam',now())$q$);
select pg_temp.fails('3','select_reports_denied','42501', $q$select count(*) from public.reports$q$);
select pg_temp.fails('3','select_own_report_denied','42501', $q$select id from public.reports where reporter_id = auth.uid()$q$);
select pg_temp.fails('3','update_status_denied','42501', $q$update public.reports set status='dismissed'$q$);
select pg_temp.fails('3','update_details_denied','42501', $q$update public.reports set details='x'$q$);
select pg_temp.fails('3','delete_report_denied','42501', $q$delete from public.reports$q$);
select pg_temp.fails('3','update_block_denied','42501', $q$update public.blocked_users set created_at=now()$q$);

-- ===== Item 5: data rules, as A =====
select pg_temp.fails('5','other_without_details','23514',
  $q$insert into public.reports(target_type,target_id,reported_user_id,reason) values ('comment',gen_random_uuid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','other')$q$);
select pg_temp.fails('5','other_blank_details','23514',
  $q$insert into public.reports(target_type,target_id,reported_user_id,reason,details) values ('comment',gen_random_uuid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','other','   ')$q$);
select pg_temp.works('5','other_with_details_ok',
  $q$insert into public.reports(target_type,target_id,reported_user_id,reason,details) values ('comment',gen_random_uuid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','other','because')$q$);
select pg_temp.works('5','details_500_chars_ok',
  $q$insert into public.reports(target_type,target_id,reported_user_id,reason,details) values ('comment',gen_random_uuid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','spam',repeat('x',500))$q$);
select pg_temp.fails('5','details_501_chars','23514',
  $q$insert into public.reports(target_type,target_id,reported_user_id,reason,details) values ('comment',gen_random_uuid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','spam',repeat('x',501))$q$);
select pg_temp.fails('5','self_report','23514',
  $q$insert into public.reports(target_type,target_id,reported_user_id,reason) values ('comment',gen_random_uuid(),'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','spam')$q$);
select pg_temp.fails('5','duplicate_report','23505',
  $q$insert into public.reports(target_type,target_id,reported_user_id,reason) values ('profile','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','hate')$q$);
select pg_temp.fails('5','profile_target_id_mismatch','23514',
  $q$insert into public.reports(target_type,target_id,reported_user_id,reason) values ('profile','cccccccc-cccc-cccc-cccc-cccccccccccc','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','spam')$q$);
select pg_temp.fails('5','unknown_target_type','23514',
  $q$insert into public.reports(target_type,target_id,reported_user_id,reason) values ('post',gen_random_uuid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','spam')$q$);
select pg_temp.fails('5','unknown_reason','23514',
  $q$insert into public.reports(target_type,target_id,reported_user_id,reason) values ('comment',gen_random_uuid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','rude')$q$);
select pg_temp.works('5','other_target_types_ok',
  $q$insert into public.reports(target_type,target_id,reported_user_id,reason) values ('dm_message',gen_random_uuid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','spam'),('collection_item',gen_random_uuid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','spam')$q$);
select pg_temp.fails('5','self_block','23514',
  $q$insert into public.blocked_users(blocker_id,blocked_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$q$);
select pg_temp.fails('5','duplicate_block','23505',
  $q$insert into public.blocked_users(blocker_id,blocked_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$q$);

-- ===== Item 3 (defaults): a fresh client report is open and unreviewed =====
reset role;
select pg_temp.eq('3','fresh_report_status_is_open','open', $q$select status from public.reports where reporter_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and target_type='profile'$q$);
select pg_temp.eq('3','fresh_report_reviewed_at_is_null','true', $q$select (reviewed_at is null)::text from public.reports where reporter_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and target_type='profile'$q$);

-- ===== Item 6: block privacy and helper answers =====
-- B blocks C (admin-side seed), so the caller-in-pair check has a real block to hide from A.
insert into public.blocked_users(blocker_id,blocked_id) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','cccccccc-cccc-cccc-cccc-cccccccccccc');
set local role authenticated;
select pg_temp.eq('6','A_sees_own_block','1', $q$select count(*)::text from public.blocked_users$q$);
select pg_temp.eq('6','helper_A_in_pair_AB','true', $q$select public.is_blocked_between('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::text$q$);
select pg_temp.eq('6','helper_A_in_pair_BA_symmetric','true', $q$select public.is_blocked_between('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::text$q$);
select pg_temp.eq('6','helper_A_pair_AC_no_block','false', $q$select public.is_blocked_between('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','cccccccc-cccc-cccc-cccc-cccccccccccc')::text$q$);
select pg_temp.eq('6','helper_A_not_in_pair_BC','false', $q$select public.is_blocked_between('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','cccccccc-cccc-cccc-cccc-cccccccccccc')::text$q$);

-- B (the blocked user) sees nothing and cannot remove the block.
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}',true);
select pg_temp.eq('6','B_sees_only_own_block_row','1', $q$select count(*)::text from public.blocked_users$q$);
select pg_temp.eq('6','B_cannot_see_blocker_via_filter','0', $q$select count(*)::text from public.blocked_users where blocked_id = auth.uid()$q$);
select pg_temp.eq('6','helper_B_in_pair_true','true', $q$select public.is_blocked_between('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::text$q$);
select pg_temp.eq('6','helper_B_in_pair_BC_true','true', $q$select public.is_blocked_between('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','cccccccc-cccc-cccc-cccc-cccccccccccc')::text$q$);
delete from public.blocked_users where blocker_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- C (uninvolved) sees no blocks and cannot remove A's.
select set_config('request.jwt.claims','{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}',true);
select pg_temp.eq('6','C_reads_others_blocks','0', $q$select count(*)::text from public.blocked_users$q$);
select pg_temp.eq('6','helper_C_not_in_pair_AB','false', $q$select public.is_blocked_between('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::text$q$);
delete from public.blocked_users where blocker_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
reset role;
select pg_temp.eq('6','B_block_survived_C_delete','1', $q$select count(*)::text from public.blocked_users where blocker_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$q$);
select pg_temp.eq('6','A_block_survived_B_and_C_deletes','1', $q$select count(*)::text from public.blocked_users where blocker_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$);

-- A can remove their own block.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',true);
delete from public.blocked_users where blocked_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
reset role;
select pg_temp.eq('6','A_can_unblock','0', $q$select count(*)::text from public.blocked_users where blocker_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$);

-- ===== Item 4: anon =====
set local role anon;
select pg_temp.fails('4','anon_select_reports','42501', $q$select count(*) from public.reports$q$);
select pg_temp.fails('4','anon_insert_reports','42501',
  $q$insert into public.reports(target_type,target_id,reported_user_id,reason) values ('comment',gen_random_uuid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','spam')$q$);
select pg_temp.fails('4','anon_select_blocked_users','42501', $q$select count(*) from public.blocked_users$q$);
select pg_temp.fails('4','anon_insert_blocked_users','42501',
  $q$insert into public.blocked_users(blocker_id,blocked_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$q$);
select pg_temp.fails('4','anon_execute_is_blocked_between','42501',
  $q$select public.is_blocked_between('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$q$);
reset role;

-- ===== Item 5 (status CHECK): admin-side insert, since clients cannot set status =====
select pg_temp.fails('5','unknown_status','23514',
  $q$insert into public.reports(reporter_id,target_type,target_id,reported_user_id,reason,status) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','comment',gen_random_uuid(),'cccccccc-cccc-cccc-cccc-cccccccccccc','spam','bogus')$q$);
select pg_temp.works('5','status_reviewed_ok_via_admin',
  $q$update public.reports set status='reviewed', reviewed_at=now() where reporter_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and target_type='dm_message'$q$);

-- ===== Item 6: helper with no signed-in caller =====
select set_config('request.jwt.claims','',true);
select pg_temp.eq('6','helper_no_caller_false','false', $q$select public.is_blocked_between('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::text$q$);

-- ===== Item 7: cascade (users D, E, F) =====
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v.email, now(), now()
from (values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'd@example.test'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'e@example.test'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'f@example.test')) v(id, email);
insert into public.reports(reporter_id,target_type,target_id,reported_user_id,reason) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd','comment',gen_random_uuid(),'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','spam'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','comment',gen_random_uuid(),'dddddddd-dddd-dddd-dddd-dddddddddddd','spam'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff','comment',gen_random_uuid(),'dddddddd-dddd-dddd-dddd-dddddddddddd','spam'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','comment',gen_random_uuid(),'ffffffff-ffff-ffff-ffff-ffffffffffff','spam');
insert into public.blocked_users(blocker_id,blocked_id) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff','dddddddd-dddd-dddd-dddd-dddddddddddd'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','ffffffff-ffff-ffff-ffff-ffffffffffff');
delete from auth.users where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select pg_temp.eq('7','delete_D_reports_left_involving_D','0',
  $q$select count(*)::text from public.reports where reporter_id='dddddddd-dddd-dddd-dddd-dddddddddddd' or reported_user_id='dddddddd-dddd-dddd-dddd-dddddddddddd'$q$);
select pg_temp.eq('7','delete_D_blocks_left_involving_D','0',
  $q$select count(*)::text from public.blocked_users where blocker_id='dddddddd-dddd-dddd-dddd-dddddddddddd' or blocked_id='dddddddd-dddd-dddd-dddd-dddddddddddd'$q$);
select pg_temp.eq('7','delete_D_unrelated_report_kept','1',
  $q$select count(*)::text from public.reports where reporter_id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' and reported_user_id='ffffffff-ffff-ffff-ffff-ffffffffffff'$q$);
select pg_temp.eq('7','delete_D_unrelated_block_kept','1',
  $q$select count(*)::text from public.blocked_users where blocker_id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' and blocked_id='ffffffff-ffff-ffff-ffff-ffffffffffff'$q$);
delete from auth.users where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
select pg_temp.eq('7','delete_F_rows_left_involving_F','0',
  $q$select ((select count(*) from public.reports where 'ffffffff-ffff-ffff-ffff-ffffffffffff' in (reporter_id, reported_user_id)) + (select count(*) from public.blocked_users where 'ffffffff-ffff-ffff-ffff-ffffffffffff' in (blocker_id, blocked_id)))::text$q$);

-- ===== Item 8: function hardening =====
select pg_temp.eq('8','security_definer','true', $q$select prosecdef::text from pg_proc where oid='public.is_blocked_between(uuid,uuid)'::regprocedure$q$);
select pg_temp.eq('8','search_path_empty','true', $q$select (proconfig = array['search_path=""'])::text from pg_proc where oid='public.is_blocked_between(uuid,uuid)'::regprocedure$q$);
select pg_temp.eq('8','anon_has_no_execute','false', $q$select has_function_privilege('anon','public.is_blocked_between(uuid,uuid)','execute')::text$q$);
select pg_temp.eq('8','authenticated_has_execute','true', $q$select has_function_privilege('authenticated','public.is_blocked_between(uuid,uuid)','execute')::text$q$);
select pg_temp.eq('8','public_pseudo_role_has_no_execute','0', $q$select count(*)::text from pg_proc p, aclexplode(p.proacl) a where p.oid='public.is_blocked_between(uuid,uuid)'::regprocedure and a.grantee=0$q$);
select pg_temp.eq('8','body_names_are_schema_qualified','true', $q$select (prosrc !~ '(from|join)\s+(blocked_users|reports)\b')::text from pg_proc where oid='public.is_blocked_between(uuid,uuid)'::regprocedure$q$);

-- ===== A7 and RLS flags: indexes and row level security =====
select pg_temp.eq('A7','rls_enabled_on_both_tables','2', $q$select count(*)::text from pg_class where oid in ('public.reports'::regclass,'public.blocked_users'::regclass) and relrowsecurity$q$);
select pg_temp.eq('A7','partial_open_index','true', $q$select (indexdef like '%(created_at)%' and indexdef like '%status = ''open''%')::text from pg_indexes where indexname='reports_open_created_at_idx'$q$);
select pg_temp.eq('A7','reported_user_index','1', $q$select count(*)::text from pg_indexes where indexname='reports_reported_user_id_idx'$q$);
select pg_temp.eq('A7','blocked_id_index','1', $q$select count(*)::text from pg_indexes where indexname='blocked_users_blocked_id_idx'$q$);

-- ===== Item 9: existing behaviour untouched =====
select pg_temp.eq('9','profiles_policies_unchanged','profiles_select_authenticated,profiles_update_own',
  $q$select string_agg(policyname, ',' order by policyname) from pg_policies where schemaname='public' and tablename='profiles'$q$);
select pg_temp.eq('9','avatars_policies_unchanged','4',
  $q$select count(*)::text from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'avatars%'$q$);

-- ===== Item 4/3 (privileges): nothing beyond the grants, for anon and authenticated =====
do $$
declare who text; priv text;
begin
  foreach who in array array['anon','authenticated'] loop
    foreach priv in array array['SELECT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      perform pg_temp.eq('4', 'priv_reports_' || who || '_no_table_' || priv, 'false',
        format('select has_table_privilege(%L, ''public.reports'', %L)::text', who, priv));
    end loop;
    perform pg_temp.eq('4', 'priv_reports_' || who || '_no_column_select_update_references', 'false',
      format('select (has_any_column_privilege(%L, ''public.reports'', ''SELECT'') or has_any_column_privilege(%L, ''public.reports'', ''UPDATE'') or has_any_column_privilege(%L, ''public.reports'', ''REFERENCES''))::text', who, who, who) );
    foreach priv in array array['UPDATE','TRUNCATE','REFERENCES','TRIGGER'] loop
      perform pg_temp.eq('4', 'priv_blocked_users_' || who || '_no_table_' || priv, 'false',
        format('select has_table_privilege(%L, ''public.blocked_users'', %L)::text', who, priv));
    end loop;
    perform pg_temp.eq('4', 'priv_blocked_users_' || who || '_no_column_update', 'false',
      format('select has_any_column_privilege(%L, ''public.blocked_users'', ''UPDATE'')::text', who));
  end loop;
end $$;

select json_agg(json_build_object('item',item,'check',k,'expected',expected,'actual',actual,'result',case when ok then 'PASS' else 'FAIL' end) order by seq) from r
union all
select json_build_array(json_build_object('summary', 'pass=' || count(*) filter (where ok) || ' fail=' || count(*) filter (where not ok))) from r;
rollback;
