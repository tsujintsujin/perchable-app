-- Build 6 RLS/trigger check. Runs inside one transaction and rolls back: leaves no rows.
-- Run via Management API database/query (see logs/build-06-profile.md).
begin;
create temp table r(k text, v text) on commit drop;
grant all on r to authenticated, anon;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t1@example.test','{"full_name":"Test One","picture":"https://x/p.png"}',now(),now()),
       ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t2@example.test','{"name":"Test Two"}',now(),now());
insert into r select 'trigger_rows', count(*)::text from public.profiles where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
insert into r select 'mapped', display_name||'|'||coalesce(avatar_url,'null') from public.profiles where id='11111111-1111-1111-1111-111111111111';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',true);
insert into r select 'auth_can_select_all', count(*)::text from public.profiles;
update public.profiles set usertag='otheruser' where id='22222222-2222-2222-2222-222222222222';
insert into r select 'update_other_affected', count(*)::text from public.profiles where usertag='otheruser';
update public.profiles set usertag='cineowl' where id='11111111-1111-1111-1111-111111111111';
insert into r select 'update_own', coalesce(usertag,'null') from public.profiles where id='11111111-1111-1111-1111-111111111111';
do $$ begin begin update public.profiles set usertag='Bad Tag' where id='11111111-1111-1111-1111-111111111111'; insert into r values('bad_tag','ALLOWED'); exception when others then insert into r values('bad_tag','rejected: '||sqlstate); end;
begin update public.profiles set created_at=now()-interval '1 year' where id='11111111-1111-1111-1111-111111111111'; insert into r values('created_at_write','ALLOWED'); exception when others then insert into r values('created_at_write','rejected: '||sqlstate); end;
begin insert into public.profiles(id) values(gen_random_uuid()); insert into r values('client_insert','ALLOWED'); exception when others then insert into r values('client_insert','rejected: '||sqlstate); end;
begin delete from public.profiles where id='11111111-1111-1111-1111-111111111111'; insert into r select 'client_delete_rows_left', count(*)::text from public.profiles where id='11111111-1111-1111-1111-111111111111'; exception when others then insert into r values('client_delete','rejected: '||sqlstate); end; end $$;
reset role;
set local role anon;
do $$ begin begin perform count(*) from public.profiles; insert into r values('anon_select','ALLOWED'); exception when others then insert into r values('anon_select','rejected: '||sqlstate); end; end $$;
reset role;
update public.profiles set usertag='cineowl2' where id='22222222-2222-2222-2222-222222222222';
do $$ begin begin update public.profiles set usertag='cineowl' where id='22222222-2222-2222-2222-222222222222'; insert into r values('dup_tag','ALLOWED'); exception when others then insert into r values('dup_tag','rejected: '||sqlstate); end; end $$;
delete from auth.users where id='11111111-1111-1111-1111-111111111111';
insert into r select 'cascade_rows_left', count(*)::text from public.profiles where id='11111111-1111-1111-1111-111111111111';
select json_agg(r) from r;
rollback;
