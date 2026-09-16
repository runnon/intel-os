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
