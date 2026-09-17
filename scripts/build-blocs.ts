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

// 10m is the primary source — the highest-resolution Natural Earth admin-0 set, so the
// bloc polygons track real borders closely at theater zoom. (They are still a different
// dataset from the OSM basemap, so they are close-but-not-pixel-exact when zoomed far in.)
const NE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson';
const NE_FALLBACK_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(here, '../web/public/geo');
const CACHE = resolve(here, '../node_modules/.cache/ne_10m_admin_0_countries.geojson');
const CACHE_FALLBACK = resolve(here, '../node_modules/.cache/ne_50m_admin_0_countries.geojson');

type Pt = [number, number];
const round = (n: number) => Math.round(n * 1000) / 1000;
// Douglas-Peucker tolerance in degrees (~0.01° ≈ 1.1 km). 10m detail carries far more
// coastline vertices than a faint political wash needs; simplifying preserves the border
// SHAPE (unlike grid-rounding) while cutting file size dramatically. Endpoints (ring
// closure) are always kept.
const DP_TOL = 0.01;

function perpDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function simplify(points: Pt[], tol: number): Pt[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(points[i], points[s], points[e]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx !== -1) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out: Pt[] = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push([round(points[i][0]), round(points[i][1])]);
  return out;
}
function roundCoords(c: unknown): unknown {
  const arr = c as unknown[];
  if (Array.isArray(arr[0]) && typeof (arr[0] as unknown[])[0] === 'number') {
    return simplify(arr as Pt[], DP_TOL); // this level is a ring of [lon,lat] points
  }
  return arr.map(roundCoords);
}

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
