-- Community reports: events sent in by signed-in users, shown on their own clearly
-- labeled, off-by-default map layer. They are NEVER folded into a situation update:
-- the worker does not read this table, and issues/events are untouched (AUTO-5,
-- AUTO-10). See docs/DECISIONS.md, 2026-10-30 "Community reports layer".
--
-- Guardrails enforced here, not only in the web route, because a signed-in user can
-- call PostgREST directly with their own JWT:
--   * every report carries a public http(s) source link (MARK-4, mirrored in SQL);
--   * no coordinates are stored: the site resolves place_name against the curated
--     gazetteer at read time, so nobody can plant an arbitrary point (DATA-2);
--   * per-user rate limits (trigger), and the submitter's identity is never public:
--     anon/authenticated read through public_community_reports(), which omits user_id;
--   * three distinct users flagging a report hides it; the owner can delete their own.

create table if not exists community_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  aor public.aor not null,
  title text not null check (char_length(title) between 8 and 140),
  summary text not null default '' check (char_length(summary) <= 1000),
  place_name text not null check (char_length(place_name) between 2 and 120),
  country text not null default '' check (char_length(country) <= 60),
  occurred_at timestamptz not null,
  source_url text not null check (
    char_length(source_url) <= 2000
    and source_url ~* '^https?://[^/?#\s]+'
    and source_url !~* '^https?://([^/?#@]*@)?(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|0\.|\[)'
    and source_url !~* '^https?://([^/?#@]*@)?[^/?#:]*\.(local|internal|intranet|lan|corp|home)([:/?#]|$)'
  ),
  hidden boolean not null default false,
  flag_count integer not null default 0
);

create index if not exists community_reports_aor_idx
  on community_reports (aor, occurred_at desc) where not hidden;
create index if not exists community_reports_user_idx
  on community_reports (user_id, created_at desc);

create table if not exists community_report_flags (
  report_id uuid not null references community_reports(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

alter table community_reports enable row level security;
alter table community_report_flags enable row level security;

-- Users see and manage only their own rows directly; the public read path is the RPC.
drop policy if exists community_reports_insert_own on community_reports;
create policy community_reports_insert_own on community_reports
  for insert to authenticated
  with check (user_id = auth.uid() and not hidden and flag_count = 0);

drop policy if exists community_reports_select_own on community_reports;
create policy community_reports_select_own on community_reports
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists community_reports_delete_own on community_reports;
create policy community_reports_delete_own on community_reports
  for delete to authenticated
  using (user_id = auth.uid());

-- Insert guard: sane dates, rate limits, and no resubmitting the same link.
create or replace function community_reports_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.occurred_at > now() + interval '1 hour' then
    raise exception 'occurred_at is in the future' using errcode = '22023';
  end if;
  if new.occurred_at < now() - interval '30 days' then
    raise exception 'occurred_at is more than 30 days ago' using errcode = '22023';
  end if;
  if (select count(*) from public.community_reports
      where user_id = new.user_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate limit: 5 reports per hour' using errcode = 'P0429';
  end if;
  if (select count(*) from public.community_reports
      where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate limit: 20 reports per day' using errcode = 'P0429';
  end if;
  if exists (select 1 from public.community_reports
             where user_id = new.user_id and source_url = new.source_url
               and created_at > now() - interval '7 days') then
    raise exception 'duplicate: you already submitted this link' using errcode = '23505';
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists community_reports_guard on community_reports;
create trigger community_reports_guard
  before insert on community_reports
  for each row execute function community_reports_guard();

-- Public read: the last 30 days for one theater, newest first, without user_id.
-- `mine` lets a signed-in viewer delete their own report; `flagged` shows their flag.
create or replace function public_community_reports(p_aor public.aor)
returns table (
  id uuid,
  created_at timestamptz,
  aor public.aor,
  title text,
  summary text,
  place_name text,
  country text,
  occurred_at timestamptz,
  source_url text,
  mine boolean,
  flagged boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.created_at, r.aor, r.title, r.summary, r.place_name, r.country,
         r.occurred_at, r.source_url,
         coalesce(r.user_id = auth.uid(), false) as mine,
         exists (select 1 from public.community_report_flags f
                 where f.report_id = r.id and f.user_id = auth.uid()) as flagged
  from public.community_reports r
  where r.aor = p_aor
    and not r.hidden
    and r.occurred_at > now() - interval '30 days'
  order by r.occurred_at desc, r.created_at desc
  limit 300
$$;

-- Flag a report (one flag per user; not your own). Three flags hide it.
create or replace function flag_community_report(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if exists (select 1 from public.community_reports where id = p_id and user_id = v_uid) then
    raise exception 'cannot flag your own report' using errcode = '22023';
  end if;
  insert into public.community_report_flags (report_id, user_id)
  select p_id, v_uid
  where exists (select 1 from public.community_reports where id = p_id)
  on conflict do nothing;
  select count(*) into v_count from public.community_report_flags where report_id = p_id;
  update public.community_reports
     set flag_count = v_count, hidden = hidden or v_count >= 3
   where id = p_id;
  return v_count >= 3;
end;
$$;

-- Supabase's default privileges grant anon/authenticated everything on new objects in
-- public; revoke explicitly from them too, then grant back only what is meant.
revoke all on community_reports, community_report_flags from public, anon, authenticated;
revoke all on function public_community_reports(public.aor) from public, anon, authenticated;
revoke all on function flag_community_report(uuid) from public, anon, authenticated;
revoke all on function community_reports_guard() from public, anon, authenticated;
grant execute on function public_community_reports(public.aor) to anon, authenticated;
grant execute on function flag_community_report(uuid) to authenticated;
grant select, insert, delete on community_reports to authenticated;
