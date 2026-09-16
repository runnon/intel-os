-- Theater Picture — initial schema (Product Spec v0.1 §6 data model)

create type aor as enum ('CENTCOM','EUCOM','INDOPACOM','AFRICOM','NORTHCOM','SOUTHCOM');
create type affiliation as enum ('hostile','friendly','neutral','unknown');
create type geo_precision as enum ('point','settlement','region');
create type confidence as enum ('high','moderate','low');

create table events (
  id uuid primary key default gen_random_uuid(),
  aor aor not null,
  title text not null,
  summary text not null,
  occurred_at timestamptz not null,
  reported_at timestamptz not null,
  category text not null,
  affiliation affiliation not null,
  place_name text not null,
  country text,
  lat double precision,
  lon double precision,
  precision geo_precision not null,
  geom_validated boolean not null default false,   -- DATA-2
  geo_confidence real not null default 0,          -- AUTO-3
  conf_origin confidence not null,                 -- DATA-5
  conf_actor confidence not null,                  -- DATA-5
  us_forces_flag boolean not null default false,
  us_impact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_aor_occurred_idx on events (aor, occurred_at desc);
create index events_us_flag_idx on events (aor, us_forces_flag) where us_forces_flag;

-- DATA-1: every event carries source references resolvable to a specific report
create table event_sources (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  url text not null,
  outlet text not null,
  title text,
  published_at timestamptz,
  evaluation text,          -- ATP 2-33.4 reliability/credibility, e.g. 'B2'
  created_at timestamptz not null default now(),
  unique (event_id, url)
);

-- DATA-6: edits are versioned; prior values remain visible
create table event_revisions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  at timestamptz not null default now(),
  field text not null,
  prior text not null,
  current text not null,
  note text
);

-- AUTO-10: every issue retained and addressable; immutable snapshot of its content
create table issues (
  id uuid primary key default gen_random_uuid(),
  serial text not null unique,
  aor aor not null,
  issue_number int not null,
  product_type text not null default 'situation-update',
  window_start timestamptz not null,
  info_cutoff timestamptz not null,               -- UX-4
  published_at timestamptz not null default now(),
  event_ids uuid[] not null,
  tempo jsonb not null,
  change_log jsonb not null,
  source_summary jsonb not null,
  disclaimer text not null,                        -- MARK-2
  snapshot jsonb not null,                         -- full event payloads at publish time
  unique (aor, issue_number)
);

-- AUTO-9: failed/partial runs publish nothing and are visible for alerting
create table ingest_runs (
  id uuid primary key default gen_random_uuid(),
  aor aor not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  fetched int not null default 0,
  extracted int not null default 0,
  deduped int not null default 0,
  published_issue uuid references issues(id),
  error text
);

-- RLS: public read (product is public/unclassified per spec open decision),
-- writes only via service role (worker).
alter table events enable row level security;
alter table event_sources enable row level security;
alter table event_revisions enable row level security;
alter table issues enable row level security;
alter table ingest_runs enable row level security;

create policy events_read on events for select using (true);
create policy event_sources_read on event_sources for select using (true);
create policy event_revisions_read on event_revisions for select using (true);
create policy issues_read on issues for select using (true);
-- ingest_runs intentionally has no public read policy (operational telemetry)
