-- Build 10a: moderation base. Adds public.reports, public.blocked_users and
-- the public.is_blocked_between helper. Touches nothing else.

-- Reports filed by users. target_id has no FK on purpose: it points at
-- different tables per target_type, and a report must outlive its content.
-- reported_user_id is client-supplied, so an admin treats a report as a lead.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reported_user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint reports_target_type_check check (
    target_type in ('profile', 'comment', 'dm_message', 'collection_item')
  ),
  constraint reports_reason_check check (
    reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'impersonation', 'other')
  ),
  constraint reports_status_check check (
    status in ('open', 'reviewed', 'actioned', 'dismissed')
  ),
  constraint reports_details_length check (details is null or char_length(details) <= 500),
  constraint reports_other_needs_details check (
    reason <> 'other' or (details is not null and btrim(details) <> '')
  ),
  constraint reports_no_self_report check (reporter_id <> reported_user_id),
  constraint reports_profile_target_matches check (
    target_type <> 'profile' or target_id = reported_user_id
  ),
  constraint reports_one_per_target unique (reporter_id, target_type, target_id)
);

-- Admin queue (open reports, oldest first) and per-user lookup / cascade.
create index reports_open_created_at_idx on public.reports (created_at) where status = 'open';
create index reports_reported_user_id_idx on public.reports (reported_user_id);

-- Who has blocked whom. The primary key stops a repeat block.
create table public.blocked_users (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocked_users_no_self_block check (blocker_id <> blocked_id)
);

-- Reverse lookup ("who blocked X") and the cascade from blocked_id.
create index blocked_users_blocked_id_idx on public.blocked_users (blocked_id);

alter table public.reports enable row level security;
alter table public.blocked_users enable row level security;

-- Start from zero access (Supabase's default grants are broader), then add
-- back only what the app needs. service_role / the SQL editor bypass this.
revoke all on public.reports from anon, authenticated;
revoke all on public.blocked_users from anon, authenticated;

-- Reports: insert-only, and only the client-settable columns. reporter_id
-- fills from its default; status, reviewed_at, id, created_at never come
-- from a client. No select/update/delete: a reporter never reads reports back.
grant insert (target_type, target_id, reported_user_id, reason, details)
  on public.reports to authenticated;

-- A report can only be filed as yourself.
create policy "reports_insert_own"
  on public.reports
  for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

-- Blocks: read, add and remove your own; no update.
grant select, delete on public.blocked_users to authenticated;
grant insert (blocker_id, blocked_id) on public.blocked_users to authenticated;

-- Only the blocker sees or creates a block, so nobody can list who blocked them.
create policy "blocked_users_select_own"
  on public.blocked_users
  for select
  to authenticated
  using (blocker_id = (select auth.uid()));

create policy "blocked_users_insert_own"
  on public.blocked_users
  for insert
  to authenticated
  with check (blocker_id = (select auth.uid()));

create policy "blocked_users_delete_own"
  on public.blocked_users
  for delete
  to authenticated
  using (blocker_id = (select auth.uid()));

-- True when either user has blocked the other; false unless the caller is
-- one of the two. Security definer so policies can see blocks they can't read.
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.uid()) in (a, b)
    and exists (
      select 1
      from public.blocked_users bu
      where (bu.blocker_id = a and bu.blocked_id = b)
         or (bu.blocker_id = b and bu.blocked_id = a)
    ),
    false
  );
$$;

-- RLS policies run as the caller, so authenticated needs EXECUTE; nobody else.
revoke all on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;
