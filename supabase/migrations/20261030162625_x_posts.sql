-- Distribution log for the X (Twitter) thread the worker posts after each cycle
-- (worker/src/xpost.ts). One row per post in a thread. A row with a post_id went
-- out; a dry_run row is a composed draft that was not posted (X_POST_ENABLED off).
-- Dedupe reads event ids with a post_id, so a draft never blocks a later real post.

create table if not exists x_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('lead', 'event')),
  event_id uuid references events(id) on delete set null,
  text text not null,
  post_id text,
  dry_run boolean not null default false,
  error text
);

create index if not exists x_posts_event_idx on x_posts (event_id) where post_id is not null;

-- Operational telemetry like ingest_runs: RLS on with no policies, so only the
-- worker's service role reads or writes it.
alter table x_posts enable row level security;
