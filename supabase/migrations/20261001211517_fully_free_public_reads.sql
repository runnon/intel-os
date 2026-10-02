-- Theater Picture — fully free (2026-10-01): the paywall is removed.
--
-- Every visitor, signed in or not, gets the complete product: full canonical issue
-- snapshots (72H / 7D / 30D / ALL), the whole immutable issue archive by serial,
-- and reports. The web app reads through these SECURITY DEFINER projections with the
-- ANON key, so no service-role key is needed in Vercel (AGENTS.md).
--
-- What changes:
--   * public_latest_issues() / public_latest_issue() return each AOR's latest issue
--     row VERBATIM (the whole issue window), not the 72-hour slice.
--   * public_issue_by_serial() returns ANY published serial verbatim, not only the
--     current one.
--   * consume_analyst_quota() no longer requires an Analyst entitlement — any
--     signed-in user may draft; the per-user minute/monthly ceilings stay as abuse
--     protection on the paid model.
--
-- What does NOT change (reads only — no write path is widened):
--   * issues/events/event_sources/event_revisions RLS policies are untouched; the
--     raw tables stay unreadable to anon, and writes stay worker-only (service role).
--   * Canonical issue rows are never mutated (AUTO-10); these functions only SELECT.
--   * Entitlement / Stripe / free-beta tables and functions are left in place,
--     dormant, so a paid tier can be re-enabled later without a schema change.
--
-- Idempotent: CREATE OR REPLACE with unchanged signatures and return types, and
-- re-applied grants.

create or replace function public_latest_issues()
returns table (
  id uuid,
  serial text,
  aor public.aor,
  issue_number integer,
  product_type text,
  window_start timestamptz,
  info_cutoff timestamptz,
  published_at timestamptz,
  event_ids uuid[],
  tempo jsonb,
  change_log jsonb,
  source_summary jsonb,
  disclaimer text,
  snapshot jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id, l.serial, l.aor, l.issue_number, l.product_type,
    l.window_start, l.info_cutoff, l.published_at, l.event_ids,
    l.tempo, l.change_log, l.source_summary, l.disclaimer, l.snapshot
  from (
    select distinct on (i.aor) i.*
    from public.issues i
    order by i.aor, i.issue_number desc
  ) l
  order by l.published_at desc;
$$;

-- Unchanged body (it delegates to public_latest_issues), restated so this
-- migration is self-describing about the full public read surface.
create or replace function public_latest_issue(p_aor public.aor)
returns table (
  id uuid,
  serial text,
  aor public.aor,
  issue_number integer,
  product_type text,
  window_start timestamptz,
  info_cutoff timestamptz,
  published_at timestamptz,
  event_ids uuid[],
  tempo jsonb,
  change_log jsonb,
  source_summary jsonb,
  disclaimer text,
  snapshot jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.public_latest_issues() p
  where p.aor = p_aor
  limit 1;
$$;

create or replace function public_issue_by_serial(p_serial text)
returns table (
  id uuid,
  serial text,
  aor public.aor,
  issue_number integer,
  product_type text,
  window_start timestamptz,
  info_cutoff timestamptz,
  published_at timestamptz,
  event_ids uuid[],
  tempo jsonb,
  change_log jsonb,
  source_summary jsonb,
  disclaimer text,
  snapshot jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id, i.serial, i.aor, i.issue_number, i.product_type,
    i.window_start, i.info_cutoff, i.published_at, i.event_ids,
    i.tempo, i.change_log, i.source_summary, i.disclaimer, i.snapshot
  from public.issues i
  where i.serial = p_serial
  limit 1;
$$;

revoke all on function public_latest_issues() from public;
revoke all on function public_latest_issue(public.aor) from public;
revoke all on function public_issue_by_serial(text) from public;
grant execute on function public_latest_issues() to anon, authenticated;
grant execute on function public_latest_issue(public.aor) to anon, authenticated;
grant execute on function public_issue_by_serial(text) to anon, authenticated;

-- Drafting quota: identity is still required (the quota is keyed on auth.uid()),
-- but an entitlement is not. Every signed-in user is metered by the same minute and
-- monthly ceilings. There is no trial tier any more; p_trial_limit is kept only so
-- the signature (and the deployed web client's call) is unchanged.
create or replace function consume_analyst_quota(
  p_monthly_limit integer,
  p_minute_limit integer,
  p_trial_limit integer
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  month_start date := date_trunc('month', now() at time zone 'utc')::date;
  minute_start timestamptz := date_trunc('minute', now());
  applied integer;
  safe_monthly_limit integer := greatest(1, least(coalesce(p_monthly_limit, 200), 10000));
  safe_minute_limit integer := greatest(1, least(coalesce(p_minute_limit, 5), 60));
begin
  if uid is null then return 'unauthenticated'; end if;

  insert into public.analyst_usage_minute as usage (user_id, window_start, request_count)
  values (uid, minute_start, 1)
  on conflict (user_id, window_start) do update
    set request_count = usage.request_count + 1
    where usage.request_count < safe_minute_limit
  returning request_count into applied;
  if applied is null then return 'minute_limit'; end if;

  applied := null;
  insert into public.analyst_usage_monthly as usage (user_id, period_start, request_count)
  values (uid, month_start, 1)
  on conflict (user_id, period_start) do update
    set request_count = usage.request_count + 1
    where usage.request_count < safe_monthly_limit
  returning request_count into applied;
  if applied is null then return 'monthly_limit'; end if;

  return 'ok';
end;
$$;

revoke all on function consume_analyst_quota(integer, integer, integer) from public;
grant execute on function consume_analyst_quota(integer, integer, integer) to authenticated;
