# Contributing to Theater Picture

Theater Picture is an open-source situational-awareness system: it ingests publicly
available information on an unattended cycle and publishes a live, filterable
geospatial picture of a theater that anyone — intelligence professionals or the
public — can read, filter, and cite.

Governance is just GitHub: open an issue to report a problem or propose a change,
open a pull request to contribute. Maintainers review and merge.

## Ground rules (these are product invariants, not preferences)

1. **Open sources only, forever.** The system refuses non-public material by design
   (`assertPublicSource`, MARK-4). PRs that add ingestion of non-public or
   access-restricted sources will not be merged.
2. **Reported facts and judgement stay separated.** The unattended situation update
   carries no analytic judgement in any form (AUTO-5). Never add machine-generated
   assessment language to the automated path.
3. **Never plot a guess.** Coordinates must validate against the gazetteer; below the
   confidence threshold, events list without a position (AUTO-3, DATA-2).
4. **Attribution discipline.** Contested or unclaimed attribution is `unknown`, never
   inferred (DATA-4).
5. **Not an official product.** No agency seals, no official-format serials, and the
   disclaimer stays on every surface and export (MARK-2/3).

## Development setup

```sh
npm install
npm test            # core + worker + web unit tests — must pass
npm run typecheck
```

- `packages/core` — domain logic (event model, MIL-STD-2525E symbology, dedup,
  gazetteer, issue builder). Pure functions; add tests alongside changes.
- `worker/` — the ingest pipeline (feeds → LLM extraction → dedup → geolocate →
  publish). `npx tsx src/seed.ts` runs a deterministic seed without an LLM key.
- `web/` — Next.js + Mapbox GL theater view. `npx next dev` after copying
  `web/.env.example` to `web/.env.local` (Supabase URL/anon key + a Mapbox token).
- `supabase/migrations/` — schema. Public read via RLS; writes are service-role only.

## Good first contributions

- **Feeds**: add public RSS/API sources to `worker/src/feeds.ts` (must pass the
  public-source guard).
- **Gazetteer**: extend `packages/core/src/gazetteer.ts` with verified entries —
  include a source for the coordinates in the PR description.
- **New AORs**: a command needs a feed list + query + gazetteer section to go live.
- **Tests**: every spec requirement in README's conformance map should stay covered.

## Pull requests

Keep PRs focused; include tests for behavior changes; `npm test` and
`npm run typecheck` must be green. By contributing you agree your contributions are
licensed under the MIT license.
