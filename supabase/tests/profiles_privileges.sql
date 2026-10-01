-- Privilege check for public.profiles. ONE transaction: applies the migration,
-- asserts, rolls back. Run with:
--   node supabase/tests/run-sql.mjs supabase/tests/profiles_privileges.sql --migration supabase/migrations/20260930010000_profiles_revoke_default_privileges.sql
-- Without --migration the TRUNCATE/REFERENCES/TRIGGER rows FAIL (the mutation check).
begin;
-- @@MIGRATION@@

create temp table r(seq serial, k text, expected text, actual text, ok boolean);

-- Records one boolean privilege check as PASS/FAIL against the expected value.
create function pg_temp.chk(k text, want boolean, got boolean) returns void language sql as $$
  insert into r(k, expected, actual, ok) values (k, want::text, got::text, got is not distinct from want);
$$;

do $$
declare who text; priv text; col text;
begin
  foreach who in array array['anon','authenticated'] loop
    foreach priv in array array['TRUNCATE','REFERENCES','TRIGGER','INSERT','DELETE'] loop
      perform pg_temp.chk('profiles_' || who || '_no_table_' || priv, false, has_table_privilege(who, 'public.profiles', priv));
    end loop;
    perform pg_temp.chk('profiles_' || who || '_no_column_insert', false, has_any_column_privilege(who, 'public.profiles', 'INSERT'));
    perform pg_temp.chk('profiles_' || who || '_no_column_references', false, has_any_column_privilege(who, 'public.profiles', 'REFERENCES'));
  end loop;
  perform pg_temp.chk('profiles_authenticated_select_true', true, has_table_privilege('authenticated', 'public.profiles', 'SELECT'));
  perform pg_temp.chk('profiles_anon_select_false', false, has_table_privilege('anon', 'public.profiles', 'SELECT') or has_any_column_privilege('anon', 'public.profiles', 'SELECT'));
  perform pg_temp.chk('profiles_anon_no_update', false, has_any_column_privilege('anon', 'public.profiles', 'UPDATE'));
  perform pg_temp.chk('profiles_authenticated_no_table_level_update', false, has_table_privilege('authenticated', 'public.profiles', 'UPDATE'));
  foreach col in array array['display_name','avatar_url','usertag'] loop
    perform pg_temp.chk('profiles_authenticated_update_' || col, true, has_column_privilege('authenticated', 'public.profiles', col, 'UPDATE'));
  end loop;
  foreach col in array array['id','created_at','updated_at'] loop
    perform pg_temp.chk('profiles_authenticated_no_update_' || col, false, has_column_privilege('authenticated', 'public.profiles', col, 'UPDATE'));
  end loop;
end $$;

select json_agg(json_build_object('check',k,'expected',expected,'actual',actual,'result',case when ok then 'PASS' else 'FAIL' end) order by seq) from r
union all
select json_build_array(json_build_object('summary', 'pass=' || count(*) filter (where ok) || ' fail=' || count(*) filter (where not ok))) from r;
rollback;
