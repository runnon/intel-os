import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import type { PlaceCandidate, PlaceIndex } from '@intel-os/core';
import { canonicalCountry, normPlace } from '@intel-os/core';

/**
 * GeoNames-backed place index (data: worker/data/, built by scripts/build-places.ts,
 * GeoNames CC-BY 4.0). Loaded once per worker run, lazily, and only by the worker —
 * the web bundle never carries it, and nothing is fetched at runtime (NFR-4/5).
 */

const DATA_DIR = fileURLToPath(new URL('../data', import.meta.url));

let cached: PlaceIndex | null = null;

export function loadPlaceIndex(dir = DATA_DIR): PlaceIndex {
  if (cached && dir === DATA_DIR) return cached;

  const byName = new Map<string, PlaceCandidate[]>();
  const text = gunzipSync(readFileSync(join(dir, 'places.tsv.gz'))).toString('utf8');
  for (const line of text.split('\n')) {
    if (!line) continue;
    const [lat, lon, cc, kind, importance, names] = line.split('\t');
    if (!names) continue;
    const allNames = names.split('|');
    const cand: PlaceCandidate = {
      name: allNames[0] ?? '',
      lat: Number(lat),
      lon: Number(lon),
      countryCode: cc || null,
      kind: kind as PlaceCandidate['kind'],
      importance: Number(importance) || 0,
    };
    const keys = new Set(allNames.map(normPlace).filter(Boolean));
    for (const k of keys) {
      const list = byName.get(k);
      if (list) list.push(cand);
      else byName.set(k, [cand]);
    }
  }

  const codes = new Map<string, string>();
  for (const line of readFileSync(join(dir, 'countries.tsv'), 'utf8').split('\n')) {
    const [iso, name] = line.split('\t');
    if (iso && name) codes.set(canonicalCountry(name), iso);
  }
  // The curated gazetteers' own spellings that GeoNames names differently.
  const extra: Record<string, string> = {
    'palestinian territories': 'PS',
    'west bank': 'PS',
    'gaza': 'PS',
    'gaza strip': 'PS',
    'uae': 'AE',
    'democratic republic of the congo': 'CD',
    'republic of the congo': 'CG',
    'ivory coast': 'CI',
    'cote d ivoire': 'CI',
    'czechia': 'CZ',
    'turkey': 'TR',
    'macedonia': 'MK',
    'myanmar': 'MM',
    'eswatini': 'SZ',
    'cape verde': 'CV',
    'east timor': 'TL',
    'vatican': 'VA',
    'bahamas': 'BS',
    'gambia': 'GM',
  };
  for (const [name, iso] of Object.entries(extra)) codes.set(name, iso);

  const index: PlaceIndex = {
    lookup: (key) => byName.get(key) ?? [],
    countryCode: (country) => codes.get(canonicalCountry(country)) ?? null,
  };
  if (dir === DATA_DIR) cached = index;
  return index;
}
