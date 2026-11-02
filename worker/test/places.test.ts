import { describe, expect, it } from 'vitest';
import { GAZETTEERS, geolocate } from '@intel-os/core';
import { loadPlaceIndex } from '../src/places';
import { notAfter } from '../src/extract';

describe('bundled GeoNames place index', () => {
  const index = loadPlaceIndex();

  it.each([
    ['Port Sudan', 'Sudan', 'AFRICOM', 19.6, 37.2],
    ['Pokrovsk', 'Ukraine', 'EUCOM', 48.3, 37.2],
    ['Culiacán', 'Mexico', 'NORTHCOM', 24.8, -107.4],
    ['Blantyre', 'Malawi', 'AFRICOM', -15.8, 35.0],
    ['Donetsk Oblast', 'Ukraine', 'EUCOM', 48.0, 37.7],
  ] as const)('resolves %s (%s) in %s', (place, country, aor, lat, lon) => {
    const r = geolocate(place, country, GAZETTEERS[aor], { index, aor });
    expect(r.validated).toBe(true);
    expect(r.lat!).toBeCloseTo(lat, 0);
    expect(r.lon!).toBeCloseTo(lon, 0);
  });

  it('knows the countries the extractor names', () => {
    for (const c of ['Palestinian Territories', 'Democratic Republic of the Congo', 'UAE', 'United States', 'Turkey', 'Russia']) {
      expect(index.countryCode(c), c).not.toBeNull();
    }
  });
});

describe('extraction date guard', () => {
  it('clamps a future occurredAt to the extraction time', () => {
    expect(notAfter('2026-11-09T00:00:00.000Z', '2026-10-30T12:00:00.000Z')).toBe('2026-10-30T12:00:00.000Z');
    expect(notAfter('2026-10-29T08:00:00.000Z', '2026-10-30T12:00:00.000Z')).toBe('2026-10-29T08:00:00.000Z');
  });
});
