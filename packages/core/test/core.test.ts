import { describe, expect, it } from 'vitest';
import {
  assertPublicSource,
  buildSituationUpdate,
  CENTCOM_GAZETTEER,
  dedupe,
  DISCLAIMER,
  eventSidc,
  FRAME,
  GEO_CONFIDENCE_THRESHOLD,
  geolocate,
  isDuplicate,
  makeSerial,
  mergeEvents,
  titleSimilarity,
  type TheaterEvent,
} from '../src/index.js';

function ev(overrides: Partial<TheaterEvent>): TheaterEvent {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    aor: 'CENTCOM',
    title: 'Missile strike on air base',
    summary: 'Ballistic missiles engaged over the base.',
    occurredAt: '2026-09-08T06:00:00Z',
    reportedAt: '2026-09-08T09:00:00Z',
    category: 'strike',
    affiliation: 'hostile',
    placeName: 'Muwaffaq Salti Air Base',
    country: 'Jordan',
    lat: 31.826,
    lon: 36.782,
    precision: 'point',
    geomValidated: true,
    geoConfidence: 0.9,
    confOrigin: 'high',
    confActor: 'moderate',
    usForcesFlag: true,
    sources: [{ url: 'https://example.com/a', outlet: 'Example' }],
    revisions: [],
    ...overrides,
  };
}

describe('sidc', () => {
  it('maps affiliation to standard identity and set 40', () => {
    const sidc = eventSidc({ affiliation: 'hostile', category: 'strike', precision: 'point' });
    expect(sidc).toHaveLength(20);
    expect(sidc.slice(0, 2)).toBe('13'); // version
    expect(sidc[3]).toBe('6'); // hostile
    expect(sidc.slice(4, 6)).toBe('40'); // activities
    expect(sidc[6]).toBe('0'); // present
    expect(sidc.slice(10, 16)).toBe('110605'); // rocket explosion (true 2525E icon)
  });

  it('region-precision events render dashed (status 1)', () => {
    const sidc = eventSidc({ affiliation: 'unknown', category: 'other', precision: 'region' });
    expect(sidc[6]).toBe('1');
    expect(sidc[3]).toBe('1'); // unknown identity
  });

  it('frame shapes follow GEO-3', () => {
    expect(FRAME.hostile).toBe('diamond');
    expect(FRAME.friendly).toBe('rectangle');
    expect(FRAME.unknown).toBe('quatrefoil');
    expect(FRAME.neutral).toBe('square');
  });
});

describe('gazetteer / geolocate (DATA-2, AUTO-3)', () => {
  it('resolves exact base names to point precision', () => {
    const r = geolocate('Muwaffaq Salti Air Base', 'Jordan');
    expect(r.validated).toBe(true);
    expect(r.precision).toBe('point');
    expect(r.lat).toBeCloseTo(31.826, 2);
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('resolves aliases with diacritics/case noise', () => {
    const r = geolocate("SANA'A", 'Yemen');
    expect(r.validated).toBe(true);
    expect(r.matchedName).toBe('Sanaa');
  });

  it('country centroids resolve as region precision', () => {
    const r = geolocate('Iran');
    expect(r.precision).toBe('region');
    expect(r.validated).toBe(true);
  });

  it('never invents coordinates for unknown places', () => {
    const r = geolocate('Definitely Nonexistent Village XYZ');
    expect(r.validated).toBe(false);
    expect(r.lat).toBeNull();
    expect(r.lon).toBeNull();
    expect(r.confidence).toBeLessThan(GEO_CONFIDENCE_THRESHOLD);
  });

  it('conflicting country lowers confidence below threshold for weak matches', () => {
    const strong = geolocate('Jazan', 'Saudi Arabia');
    expect(strong.validated).toBe(true);
    const weak = geolocate('near the Jazan area border crossing', 'Iran');
    expect(weak.confidence).toBeLessThan(strong.confidence);
  });

  it('gazetteer has no duplicate normalized names', () => {
    const names = CENTCOM_GAZETTEER.map((g) => g.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('dedup (AUTO-2)', () => {
  it('detects same incident across outlets and merges sources', () => {
    const a = ev({ id: 'a', title: 'Iranian missiles strike Muwaffaq Salti air base' });
    const b = ev({
      id: 'b',
      title: 'Missile attack hits Muwaffaq Salti base in Jordan',
      sources: [{ url: 'https://other.com/b', outlet: 'Other' }],
    });
    expect(isDuplicate(a, b)).toBe(true);
    const merged = mergeEvents(a, b);
    expect(merged.sources).toHaveLength(2);
    expect(merged.id).toBe('a');
  });

  it('does not merge different places', () => {
    const a = ev({ id: 'a' });
    const b = ev({ id: 'b', placeName: 'NSA Bahrain', lat: 26.21, lon: 50.61 });
    expect(isDuplicate(a, b)).toBe(false);
  });

  it('does not merge events far apart in time', () => {
    const a = ev({ id: 'a' });
    const b = ev({ id: 'b', occurredAt: '2026-09-12T06:00:00Z' });
    expect(isDuplicate(a, b)).toBe(false);
  });

  it('dedupes a batch against existing events', () => {
    const existing = [ev({ id: 'x1', title: 'Missiles strike Muwaffaq Salti air base' })];
    const candidates = [
      ev({ id: 'c1', title: 'Muwaffaq Salti air base struck by missiles', sources: [{ url: 'https://n.com/1', outlet: 'N' }] }),
      ev({ id: 'c2', placeName: 'NSA Bahrain', lat: 26.21, lon: 50.61, title: 'Drones damage NSA Bahrain piers', category: 'infrastructure' }),
    ];
    const { fresh, merged } = dedupe(candidates, existing);
    expect(fresh.map((e) => e.id)).toEqual(['c2']);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.sources).toHaveLength(2);
  });

  it('titleSimilarity is symmetric-ish and bounded', () => {
    const s = titleSimilarity('missile strike on base', 'strike on the base by missiles');
    expect(s).toBeGreaterThan(0.5);
    expect(s).toBeLessThanOrEqual(1);
  });
});

describe('situation update builder (AUTO-1, AUTO-5, AUTO-10)', () => {
  const now = new Date('2026-09-15T12:00:00Z');
  const base = {
    aor: 'CENTCOM' as const,
    issueNumber: 14,
    windowStart: new Date('2026-09-15T00:00:00Z'),
    infoCutoff: new Date('2026-09-15T11:59:00Z'),
    now,
  };

  it('builds a serial and carries the disclaimer (MARK-2)', () => {
    const su = buildSituationUpdate({ ...base, events: [ev({ id: 'a' })], newIds: new Set(['a']), revisedIds: new Set() });
    expect(su.serial).toBe('SU-CEN-26-014');
    expect(su.disclaimer).toBe(DISCLAIMER);
    expect(su.disclaimer.toLowerCase()).toContain('not an official product');
  });

  it('publishes a coherent no-change issue (AUTO-1)', () => {
    const su = buildSituationUpdate({ ...base, events: [], newIds: new Set(), revisedIds: new Set() });
    expect(su.tempo.totalEvents).toBe(0);
    expect(su.changeLog).toHaveLength(0);
    expect(su.eventIds).toEqual([]);
  });

  it('carries no judgement layer in any form (AUTO-5)', () => {
    const su = buildSituationUpdate({ ...base, events: [ev({})], newIds: new Set(), revisedIds: new Set() });
    const keys = JSON.stringify(Object.keys(su)).toLowerCase();
    for (const banned of ['judgement', 'judgment', 'assessment', 'alternative', 'implication']) {
      expect(keys).not.toContain(banned);
    }
    expect(su.productType).toBe('situation-update');
  });

  it('counts unplotted low-confidence events in tempo (AUTO-3)', () => {
    const su = buildSituationUpdate({
      ...base,
      events: [ev({}), ev({ id: 'u', lat: null, lon: null, geomValidated: false })],
      newIds: new Set(['u']),
      revisedIds: new Set(),
    });
    expect(su.tempo.unplottedEvents).toBe(1);
    expect(su.tempo.newSinceLastIssue).toBe(1);
  });

  it('source summary flags single-source events', () => {
    const su = buildSituationUpdate({ ...base, events: [ev({})], newIds: new Set(), revisedIds: new Set() });
    expect(su.sourceSummary.singleSourceEvents).toBe(1);
    expect(su.sourceSummary.statement).toContain('publicly available');
  });

  it('serial helper pads and encodes AOR', () => {
    expect(makeSerial('CENTCOM', 3, now)).toBe('SU-CEN-26-003');
  });
});

describe('MARK-4 public-source guard', () => {
  it('accepts public https sources', () => {
    expect(() => assertPublicSource('https://www.reuters.com/world/x')).not.toThrow();
    expect(() => assertPublicSource('https://www.centcom.mil/media/press-releases/x')).not.toThrow();
  });
  it('refuses private hosts, files, and localhost', () => {
    expect(() => assertPublicSource('file:///Users/x/secret.pdf')).toThrow(/MARK-4/);
    expect(() => assertPublicSource('http://localhost:3000/doc')).toThrow(/MARK-4/);
    expect(() => assertPublicSource('http://10.1.2.3/feed')).toThrow(/MARK-4/);
    expect(() => assertPublicSource('not a url')).toThrow(/MARK-4/);
  });
});
