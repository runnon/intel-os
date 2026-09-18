-- Theater Picture — activate the subscription access boundary.
--
-- Deploy sequence for zero downtime:
--   1. Apply 20260917000002_subscription_hardening.sql (additive).
--   2. Deploy the web application that reads the new public RPCs.
--   3. Apply this migration to remove legacy direct-public access.

-- Canonical issue snapshots require an active Analyst entitlement. Public users
-- receive their 72-hour projection through public_latest_issue(s) instead.
drop policy if exists issues_read on issues;
drop policy if exists issues_analyst_read on issues;
create policy issues_analyst_read on issues
  for select using (has_active_analyst_entitlement());

-- Raw rows may contain pre-publication or uncorroborated leads. Both tiers read
-- only published issue snapshots, so no web client needs these legacy policies.
drop policy if exists events_read on events;
drop policy if exists event_sources_read on event_sources;
drop policy if exists event_revisions_read on event_revisions;

-- The new webhook uses process_stripe_entitlement_event(); retire the legacy,
-- non-idempotent path only after the new web deployment is serving traffic.
revoke execute on function grant_entitlement(text, uuid, text, text, text, text, text, text, timestamptz, boolean) from anon, authenticated;
