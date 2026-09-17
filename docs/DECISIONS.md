# Decision Log

## 2026-09-17 — Persistent installations layer + command switcher

**Installations (Decision, Xavier):** Show the theater's curated bases *always* (not only
when near an event) as MIL-STD-2525 **installation** symbols, framed by **operator**:
`us` (US/coalition, friendly frame), `host` (allied/partner national base, neutral),
`adversary` (strategic-competitor base, hostile), `unknown`. Operator is a public,
open-source attribute (who is based there), not an assessment — untagged bases default to
`host`, never to a US or adversary claim we haven't curated (`packages/core/installations.ts`,
`installations(aor)`). Symbology uses milsymbol symbol-set 20 (Land Installations),
generic entity `000000` → the frame + black installation amplifier, no interior icon, so
it reads as an installation and stays distinct from the event frames (`installationSymbolFor`
in `web/lib/symbols.ts`). Rendered beneath the event symbols on both live and report maps
(`syncInstallations`), labels above zoom 6; legend gains three operator rows. Operator
tags are a first pass (US/coalition, host, adversary) and are maintainer-tunable in one
map. Follow-on: expand the base list and add distinct US-vs-coalition if wanted.

**Command switcher (Decision, Xavier):** The masthead gained a one-click command switcher
(all six AORs, current highlighted) linking to `/t/<aor>`, so you can move between theaters
without editing the URL.

## 2026-09-17 — Alliance / bloc reference layer (all six commands)

**Decision (Xavier):** Generalize the NATO shading into a per-command **bloc layer** so
a reader can see declared alignment ("who is in which bloc") as a factual backdrop under
the events — with distinct treatment for genuinely uncertain areas. Supersedes the
EUCOM-only NATO layer below.

**Invariant-safe framing (why this is not an AUTO-5 violation):**
- Only **declared, factual** membership is encoded, each grounded in a NAMED organisation
  or treaty (`basis` field): NATO, CSTO, GCC, US Major-Non-NATO-Ally status, the
  Quad/AUKUS, ASEAN, ECOWAS, the Sahel Alliance (AES), USMCA, ALBA. We never encode
  "who would side with whom" — that is an assessment.
- Genuinely fluid/disputed alignment is marked `contested` and rendered as **diagonal
  hatch + dashed border**, never solid membership (e.g. Ukraine/Georgia→NATO aspirant;
  Iraq/Lebanon/Yemen→Iran-lean contested). Where there is no factual basis, the country is
  omitted → unshaded (the DATA-4 instinct: uncertain stays unknown, not guessed).
- This is **hand-curated maintainer reference data** (`packages/core/src/blocs.ts`), NOT
  produced by the unattended ingest path. First pass by the agent; fluid theaters
  (AFRICOM/CENTCOM) are expected to need maintainer correction.
- Colours are a muted family (slate ≈ US-aligned bloc, rust ≈ US-rival, taupe ≈ regional
  body) held clear of the four MIL-STD affiliation hues; a unit test enforces this, that
  every alignment references a defined bloc, and no country is listed twice. Legend labels
  it "declared alliance/bloc membership — political context, not an event affiliation and
  not a prediction."

**Data / NFR-4/NFR-5:** `scripts/build-blocs.ts` joins the bloc table to public-domain
Natural Earth boundaries — **10m** primary (highest-res admin-0; 50m fallback for any
microstate it lacks), Douglas–Peucker simplified at ~0.01° and rounded to ~110 m — and
emits `web/public/geo/blocs-<aor>.geojson` (35–680 KB each). Natural Earth is a different
dataset from the OSM basemap, so borders are close-but-not-pixel-exact when zoomed far in;
exact match would require baking country polygons into the (future) self-hosted tiles.
Bloc fill colours are a distinct blue/orange/green triad (indigo ≈ US-aligned, terracotta
≈ rival, olive ≈ regional), held clear of the affiliation hues. Same-origin
static assets, fetched + cached per AOR client-side, fail quiet; no third-party runtime
dependency. `syncBlocs` clears the layer if an AOR has no table. Re-run the script when
the table changes. Build + 70 tests green; verified live on EUCOM (Ukraine/Georgia
hatched) and CENTCOM (GCC/US-ally/Iran + Iraq/Yemen hatched).

## 2026-09-17 — NATO member-state shading on the EUCOM map (superseded)

**Decision (Xavier):** Shade NATO member states on the EUCOM theater map so a reader
sees alliance membership at a glance (NATO vs non-NATO).

**Design guard — kept orthogonal to affiliation:** In a MIL-STD-2525 product, color
means the *affiliation of the event actor* (hostile/friendly/neutral/unknown). A country
shaded "NATO" must never read as "events here are friendly," so the layer uses a
deliberately neutral slate wash (`#7d8794`, 16% fill) held clear of the four affiliation
hues, drawn beneath everything, with a legend line: "NATO member state — political
context (alliance membership), not an event affiliation." This is public, factual context
(who is in the alliance), not an assessment — AUTO-5/DATA-4 unaffected.

**Data / NFR-4/NFR-5:** Boundary geometry is public-domain **Natural Earth 110m**
(`ne_110m_admin_0_countries`), filtered to the 30 EUCOM NATO members (US/Canada are
NORTHCOM and off-viewport), coordinates rounded to ~1 km, shipped as a same-origin static
asset `web/public/geo/nato-eucom.geojson` (18 KB). No third-party runtime dependency;
fetched client-side and cached, and it fails quiet (theater still renders without it).
Scoped to EUCOM only (`syncNato` clears the source for other AORs). Adding US/Canada to
NORTHCOM later is a straightforward follow-on. Build + 68 tests green; verified live on
`/t/eucom` (Ukraine/Russia/Belarus/Austria/Switzerland/Ireland correctly unshaded).

## 2026-09-17 — Context sites (airfields/ports/energy/cities) on the map

**Decision (Xavier):** Draw curated context points of interest — airfields/air bases,
ports/naval facilities, energy sites, and cities — beneath the event symbols, so a
reader sees the important places around an incident. Chosen trigger: a site shows when
a current event NAMES it or when it lies within ~25 km of a PLOTTED event (all four
categories enabled).

**Implementation:** `referencedFeatures(events, aor)` in `packages/core/src/features.ts`
— the point analog of `referencedLines`. It reads only the curated per-AOR gazetteer
(never invents coordinates), maps gazetteer `kind` → category (base/airport→airfield,
port→port, refinery/nuclear/dam/facility→energy, city→city), and returns sites that are
named or within `POI_PROXIMITY_KM`. A site within 2 km of an event is skipped (the event
symbol already marks that spot); results are capped at 60, named-first then nearest.
`TheaterMap.tsx` renders them as small dimmed circle markers (category-colored) with
labels above zoom 5.5 and a hover popup; the legend gains four swatches. Renders on both
the live and report maps. Verified against live CENTCOM data (66 events → 6 sites incl.
King Khalid Air Base); build + 68 tests green.

## 2026-09-17 — Geolocation: partial matches must be whole-word, not substring

**Bug:** An event titled "US bases in the Gulf" (Persian Gulf, mis-selected into
NORTHCOM) was pinned on the US geographic centroid in Kansas (39.8, -98.6). Root cause:
`geolocate` scored a partial match with a raw substring test (`q.includes(n)`), so the
United States entry's 2-letter alias `us` matched the "US" in the title. Any placeName
containing the letters "us" could be dragged to the US centroid.

**Fix:** Partial (non-exact) matches now require whole-word boundaries and ignore any
name/alias shorter than 4 chars as an anchor (`partialHit` in `gazetteer.ts`). Short
tokens (`us`, `usa`, `uae`) still resolve via the exact-match path; they just can't
anchor a fuzzy substring hit. Unmatched place names correctly go unplotted (list-only,
"position withheld") per DATA-2/AUTO-3. Regression test added.

**Still open (separate, judgement calls — not changed here):** (1) events the extractor
tags with placeName "United States" still plot at the region centroid (DATA-3 fallback),
which stacks homeland + overseas-US-forces events on one Kansas pin; (2) the extractor
sometimes reports the actor's nationality ("United States") as the event *location* for
stories that are physically in the Middle East. Both need a maintainer decision.

## 2026-09-17 — CENTCOM gains Israel / Palestinian Territories / Lebanon coverage

**Decision (Xavier):** Add Israel, the Palestinian Territories (Gaza + West Bank), and
Lebanon to CENTCOM ingest. Two compounding gaps had made this reporting invisible: the
`CENTCOM_GAZETTEER` held no places there (so any extracted event resolved to "position
withheld" per DATA-2/AUTO-3), and the CENTCOM GDELT query omitted Israel/Gaza/Hamas/IDF/
West Bank/Lebanon terms (so `selectForAor` never pulled those articles into the slice).
This was a curation gap, not an editorial choice.

**Change:** Added hand-curated gazetteer entries with verified public coordinates
(Jerusalem, Tel Aviv, Haifa, Beersheba, Nevatim AB; Gaza City, Rafah, Khan Yunis,
Ramallah, Jenin, Gaza Strip, West Bank; Beirut, Tyre, Sidon, Nabatieh, Baalbek; plus
Israel/Lebanon/Palestinian-Territories region centroids), and broadened the CENTCOM
GDELT query with those actors/place terms.

**Invariants held:** Israel has been in the CENTCOM AOR since 2021, so this is the
correct theater. Coordinates are verified (gazetteer discipline — no unverified coords).
Attribution stays neutral: contested/unclaimed resolves to `unknown` (DATA-4); nothing
here defaults affiliation to hostile/friendly.

## 2026-09-15 — Mapbox is the mapping stack

**Decision (Xavier):** Use Mapbox (Mapbox GL JS + Mapbox tiles/styles) for the theater view.

**This amends the spec:** Product Spec v0.1 NFR-4 required a self-hosted basemap from
versioned public vector data with "no dependency on a commercial tile service that can
revoke access," and NFR-5 requires functioning behind restrictive government networks
with no required third-party CDN. Mapbox GL JS pulls tiles, styles, fonts, and sprites
from `api.mapbox.com` and requires an access token, so both requirements are waived for
now rather than met.

**Mitigations / re-entry paths if a gov deployment forces it later:**
- Keep the map component thin and style-JSON-driven so the tile source is swappable.
- Mapbox Atlas is Mapbox's self-hosted/on-prem offering — the sanctioned path to
  NFR-4/NFR-5 compliance without changing APIs.
- milsymbol-based symbol rendering is renderer-agnostic (works with Mapbox GL and
  MapLibre), so symbology carries over regardless of engine.
- Exports (the briefable sheet) must NOT depend on Mapbox rasters if avoidable —
  vector export (NFR-2) should render from our own event/geometry data so the sheet
  stays reproducible (AUTO-10) even if the basemap provider changes.

**Symbology authority:** MIL-STD-2525E w/Change 1 (docs/symbology/) — see
docs/symbology/README.md for the distilled rendering rules and the event→SIDC mapping.

## 2026-09-15 — Infrastructure wiring (Phase 1)

- **Supabase** project `intel-os` (ref `huhrdcxvdgmuvdgwymdj`, us-east-1, runnon org).
  Schema in `supabase/migrations/`. Public read via RLS; writes only through the
  service role (worker). DB password in `~/.intel-os-db-pass` on the deploy operator's machine —
  not in the repo.
- **Railway** project `intel-os` → service `worker`, cron `0 */12 * * *`
  (`railway.json`), running `npm start -w worker`. Env: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY, AOR=CENTCOM. **ANTHROPIC_API_KEY still needed** for
  live extraction — until set, scheduled runs fail cleanly and are recorded in
  `ingest_runs` (AUTO-9), publishing nothing.
- **Web** runs on Vercel (not yet linked). Needs NEXT_PUBLIC_MAPBOX_TOKEN.
- **Model choice**: extraction uses `claude-opus-4-8` (structured outputs via
  `output_config.format`). Revisit for cost once volume is known.

## 2026-09-15 — Mapbox reverted; MapLibre + open tiles; NIPRNet is a standing constraint

- The 2026-09-15 Mapbox amendment is **reverted**. NFR-4/NFR-5 are back in force:
  renderer is **MapLibre GL (BSD)**, basemap is OpenStreetMap-derived vector tiles.
  Interim tile host is OpenFreeMap (`NEXT_PUBLIC_BASEMAP_STYLE_URL` overrides it);
  full self-hosting via Protomaps/OpenMapTiles is the deployment path for restricted
  networks. No tokens anywhere.
- **Pin maplibre-gl to v5.x.** v6.10.0 has a worker wedge under this stack (worker
  receives messages, never replies → style never loads, nothing renders). v5.24.0
  verified working.
- **NIPRNet/DoD-network compatibility is a standing constraint** on all future work —
  encoded in AGENTS.md, which agents must check on every change.
- UI restyled to the Nous-portal-inspired system (navy #000057, Oswald display,
  Space Grotesk UI, gold accents) — third and final restyle; tokens documented in
  AGENTS.md §Style.

## 2026-09-15 — Model backend: Amazon Bedrock (AWS credits)

Extraction + analyst chat run Claude on Amazon Bedrock using the existing AWS
account (IAM user BedrockAPIKey-sfie, us-east-1) instead of a direct Anthropic
API key — burns AWS credits. Entitlement tested empirically: Sonnet 4.6 and
Opus 4.5 invocable via classic runtime inference profiles; Opus 4.7/4.8 and
Mantle surface denied. Selected `us.anthropic.claude-sonnet-4-6` (newest
entitled generation; structured outputs verified working). Backend switch lives
in worker/src/model.ts + web/lib/model.ts. First live ingest published
SU-CEN-26-003: 53 articles → 12 events, attribution discipline and unplotted-
below-threshold behavior confirmed on real data.

## 2026-09-15 — All six combatant commands live; source catalog expanded

Ingest expanded from CENTCOM-only to all six AORs per cron cycle (single worker
run loops `configuredAors`, sequential so one theater's failure can't block
another's issue — AUTO-9 stays per-AOR). Each AOR gets:

- a **curated gazetteer** (`GAZETTEERS[aor]`, packages/core) — hand-verified
  cities, bases, chokepoints, conflict regions, country-centroid fallbacks;
  uncurated places stay unplotted (AUTO-3 unchanged);
- a **regional feed set** on top of a shared catalog. Shared: Al Jazeera, BBC
  World, UN News, Defense.gov releases, Defense One, gCaptain, Naval News.
  Regional: BBC desk feeds (Middle East/Europe/Asia/Africa/US&Canada/LatAm),
  France 24 Africa/Americas;
- a **per-AOR GDELT DOC query** sweeping thousands of outlets (429s handled
  with enforced request spacing + one retry).

All feeds are direct public HTTPS/RSS — no API keys, no third-party revocable
services, NIPRNet-compatible. Cadence stays `0 */12 * * *` (user confirmed the
12-hour cycle). Feed catalog additions verified live: every outlet resolved on
first smoke test except Defense One (fast-xml-parser entity-expansion limit —
fixed by disabling entity processing and decoding common entities manually).

## 2026-09-16 — Ingest scheduler moved to GitHub Actions (Railway cron unreliable)

Investigation (prompted by "is the 12h cron running?") found Railway's
`deploy.cronSchedule` was NOT firing: across a 14-hour window spanning the
12:00 UTC slot, zero issues were published — every sweep to date was triggered
by a `railway up`/redeploy, never by the schedule. The active deployment's
serviceManifest showed `cronSchedule: null` despite railway.json setting it, so
Railway's config-as-code cron never registered on the service.

Fix: `.github/workflows/ingest-cron.yml` runs every 12h (00:17 / 12:17 UTC) and
`railway redeploy --service worker`, which re-runs the one-shot worker (all six
AORs). GitHub Actions cron is durable and needs no Claude session. Requires one
repo secret: RAILWAY_TOKEN (project token, intel-os production). The railway.json
cronSchedule is left in place as a harmless backup (dedup makes any double-run a
no-op). A session-scoped Claude check (twice daily) independently verifies issue
freshness and redeploys if stale, until the GitHub Action is confirmed firing.

## 2026-09-16 (update) — Root cause fixed: cron set via Railway dashboard

The scheduled cron never fired because Railway's config-as-code
`deploy.cronSchedule` (railway.json) did NOT register on the service — the
dashboard Cron Schedule field was empty ("Add Schedule"), and the deployment's
serviceManifest.deploy.cronSchedule read null. Fix applied directly in the
Railway dashboard (worker → Settings → Deploy → Cron Schedule = `0 */12 * * *`);
serviceManifest.deploy.cronSchedule now reports "0 */12 * * *" and the service
shows the next scheduled run. This is the actual fix — no external scheduler
needed. The GitHub Actions workflow added earlier as a durable fallback was
removed (it required a RAILWAY_TOKEN secret and would only have added redundant
runs). The session-scoped Claude check remains as an independent verifier that
the scheduled run keeps firing.

## 2026-09-16 — Linear infrastructure uses bundled public-source geometry

- Straight endpoint-to-endpoint overlays were rejected because maritime lines
  could cross land and coarse pipeline lines overstated their precision.
- Maritime corridors are now precomputed from the Eurostat SeaRoute 5 km
  network (ORNL Global Shipping Lane Network plus AIS-derived links). They are
  representative traffic corridors, not live vessel tracks or navigation data.
- CENTCOM oil-pipeline geometry comes from Global Energy Monitor's June 2026
  Global Oil Infrastructure Tracker release and is simplified only for display.
  Older public-reference pipeline alignments in other AORs remain explicitly
  marked approximate until equivalent open GIS geometry is reviewed.
- Coordinates and provenance ship in `packages/core`; the browser performs no
  route-service call. This preserves NFR-4/NFR-5 and makes published/exported
  map geometry reproducible.

## 2026-09-17 — Social-media velocity layer with a news-corroboration gate

Added an optional, free, open-source social-media ingest layer as an early-warning
signal — never an authority. The invariant: an event carried ONLY by social
sources is stored as an unconfirmed lead but NEVER appears in a published issue
until a non-social (news/official) source reports the same incident
(`isCorroborated` in core; the gate is applied in `worker/src/pipeline.ts`,
which stores everything but publishes only corroborated events). Cross-cycle
corroboration works because leads persist in storage and later dedup-merge with a
news event's sources.

Sources (`worker/src/social.ts`), all free and opt-in via env vars (blank =
disabled, so the NIPRNet build is unaffected — interim/swappable pattern):
- Telegram — GramJS over the official MTProto API (free api_id/api_hash +
  StringSession), reads configured public channels.
- Bluesky — open AT Protocol public API via @atproto/api (free app password),
  per-AOR keyword search (an API call, not scraping).
- Mastodon — plain hashtag RSS, no credentials, on by default.

Apify (paid SaaS) and self-hosted X scrapers were rejected: X killed clean
open-source access, so X scraping means either a paid managed service or fragile
account-based scrapers that violate ToS. Telegram + Bluesky give higher real-time
OSINT value on genuinely open, free APIs. X can be added later behind the same
corroboration gate if needed.

## 2026-09-17 — Analyst subscription (Stripe) + Supabase Auth paywall

Introduced the first paid tier: **Analyst, $20/mo or $190/yr**, gating the analyst
drafting workspace (`/analyst`). Situation updates and the map stay free and public —
the free/paid line follows the product's own architecture (AUTO-5 commodity situation
data free; the drafting/assessment surface paid).

Decisions:
- **Auth:** added Supabase Auth (email magic-link) via `@supabase/ssr` — first auth in
  the product. Self-hostable, no third-party CDN (NFR-4/5 safe). Prereq for a paywall,
  since gating requires knowing who is subscribed.
- **Payments:** existing shared Stripe account `acct_1SSUvpPzSHwImUes` (same account as
  the other product). Isolated by `metadata app=intel-os` + a dedicated webhook; the
  webhook ignores any event not tagged intel-os. Reviewed runnon's Stripe integration
  first — it uses Supabase Edge Functions only because it's a server-less CRA; intel-os
  is Next.js, so Stripe lives in `web/app/api/stripe/*` route handlers (same principle:
  server-side only, key never in the client).
- **Hosted Checkout** (redirect to checkout.stripe.com), not embedded — zero Stripe JS
  in the app bundle, keeping the deployed surface CDN-free (NFR-4/5).
- **Entitlement writes without a service-role key in Vercel:** the webhook writes via a
  `SECURITY DEFINER` `grant_entitlement()` RPC that self-authorizes against a shared
  secret in a private, RLS-locked `entitlement_admin` table. Honors the AGENTS.md rule
  that the service-role key lives only in the worker.

Re-entry path: for the eventual gov/NIPRNet deployment, billing is out of scope — that
build is license/contract-gated with no Stripe surface at all. Setup: docs/STRIPE_SETUP.md.
