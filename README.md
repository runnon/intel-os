# Theater Picture

A web product where an intelligence professional picks a combatant command and gets a
live, filterable geospatial picture of that theater — then exports it as a doctrinally
correct, briefable sheet.

**Unclassified, open sources only, forever.** Not an official product of any government
agency. MIT licensed — see `LICENSE` and `CONTRIBUTING.md`.

**Live**: https://intel-os-self.vercel.app (CENTCOM watch, 12-hour unattended cycle)

The product spec and the hand-built proof sheet (OS-IRN-26-001) are maintained outside
this repository; the spec's requirement IDs (AUTO/DATA/UX/ANL/GEO/MARK/NFR) referenced
throughout the code are mapped in the conformance table below.

## Architecture

```
worker/   Ingest loop (Railway, cron 0 */12 * * *): public feeds (RSS + GDELT)
          → Claude extraction (reported facts only, attribution discipline)
          → dedup → gazetteer-validated geolocation → publish situation update
packages/core  Domain logic: event model, MIL-STD-2525E SIDC mapping, dedup,
          gazetteer + confidence scoring, situation-update builder, marking guards
web/      Next.js theater view (Vercel): command selector → MapLibre map with
          milsymbol 2525E symbols, synced event list, time control, URL-encoded
          filter state, per-event sourcing and confidence
supabase/ Postgres schema: events, event_sources, event_revisions, issues
          (immutable snapshots), ingest_runs. Public read via RLS; writes via
          service role only.
docs/     DECISIONS.md · symbology/ (MIL-STD-2525E w/CHG 1 + machine-readable tables)
research/ Market, NIPRNet/compliance, and 14N-workflow research reports
```

Two product types (spec §4): a **situation update** generates unattended every 12 hours
and carries *no* judgement layer in any form; an **assessment** (Phase 2) adds key
judgements, alternatives and implications, and publishes only over a named analyst's
signature. Auto-accept of drafted judgements is never built.

## Development

```sh
npm install
npm test                    # core + worker + web unit tests
npm run typecheck
npx next dev --prefix web   # or: cd web && npx next dev

# one manual ingest cycle against the linked Supabase project
cd worker && npx tsx src/index.ts     # needs .env (see .env.example) + ANTHROPIC_API_KEY
npx tsx src/seed.ts                   # deterministic seed (proof-build events, no LLM)
```

Env:

- `web/.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  
- `worker/.env` — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `AOR`

## Spec conformance map

| Requirement | Where |
|---|---|
| AUTO-1 no-change issues publish | `worker/src/pipeline.ts` |
| AUTO-2 dedup carries all sources | `packages/core/src/dedup.ts` |
| AUTO-3 low-confidence geocodes withheld | `packages/core/src/gazetteer.ts` |
| AUTO-5 no judgement sections | `packages/core/src/issue.ts` (+ tests) |
| AUTO-9 failed run publishes nothing | `worker/src/pipeline.ts` |
| AUTO-10 issues immutable/addressable | `issues.snapshot` column |
| DATA-1..6 provenance/precision/revisions | schema + core types |
| UX-1/2 one state, URL-encoded | `web/lib/urlState.ts` |
| UX-4 info cut-off always visible | theater masthead |
| UX-5 cluster / symbol degrade | `web/components/TheaterMap.tsx` |
| GEO-3/4 2525-informed framing | `packages/core/src/sidc.ts`, `web/lib/symbols.ts` |
| MARK-2/3/4 markings + public-source guard | layout banners, `assertPublicSource` |

Export (the differentiator — vector ANSI-D/tabloid sheet) is Phase 3 and not built yet.
