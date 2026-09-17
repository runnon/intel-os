# Hosted subscription model (proposal)

Status: **draft for maintainer decision**. This document does not change access,
RLS, authentication, or billing.

## Product principle

Charge for hosted history, synthesis, and workflow—not for the credibility of a
currently visible public fact. The free theater must remain useful enough to
establish trust: every event it shows retains its source links, confidence,
attribution, precision, issue serial, information cut-off, and markings.

The hosted subscription can coexist with the MIT project. Self-hosters can run
the complete stack; subscribers pay for the operated service, retained archive,
model usage, and analyst workflow.

## Recommendation

Use the issue's immutable `info_cutoff` as the clock. The public window is every
event with:

```text
occurredAt >= info_cutoff - 72 hours
occurredAt <= info_cutoff
```

Do not expose only “the first few” events. Selecting a small subset implies
importance and risks turning an unattended chronological product into a
judgement about which events matter. A 72-hour boundary is objective,
explainable, and reproducible for every serial.

Do not blur old map symbols. Blur is inaccessible, can be mistaken for low
geospatial confidence, and is not access control if the browser already has the
coordinates. Free clients should not receive older event payloads. Instead,
show one honest archive affordance such as “18 events precede the public
72-hour window,” with an upgrade action.

## Proposed tiers

The first release should have two entitlements: `public` and `pro`. A team tier
should wait until shared workspaces, roles, and signed assessment workflow
actually exist.

| Surface | Public | Pro |
|---|---|---|
| Command selector | Current status for all six AORs | Same |
| Live theater map | Complete trailing 72 hours | 72H, 7D, 30D, and full issue |
| Visible event detail | Full summary, sources, confidence, affiliation, precision, US-impact field | Same, across the paid time window |
| Reference geography | Pipelines and shipping-network routes | Same |
| Filters and URL sharing | All filters within 72 hours | All filters across paid history |
| Archive listing | Serial, cut-off, event count, and coverage metadata | Full immutable issue snapshots and serial deep links |
| Report sheet | Current 72-hour facts-only sheet | Full issue and archived report sheets |
| Analyst drafting | Product explanation/sample only; no anonymous model endpoint | Drafting over entitled issue history, with usage limits |
| Saved views and alerts | Not included | Candidate Pro workflow after identity exists |
| Signed assessments | Not included | Separate future governed product; never implied by Pro |

This keeps source transparency, MIL-STD affiliation semantics, and reference
routes public. Paid value comes from time depth and work reduction rather than
removing context from current events.

## Free experience

- Default and maximum public window: 72H.
- `7D`, `30D`, and `ALL` remain visible but locked, so the value boundary is
  discoverable without presenting fake controls.
- No old coordinates, titles, summaries, sources, or hidden DOM nodes are sent
  to the browser.
- The map and event index state the public cut-off explicitly.
- The archive page may list immutable serial metadata, but opening a snapshot
  outside the public window requires Pro.
- Every page and upgrade surface retains the UNCLASSIFIED / open-sources /
  not-official markings.

## Access-control architecture

The current database policy grants anonymous `select` access to every `issues`
row, including the complete JSON snapshot. A React blur or disabled button is
therefore cosmetic: anyone can query the older events directly.

A real boundary requires all of the following:

1. Preserve `issues` as the immutable full canonical record.
2. Remove anonymous full-snapshot reads before launching the paywall.
3. Expose a narrowly shaped public database function or projection that returns
   only the latest issue per AOR and filters its snapshot using that issue's
   `info_cutoff - 72 hours` boundary.
4. Expose a separate public archive-metadata projection with no snapshot JSON.
5. Permit full issue reads only for authenticated, entitled users through RLS.
6. Derive entitlement server-side from trusted identity/subscription state;
   never accept a tier supplied by the browser.
7. Keep the Supabase service-role key in the worker only. The web application
   must not acquire it to bypass RLS.
8. Ensure cached server-component payloads vary by entitlement so a paid
   response can never be served to an anonymous request.

Supabase identity is compatible with the existing stack and can be self-hosted.
Billing-provider selection is deliberately deferred until its marketplace,
self-hostability, webhook, and restricted-network implications are reviewed.
Entitlement records should live in our database behind a small adapter so the
billing provider is replaceable.

## Analyst drafting

Anonymous drafting should not ship: it creates an unbounded model-cost and abuse
surface. Pro drafting should:

- query only the issues the signed-in user is entitled to read;
- enforce server-side request and monthly usage limits;
- retain the current facts-only/no-judgement guardrails;
- never convert a subscription into authority to publish an assessment;
- log timing, outcome, model, and usage without logging prompts or issue bodies.

The free product can show a static example draft generated from public fixture
data. It must not masquerade as a live answer.

## Staged implementation

1. **Entitlement model:** add a typed `public | pro` capability matrix and pure
   filtering functions. Test the exact 72-hour boundary against `info_cutoff`.
2. **Public projection:** add the limited database function/view and archive
   metadata projection. Verify an anon client cannot retrieve an old event or a
   full snapshot.
3. **Dual-read application:** make all theater/report/history loaders request a
   capability-scoped payload. Keep the current UI unchanged while validating
   data parity for the public 72-hour slice.
4. **Identity and entitlement:** add sign-in, account state, and RLS-backed Pro
   access. No billing yet; use maintainer-granted test entitlements.
5. **Upgrade UX:** lock longer windows, add archive counts, and add sign-in /
   upgrade surfaces. Never use blur as a security boundary.
6. **Billing adapter:** choose and connect a provider only after the entitlement
   path is proven. Webhooks update internal subscription state idempotently.
7. **Paid workflow:** enable historical reports and bounded analyst drafting,
   then measure archive and drafting demand before considering a team tier.

Each stage must keep AUTO-5, AUTO-9, AUTO-10, DATA-2/4, MARK-2/3/4, and the
multi-AOR ingest invariant unchanged.

## Decisions still required

1. Is the canonical historical issue archive intended to remain freely public?
   If yes, do not gate raw history; sell hosted drafting, saved workflows,
   alerts, and collaboration instead.
2. Is the first buyer an individual analyst or an organization? This determines
   whether Pro identity is user-based or account-based.
3. What model-usage allowance belongs in Pro? Price should follow measured
   drafting and storage cost, not precede it.
