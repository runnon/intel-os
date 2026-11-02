import { describe, expect, it } from 'vitest';
import {
  AOR_COUNTRIES,
  GAZETTEERS,
  INDEX_MATCH_CONFIDENCE,
  INDEX_REGION_CONFIDENCE,
  geolocate,
  normPlace,
  type PlaceCandidate,
  type PlaceIndex,
} from '../src/index';

function fakeIndex(rows: (PlaceCandidate & { alts?: string[] })[]): PlaceIndex {
  const byName = new Map<string, PlaceCandidate[]>();
  for (const { alts = [], ...c } of rows) {
    for (const n of new Set([c.name, ...alts].map(normPlace))) byName.set(n, [...(byName.get(n) ?? []), c]);
  }
  const codes: Record<string, string> = {
    nigeria: 'NG', malawi: 'MW', ukraine: 'UA', russia: 'RU', 'united states': 'US', china: 'CN', yemen: 'YE', sudan: 'SD',
  };
  return { lookup: (k) => byName.get(k) ?? [], countryCode: (c) => codes[normPlace(c)] ?? null };
}

const town = (name: string, cc: string, lat: number, lon: number, pop: number): PlaceCandidate =>
  ({ name, countryCode: cc, lat, lon, kind: 'settlement', importance: pop });

const index = fakeIndex([
  town('Lagos', 'NG', 6.4541, 3.3947, 9_000_000),
  town('Blantyre', 'MW', -15.785, 35.0085, 800_000),
  town('Pokrovsk', 'UA', 48.28, 37.18, 60_000),
  town('Pokrovsk', 'RU', 61.48, 129.15, 9_000),
  town('Springfield', 'US', 39.8, -89.64, 114_000),
  town('Springfield', 'US', 37.21, -93.29, 169_000),
  town('Beijing', 'CN', 39.9, 116.4, 20_000_000),
  town('Kursk', 'RU', 51.73, 36.19, 440_000),
  town('Port Sudan', 'SD', 19.62, 37.22, 500_000),
  { name: 'Kurskaya Oblast', alts: ['Kursk Oblast'], countryCode: 'RU', lat: 51.68, lon: 36.1, kind: 'admin', importance: 1010 },
  { name: 'Hadramaut', countryCode: 'YE', lat: 15.9, lon: 49.0, kind: 'admin', importance: 1005 },
  { name: 'Java Sea', countryCode: null, lat: -5.5, lon: 111, kind: 'water', importance: 20 },
]);

describe('GeoNames-backed geolocation (DATA-2, AUTO-3)', () => {
  it('resolves a named town the curated list lacks, at settlement precision', () => {
    const r = geolocate('Blantyre', 'Malawi', GAZETTEERS.AFRICOM, { index, aor: 'AFRICOM' });
    expect(r).toMatchObject({ validated: true, precision: 'settlement', lat: -15.785, confidence: INDEX_MATCH_CONFIDENCE });
  });

  it('without an index, behavior is unchanged (falls to withheld / centroid)', () => {
    expect(geolocate('Blantyre', 'Malawi', GAZETTEERS.AFRICOM).validated).toBe(false);
  });

  it('a curated exact match still wins over the index', () => {
    const curated = geolocate('Lagos', 'Nigeria', GAZETTEERS.AFRICOM);
    const withIndex = geolocate('Lagos', 'Nigeria', GAZETTEERS.AFRICOM, { index, aor: 'AFRICOM' });
    expect(withIndex).toEqual(curated);
  });

  it('the reported country disambiguates same-named places', () => {
    const r = geolocate('Pokrovsk', 'Ukraine', GAZETTEERS.EUCOM, { index, aor: 'EUCOM' });
    expect(r.lat).toBeCloseTo(48.28);
  });

  it('withholds a genuinely ambiguous name rather than guess', () => {
    const r = geolocate('Springfield', 'United States', GAZETTEERS.NORTHCOM, { index, aor: 'NORTHCOM' });
    expect(r.matchedName).not.toBe('Springfield'); // falls back to the US centroid, never a guessed Springfield
    expect(r.precision).toBe('region');
  });

  it('never resolves land outside the theater, even when reported', () => {
    const r = geolocate('Beijing', 'China', GAZETTEERS.EUCOM, { index, aor: 'EUCOM' });
    expect(r.validated).toBe(false);
  });

  it('"X region" / "X Oblast" resolves to the province, not its capital', () => {
    const r = geolocate('Kursk region', 'Russia', GAZETTEERS.EUCOM, { index, aor: 'EUCOM' });
    expect(r).toMatchObject({ matchedName: 'Kurskaya Oblast', precision: 'region', confidence: INDEX_REGION_CONFIDENCE });
  });

  it('"N km from X" places the event near X, at region precision only', () => {
    const r = geolocate('30 km north of Port Sudan', 'Sudan', GAZETTEERS.AFRICOM, { index, aor: 'AFRICOM' });
    expect(r).toMatchObject({ matchedName: 'Port Sudan', precision: 'region' });
  });

  it('falls back to the reported admin1 area before the country centroid', () => {
    const r = geolocate('Some Wadi Nobody Mapped', 'Yemen', GAZETTEERS.CENTCOM, { index, aor: 'CENTCOM', admin1: 'Hadramaut' });
    expect(r).toMatchObject({ matchedName: 'Hadramaut', precision: 'region' });
  });

  it('resolves international waters with no country reported', () => {
    const r = geolocate('Java Sea', undefined, GAZETTEERS.INDOPACOM, { index, aor: 'INDOPACOM' });
    expect(r).toMatchObject({ matchedName: 'Java Sea', precision: 'region', validated: true });
  });

  it('every AOR country list is disjoint from the others', () => {
    const seen = new Map<string, string>();
    for (const [aor, codes] of Object.entries(AOR_COUNTRIES)) {
      for (const c of codes) {
        expect(seen.get(c), `${c} in ${aor} and ${seen.get(c)}`).toBeUndefined();
        seen.set(c, aor);
      }
    }
  });
});

describe('dedup with shared region-level anchors (AUTO-2)', async () => {
  const { isDuplicate } = await import('../src/index');
  const base = {
    aor: 'CENTCOM' as const, summary: '', occurredAt: '2026-10-29T08:00:00Z', reportedAt: '2026-10-29T08:00:00Z',
    affiliation: 'unknown' as const, geomValidated: true, geoConfidence: 0.6, confOrigin: 'moderate' as const,
    confActor: 'low' as const, usForcesFlag: false, revisions: [],
  };
  const roundup = { url: 'https://example.com/gulf-roundup', outlet: 'Example', title: 'Roundup', publishedAt: '2026-10-29T08:00:00Z' };
  const at = (id: string, title: string, category: 'political' | 'strike', placeName: string, extra: object = {}) => ({
    ...base, id, title, category, placeName, country: 'Saudi Arabia', lat: 23.9, lon: 45.1, precision: 'region' as const,
    sources: [roundup], ...extra,
  });

  it('does not merge two different stories from one roundup placed at the country centroid', () => {
    const a = at('a', 'US orders non-emergency diplomats to depart Saudi Arabia', 'political', 'Saudi Arabia');
    const b = at('b', 'Houthi drone attack on Saudi airport kills two', 'strike', 'Saudi Arabia');
    expect(isDuplicate(a, b)).toBe(false);
  });

  it('does not treat two region-level events near one anchor as the same place', () => {
    const a = at('a', 'Tanker fire off the coast', 'strike', 'Gulf of Oman', { sources: [{ ...roundup, url: 'https://x.example/1' }] });
    const b = at('b', 'Tanker fire off the coast', 'strike', 'Strait of Hormuz', { sources: [{ ...roundup, url: 'https://x.example/2' }] });
    expect(isDuplicate(a, b)).toBe(false);
  });

  it('still merges one article re-extracted on a later cycle at a named place', () => {
    const a = at('a', 'Drone strike on Yanbu terminal', 'strike', 'Yanbu', { precision: 'settlement', lat: 24.09, lon: 38.06 });
    const b = at('b', 'Yanbu oil terminal hit by drone', 'strike', 'Yanbu', { precision: 'settlement', lat: 24.09, lon: 38.06, occurredAt: '2026-10-30T20:00:00Z' });
    expect(isDuplicate(a, b)).toBe(true);
  });
});
