/**
 * Generate the per-AOR alliance/bloc polygon assets from public-domain Natural
 * Earth 110m boundaries joined to the curated BLOCS table (packages/core/blocs.ts).
 *
 *   npx tsx scripts/build-blocs.ts
 *
 * Writes web/public/geo/blocs-<aor>.geojson. Boundary geometry is public domain
 * (Natural Earth); the bloc assignment (blocKey/certainty/basis) is our curated
 * reference data. Re-run when the bloc table changes. No third-party runtime dep —
 * the app fetches these static, same-origin assets (NFR-4/NFR-5).
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { BLOCS } from '../packages/core/src/blocs';

// 50m is the primary source — it tracks real borders closely enough to sit on the
// OSM basemap; 110m was visibly too coarse. 10m is a fallback for any microstate 50m
// might lack.
const NE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const NE_FALLBACK_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson';
const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(here, '../web/public/geo');
const CACHE = resolve(here, '../node_modules/.cache/ne_50m_admin_0_countries.geojson');
const CACHE_FALLBACK = resolve(here, '../node_modules/.cache/ne_10m_admin_0_countries.geojson');

type Ring = number[];
// ~110 m grid: imperceptible at theater zoom, keeps files small, borders stay clean.
const round = (n: number) => Math.round(n * 1000) / 1000;
const roundCoords = (c: unknown): unknown =>
  Array.isArray((c as Ring[])[0]) ? (c as Ring[]).map(roundCoords) : [round((c as Ring)[0]), round((c as Ring)[1])];

type NeDoc = { features: { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[] };

async function loadNe(url: string, cache: string): Promise<NeDoc> {
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Natural Earth fetch failed: ${res.status}`);
  const text = await res.text();
  mkdirSync(dirname(cache), { recursive: true });
  writeFileSync(cache, text);
  return JSON.parse(text);
}

async function main() {
  const ne = await loadNe(NE_URL, CACHE);
  const byName = new Map<string, NeDoc['features'][number]>();
  for (const f of ne.features) byName.set(String(f.properties.ADMIN), f);

  // Fill any names 50m lacks from 10m, but only if needed.
  const referenced = new Set(Object.values(BLOCS).flatMap((d) => d.alignments.map((a) => a.country)));
  const needsFallback = [...referenced].some((n) => !byName.has(n));
  if (needsFallback) {
    const ne10 = await loadNe(NE_FALLBACK_URL, CACHE_FALLBACK);
    for (const f of ne10.features) {
      const name = String(f.properties.ADMIN);
      if (referenced.has(name) && !byName.has(name)) byName.set(name, f);
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const [aor, def] of Object.entries(BLOCS)) {
    const colorFor = new Map(def.blocs.map((b) => [b.key, b.color]));
    const labelFor = new Map(def.blocs.map((b) => [b.key, b.label]));
    const features: unknown[] = [];
    const missing: string[] = [];
    for (const a of def.alignments) {
      const f = byName.get(a.country);
      if (!f) {
        missing.push(a.country);
        continue;
      }
      features.push({
        type: 'Feature',
        properties: {
          name: a.country,
          blocKey: a.blocKey,
          blocLabel: labelFor.get(a.blocKey) ?? a.blocKey,
          color: colorFor.get(a.blocKey) ?? '#7d8794',
          certainty: a.certainty,
          basis: a.basis,
        },
        geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) },
      });
    }
    const out = { type: 'FeatureCollection', features };
    const path = resolve(OUT_DIR, `blocs-${aor.toLowerCase()}.geojson`);
    writeFileSync(path, JSON.stringify(out));
    const kb = (JSON.stringify(out).length / 1024).toFixed(0);
    console.log(`${aor.padEnd(10)} ${String(features.length).padStart(2)} features  ${kb}KB${missing.length ? `  MISSING: ${missing.join(', ')}` : ''}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
