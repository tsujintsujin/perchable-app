-- Build 7 storage RLS check. One transaction, rolled back: leaves no rows.
-- (Delete policy not testable in SQL: storage.protect_delete blocks direct deletes; covered on-device.)
begin;
create temp table r(k text, v text) on commit drop;
grant all on r to authenticated, anon;
insert into storage.objects (bucket_id, name, owner) values ('avatars','22222222-2222-2222-2222-222222222222/avatar.jpg',null);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',true);
do $$ begin
 begin insert into storage.objects (bucket_id,name) values ('avatars','11111111-1111-1111-1111-111111111111/avatar.jpg'); insert into r values('insert_own','ok'); exception when others then insert into r values('insert_own','rejected '||sqlstate); end;
 begin insert into storage.objects (bucket_id,name) values ('avatars','22222222-2222-2222-2222-222222222222/x.jpg'); insert into r values('insert_other','ALLOWED'); exception when others then insert into r values('insert_other','rejected '||sqlstate); end;
 begin insert into storage.objects (bucket_id,name) values ('avatars','avatar.jpg'); insert into r values('insert_root','ALLOWED'); exception when others then insert into r values('insert_root','rejected '||sqlstate); end;
end $$;
insert into r select 'select_visible', count(*)::text from storage.objects where bucket_id='avatars';
update storage.objects set name=name where name like '2222%';
reset role;
set local role anon;
insert into r select 'anon_list', count(*)::text from storage.objects where bucket_id='avatars';
reset role;
create temp table out_ as select json_agg(r) j from r;
select j from out_;
rollback;
