-- Theater Picture — subscription hardening and capability-scoped reads
--
-- Public users receive a complete, source-transparent 72-hour picture. Full
-- immutable issue snapshots require an active Analyst entitlement. Raw event
-- rows remain worker-only. The canonical issue rows remain unchanged (AUTO-10).

alter table entitlements
  add column if not exists trial_used boolean not null default false,
  add column if not exists trial_end timestamptz,
  add column if not exists last_stripe_event_created bigint,
  add column if not exists last_stripe_event_id text;

-- Central entitlement predicate used by RLS. It deliberately fails closed when
-- Stripe did not provide a paid-period/trial end.
create or replace function has_active_analyst_entitlement()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.user_id = auth.uid()
      and e.status in ('active', 'trialing')
      and e.current_period_end is not null
      and e.current_period_end > now()
  );
$$;

revoke all on function has_active_analyst_entitlement() from public;
grant execute on function has_active_analyst_entitlement() to anon, authenticated;

-- Public current-picture projection. The canonical issue remains a 30-day,
-- immutable snapshot; this function returns only the objective 72-hour slice
-- anchored to that issue's published information cut-off.
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
  with latest as (
    select distinct on (i.aor) i.*
    from public.issues i
    order by i.aor, i.issue_number desc
  ), filtered as (
    select
      i.*,
      coalesce(
        (
          select jsonb_agg(item.value order by item.ordinality)
          from jsonb_array_elements(i.snapshot) with ordinality as item(value, ordinality)
          where (item.value ->> 'occurredAt')::timestamptz >= i.info_cutoff - interval '72 hours'
            and (item.value ->> 'occurredAt')::timestamptz <= i.info_cutoff
        ),
        '[]'::jsonb
      ) as public_snapshot
    from latest i
  )
  select
    f.id, f.serial, f.aor, f.issue_number, f.product_type,
    greatest(f.window_start, f.info_cutoff - interval '72 hours'),
    f.info_cutoff, f.published_at,
    coalesce(
      array(
        select (event.value ->> 'id')::uuid
        from jsonb_array_elements(f.public_snapshot) as event(value)
      ),
      array[]::uuid[]
    ),
    f.tempo,
    coalesce(
      (
        select jsonb_agg(entry.value order by entry.ordinality)
        from jsonb_array_elements(f.change_log) with ordinality as entry(value, ordinality)
        where entry.value ->> 'eventId' in (
          select event.value ->> 'id'
          from jsonb_array_elements(f.public_snapshot) as event(value)
        )
      ),
      '[]'::jsonb
    ),
    f.source_summary, f.disclaimer, f.public_snapshot
  from filtered f
  order by f.published_at desc;
$$;

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

-- The current serial remains reproducible for public viewers, but only receives
-- its 72-hour slice. Prior serial payloads require Analyst; otherwise walking
-- backward through several recent serials would reconstruct the paid archive.
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
  with selected as (
    select i.*
    from public.issues i
    where i.serial = p_serial
      and i.issue_number = (
        select max(latest.issue_number)
        from public.issues latest
        where latest.aor = i.aor
      )
    limit 1
  ), filtered as (
    select
      i.*,
      coalesce(
        (
          select jsonb_agg(item.value order by item.ordinality)
          from jsonb_array_elements(i.snapshot) with ordinality as item(value, ordinality)
          where (item.value ->> 'occurredAt')::timestamptz >= i.info_cutoff - interval '72 hours'
            and (item.value ->> 'occurredAt')::timestamptz <= i.info_cutoff
        ),
        '[]'::jsonb
      ) as public_snapshot
    from selected i
  )
  select
    f.id, f.serial, f.aor, f.issue_number, f.product_type,
    greatest(f.window_start, f.info_cutoff - interval '72 hours'),
    f.info_cutoff, f.published_at,
    coalesce(
      array(
        select (event.value ->> 'id')::uuid
        from jsonb_array_elements(f.public_snapshot) as event(value)
      ),
      array[]::uuid[]
    ),
    f.tempo,
    coalesce(
      (
        select jsonb_agg(entry.value order by entry.ordinality)
        from jsonb_array_elements(f.change_log) with ordinality as entry(value, ordinality)
        where entry.value ->> 'eventId' in (
          select event.value ->> 'id'
          from jsonb_array_elements(f.public_snapshot) as event(value)
        )
      ),
      '[]'::jsonb
    ),
    f.source_summary, f.disclaimer, f.public_snapshot
  from filtered f;
$$;

-- Archive discovery remains public, but this projection contains no snapshots,
-- coordinates, summaries, or source URLs.
create or replace function public_issue_archive(p_aor public.aor)
returns table (
  serial text,
  aor public.aor,
  issue_number integer,
  published_at timestamptz,
  info_cutoff timestamptz,
  tempo jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.serial, i.aor, i.issue_number, i.published_at, i.info_cutoff, i.tempo
  from public.issues i
  where i.aor = p_aor
  order by i.issue_number desc
  limit 200;
$$;

create or replace function public_issue_metadata(p_serial text)
returns table (
  serial text,
  aor public.aor,
  issue_number integer,
  published_at timestamptz,
  info_cutoff timestamptz,
  tempo jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.serial, i.aor, i.issue_number, i.published_at, i.info_cutoff, i.tempo
  from public.issues i
  where i.serial = p_serial
  limit 1;
$$;

revoke all on function public_latest_issues() from public;
revoke all on function public_latest_issue(public.aor) from public;
revoke all on function public_issue_by_serial(text) from public;
revoke all on function public_issue_archive(public.aor) from public;
revoke all on function public_issue_metadata(text) from public;
grant execute on function public_latest_issues() to anon, authenticated;
grant execute on function public_latest_issue(public.aor) to anon, authenticated;
grant execute on function public_issue_by_serial(text) to anon, authenticated;
grant execute on function public_issue_archive(public.aor) to anon, authenticated;
grant execute on function public_issue_metadata(text) to anon, authenticated;

-- Exposure writes are server-authorized so a browser cannot pre-seed a false
-- experiment bucket and corrupt conversion reporting.
drop policy if exists pricing_exposures_self_insert on pricing_exposures;
alter table pricing_exposures
  add constraint pricing_exposures_variant_check check (variant in ('a', 'b'));

create or replace function record_pricing_exposure(
  p_secret text,
  p_variant text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected text;
begin
  select grant_secret into expected from public.entitlement_admin where id = 1;
  if expected is null or p_secret is null or p_secret <> expected then
    raise exception 'unauthorized';
  end if;
  if auth.uid() is null or p_variant not in ('a', 'b') then
    raise exception 'invalid pricing exposure';
  end if;

  insert into public.pricing_exposures (user_id, variant)
  values (auth.uid(), p_variant)
  on conflict (user_id) do nothing;
  return found;
end;
$$;

revoke all on function record_pricing_exposure(text, text) from public;
grant execute on function record_pricing_exposure(text, text) to authenticated;

-- Stripe webhook idempotency and ordering. No client role can read this table;
-- the guarded function records each event once and ignores stale delivery.
create table if not exists stripe_webhook_events (
  event_id text primary key,
  event_created bigint not null,
  event_type text not null,
  outcome text not null,
  processed_at timestamptz not null default now()
);
alter table stripe_webhook_events enable row level security;

create or replace function process_stripe_entitlement_event(
  p_secret text,
  p_event_id text,
  p_event_created bigint,
  p_event_type text,
  p_user_id uuid,
  p_email text,
  p_plan text,
  p_status text,
  p_price_id text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_trial_end timestamptz
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected text;
  current_row public.entitlements%rowtype;
  result text := 'applied';
begin
  select grant_secret into expected from public.entitlement_admin where id = 1;
  if expected is null or p_secret is null or p_secret <> expected then
    raise exception 'unauthorized';
  end if;

  if p_event_id is null or p_event_created is null or p_user_id is null
     or p_email is null or p_stripe_subscription_id is null then
    raise exception 'invalid entitlement event';
  end if;

  insert into public.stripe_webhook_events (event_id, event_created, event_type, outcome)
  values (p_event_id, p_event_created, p_event_type, 'processing')
  on conflict (event_id) do nothing;
  if not found then
    select outcome into result from public.stripe_webhook_events where event_id = p_event_id;
    return coalesce(result, 'duplicate');
  end if;

  result := 'applied';

  select * into current_row from public.entitlements where user_id = p_user_id for update;

  if found
     and current_row.stripe_subscription_id = p_stripe_subscription_id
     and current_row.last_stripe_event_created is not null
     and current_row.last_stripe_event_created > p_event_created then
    result := 'stale';
  elsif found
     and current_row.stripe_subscription_id is distinct from p_stripe_subscription_id
     and current_row.status in ('active', 'trialing')
     and p_status not in ('active', 'trialing') then
    -- A late cancellation for an older subscription must not revoke the current one.
    result := 'stale_subscription';
  elsif found
     and current_row.stripe_subscription_id is distinct from p_stripe_subscription_id
     and current_row.status in ('active', 'trialing')
     and current_row.current_period_end > now()
     and p_status in ('active', 'trialing') then
    -- Keep the first live subscription authoritative; the webhook cancels the
    -- accidental duplicate after this transaction commits.
    result := 'conflicting_active';
  else
    insert into public.entitlements as e (
      user_id, email, plan, status, price_id,
      stripe_customer_id, stripe_subscription_id, current_period_end,
      cancel_at_period_end, trial_used, trial_end,
      last_stripe_event_created, last_stripe_event_id, updated_at
    ) values (
      p_user_id, p_email, p_plan, p_status, p_price_id,
      p_stripe_customer_id, p_stripe_subscription_id, p_current_period_end,
      coalesce(p_cancel_at_period_end, false), p_trial_end is not null, p_trial_end,
      p_event_created, p_event_id, now()
    )
    on conflict (user_id) do update set
      email = excluded.email,
      plan = excluded.plan,
      status = excluded.status,
      price_id = excluded.price_id,
      stripe_customer_id = coalesce(excluded.stripe_customer_id, e.stripe_customer_id),
      stripe_subscription_id = excluded.stripe_subscription_id,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      trial_used = e.trial_used or excluded.trial_used,
      trial_end = coalesce(excluded.trial_end, e.trial_end),
      last_stripe_event_created = excluded.last_stripe_event_created,
      last_stripe_event_id = excluded.last_stripe_event_id,
      updated_at = now();
  end if;

  update public.stripe_webhook_events set outcome = result where event_id = p_event_id;
  return result;
end;
$$;

revoke all on function process_stripe_entitlement_event(text, text, bigint, text, uuid, text, text, text, text, text, text, timestamptz, boolean, timestamptz) from public;
grant execute on function process_stripe_entitlement_event(text, text, bigint, text, uuid, text, text, text, text, text, text, timestamptz, boolean, timestamptz) to anon;

-- Durable, per-user drafting limits. The endpoint supplies its configured
-- ceilings; direct calls can only consume the caller's own allowance.
create table if not exists analyst_usage_monthly (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  request_count integer not null default 0,
  primary key (user_id, period_start)
);
alter table analyst_usage_monthly enable row level security;

create table if not exists analyst_usage_minute (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (user_id, window_start)
);
alter table analyst_usage_minute enable row level security;

create table if not exists analyst_usage_trial (
  user_id uuid primary key references auth.users(id) on delete cascade,
  request_count integer not null default 0
);
alter table analyst_usage_trial enable row level security;

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
  entitlement_status text;
  safe_monthly_limit integer := greatest(1, least(coalesce(p_monthly_limit, 200), 10000));
  safe_minute_limit integer := greatest(1, least(coalesce(p_minute_limit, 5), 60));
  safe_trial_limit integer := greatest(1, least(coalesce(p_trial_limit, 20), 1000));
begin
  if uid is null then return 'unauthenticated'; end if;
  if not public.has_active_analyst_entitlement() then return 'subscription_required'; end if;

  select status into entitlement_status
  from public.entitlements
  where user_id = uid;

  insert into public.analyst_usage_minute as usage (user_id, window_start, request_count)
  values (uid, minute_start, 1)
  on conflict (user_id, window_start) do update
    set request_count = usage.request_count + 1
    where usage.request_count < safe_minute_limit
  returning request_count into applied;
  if applied is null then return 'minute_limit'; end if;

  if entitlement_status = 'trialing' then
    applied := null;
    insert into public.analyst_usage_trial as usage (user_id, request_count)
    values (uid, 1)
    on conflict (user_id) do update
      set request_count = usage.request_count + 1
      where usage.request_count < safe_trial_limit
    returning request_count into applied;
    if applied is null then return 'trial_limit'; end if;
    return 'ok';
  end if;

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
