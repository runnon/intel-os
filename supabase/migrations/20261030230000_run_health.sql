-- Ingest observability (audit 2026-10-30):
--   * which code ran each cycle (the worker silently ran 09-17 code until 10-30),
--   * how many sources failed (dead feeds shrank the article pool unnoticed),
--   * one cycle id across the six per-AOR rows, so a missed cycle is visible as a gap.
-- Additive only; ingest_runs stays service-role-only (no public policy).

alter table ingest_runs add column if not exists cycle_id uuid;
alter table ingest_runs add column if not exists code_version text;
alter table ingest_runs add column if not exists source_health jsonb;

create index if not exists ingest_runs_aor_started_idx on ingest_runs (aor, started_at desc);

-- Public freshness probe for /api/health and the scheduled staleness check: per
-- command, the latest issue's serial and times plus the last run's time and outcome.
-- No error text, counts or source detail leave the table.
create or replace function public_issue_freshness()
returns table (
  aor public.aor,
  serial text,
  published_at timestamptz,
  info_cutoff timestamptz,
  last_run_at timestamptz,
  last_run_ok boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.aor, i.serial, i.published_at, i.info_cutoff, r.finished_at, r.ok
  from unnest(enum_range(null::public.aor)) as a(aor)
  left join lateral (
    select serial, published_at, info_cutoff from public.issues
    where issues.aor = a.aor order by issue_number desc limit 1
  ) i on true
  left join lateral (
    select finished_at, ok from public.ingest_runs
    where ingest_runs.aor = a.aor order by started_at desc limit 1
  ) r on true
  order by a.aor
$$;

revoke all on function public_issue_freshness() from public, anon, authenticated;
grant execute on function public_issue_freshness() to anon, authenticated;
