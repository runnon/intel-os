# Agent instructions for intel-os / Theater Picture

Standing instructions for Claude (and any coding agent) working in this repository.
Run the checklist below before considering ANY change done. These encode the product's
non-negotiables; the human maintainer should not have to re-check them.

## What this project is

An open-source (MIT) situational-awareness system: unattended 12-hour OSINT ingest →
immutable, serial-addressable situation updates → public MapLibre theater view with
MIL-STD-2525E symbology. Live: https://intel-os-self.vercel.app. Governance is plain
GitHub (issues/PRs). Requirement IDs (AUTO-*, DATA-*, UX-*, ANL-*, GEO-*, MARK-*,
NFR-*) come from the product spec; the conformance map is in README.md.

## STANDING CONSTRAINT: DoD-network compatibility (NIPRNet)

Every change must keep the product deployable on restricted US government networks.
Concretely, always verify:

- **No new third-party CDN, tile, font, or script dependency** that a DoD network
  filter could block or a vendor could revoke (NFR-4/NFR-5). Anything fetched at
  runtime must be self-hostable; if an interim hosted service is used (e.g.
  OpenFreeMap tiles), it must be swappable via a single env var and documented in
  docs/DECISIONS.md.
- **No Mapbox / Google Maps / token-gated map services.** MapLibre + OSM-derived
  vector tiles only (this was decided, reverted once, and re-decided — see
  docs/DECISIONS.md; do not reintroduce).
- **Standard ports and plain HTTPS only.** No websockets-required features, no
  unusual ports.
- **Data stays IL2-clean:** publicly available information only, no CUI, no fields
  capable of holding classified material (MARK-4).

## Product invariants — check on every change

1. **AUTO-5:** the automated situation-update path must never gain judgement,
   assessment, prediction, or key-judgement content in any form. Grep new code and
   prompts for assessment language leaking into the unattended path.
2. **MARK-4:** every ingest source must pass `assertPublicSource`. No private hosts,
   no file paths, no authenticated feeds.
3. **DATA-2/AUTO-3:** never plot un-validated coordinates; below the confidence
   threshold events list without a position. Never "fix" this by lowering the
   threshold without a maintainer decision.
4. **DATA-4:** contested/unclaimed attribution resolves to `unknown`. Never let an
   extractor prompt or mapping default to hostile/friendly.
5. **AUTO-9:** a failed or partial ingest run publishes nothing and records the
   failure. Never add partial-publish behavior.
6. **AUTO-10:** published issues are immutable. Never add code that mutates a
   published issue row; corrections happen via new issues and event revisions (DATA-6).
7. **MARK-2/3:** the UNCLASSIFIED / open-sources / not-official banners stay on every
   page and every export. No agency seals or official-looking serials, ever.

## Verification steps (run, don't assume)

```sh
npm test              # 35+ unit tests across core/worker/web — must be green
npm run typecheck
cd web && npx next build
```

For map/UI changes: run `npx next start` and load /t/centcom in a browser; confirm
(a) basemap tiles render, (b) 2525 symbols appear with correct affiliation framing,
(c) filters round-trip through the URL, (d) the info cut-off is visible in the
masthead. The map renderer must remain **maplibre-gl v5.x** (v6.10 shipped a worker
wedge that renders nothing — see docs/DECISIONS.md before upgrading).

For ingest changes: `cd worker && npx tsx src/seed.ts` must publish an issue and a
second run must dedupe to 0 new events.

## Secrets & publication rules

- This repo is PUBLIC. Never commit: `.env*` (except `.env.example`), tokens, the two
  personal product PDFs (`Iran_Theater_Picture_ANSI-D_3.pdf`,
  `Theater_Picture_Product_Spec_v0.1.pdf` — excluded pending ethics clearance, see
  gitignore), or the `research/` folder (internal strategy).
- Supabase anon key and URL are public by design (RLS enforces read-only); the
  service-role key must only ever live in Railway/worker env.

## Style

UI follows the Nous-portal-inspired system: deep navy `#000057` canvas, `#f2f2f2`
text, white/20 borders on transparent cards, gold `#e3b341` accents, Oswald
(`--font-display`, class `.headline`) for display type, Space Grotesk (`--font-ui`)
for UI text, monospace for data/timestamps (Zulu format). Affiliation colors are
MIL-STD-2525 semantics — never restyle them. Marking banners stay green.

## Model backend

Extraction and analyst drafting run on **Amazon Bedrock** by default (AWS credits):
`MODEL_BACKEND=bedrock`, model `us.anthropic.claude-sonnet-4-6` via the classic
Bedrock runtime (`AnthropicBedrock` client). This account is NOT entitled to
Opus 4.7/4.8 or Sonnet 5 on Bedrock, nor to the Mantle surface — do not "upgrade"
the model ID without testing entitlement first (`worker/src/model.ts` is the one
place backends/models are configured; web mirrors it in `web/lib/model.ts`).
Vercel reserves AWS_* env names, so the web side uses BEDROCK_AWS_*.
`MODEL_BACKEND=anthropic` + ANTHROPIC_API_KEY switches to the Claude API direct.

## Housekeeping

- Record consequential decisions in `docs/DECISIONS.md` (what changed, why, and the
  re-entry path if it amends the spec).
- Update README's conformance map when requirement coverage changes.
- Deploys: web = `vercel deploy --prod --yes` (project intel-os, rootDirectory=web);
  worker = `railway up` (project intel-os, cron 0 */12 * * *).
