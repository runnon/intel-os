# Decision Log

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
