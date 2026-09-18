import { describe, expect, it } from 'vitest';
import { applyView, decodeView, DEFAULT_VIEW, encodeView, enforceAccessWindow, type FilterableEvent } from '../lib/urlState';

const CUTOFF = '2026-09-15T12:00:00Z';

function ev(overrides: Partial<FilterableEvent>): FilterableEvent {
  return {
    id: Math.random().toString(36).slice(2),
    occurredAt: '2026-09-15T06:00:00Z',
    affiliation: 'hostile',
    category: 'strike',
    usForcesFlag: false,
    confOrigin: 'high',
    ...overrides,
  };
}

describe('view state URL round-trip (UX-2)', () => {
  it('encodes and decodes all fields', () => {
    const v = {
      windowHours: 72,
      affiliations: ['hostile', 'unknown'] as const,
      categories: ['strike'] as const,
      usOnly: true,
      confidenceFloor: 'moderate' as const,
      selectedEvent: 'abc-123',
    };
    const decoded = decodeView(encodeView(v as any));
    expect(decoded).toEqual(v);
  });

  it('default view produces an empty query string', () => {
    expect(encodeView(DEFAULT_VIEW).toString()).toBe('');
  });

  it('rejects garbage values instead of crashing', () => {
    const p = new URLSearchParams('w=abc&aff=zombie,hostile&cat=nope&conf=extreme');
    const v = decodeView(p);
    expect(v.windowHours).toBeNull();
    expect(v.affiliations).toEqual(['hostile']);
    expect(v.categories).toEqual([]);
    expect(v.confidenceFloor).toBe('low');
  });

  it('clamps archive windows for public viewers without changing Analyst views', () => {
    expect(enforceAccessWindow({ ...DEFAULT_VIEW, windowHours: null, selectedEvent: 'old' }, false))
      .toMatchObject({ windowHours: 72, selectedEvent: null });
    expect(enforceAccessWindow({ ...DEFAULT_VIEW, windowHours: 168 }, false).windowHours).toBe(72);
    expect(enforceAccessWindow({ ...DEFAULT_VIEW, windowHours: 168 }, true).windowHours).toBe(168);
  });
});

describe('applyView (UX-1: one state drives everything)', () => {
  it('time window anchors to the info cut-off, not wall clock (UX-4)', () => {
    const inside = ev({ id: 'in', occurredAt: '2026-09-13T00:00:00Z' }); // 60h before cutoff
    const outside = ev({ id: 'out', occurredAt: '2026-09-10T00:00:00Z' }); // 132h before
    const after = ev({ id: 'after', occurredAt: '2026-09-16T00:00:00Z' }); // after cutoff
    const out = applyView([inside, outside, after], { ...DEFAULT_VIEW, windowHours: 72 }, CUTOFF);
    expect(out.map((e) => e.id)).toEqual(['in']);
  });

  it('affiliation, category, US and confidence filters compose', () => {
    const a = ev({ id: 'a', affiliation: 'hostile', usForcesFlag: true, confOrigin: 'high' });
    const b = ev({ id: 'b', affiliation: 'friendly', usForcesFlag: true, confOrigin: 'high' });
    const c = ev({ id: 'c', affiliation: 'hostile', usForcesFlag: false, confOrigin: 'high' });
    const d = ev({ id: 'd', affiliation: 'hostile', usForcesFlag: true, confOrigin: 'low' });
    const out = applyView([a, b, c, d], {
      ...DEFAULT_VIEW,
      affiliations: ['hostile'],
      usOnly: true,
      confidenceFloor: 'moderate',
    }, CUTOFF);
    expect(out.map((e) => e.id)).toEqual(['a']);
  });

  it('empty filter lists mean "all" not "none"', () => {
    const out = applyView([ev({}), ev({ affiliation: 'neutral' })], DEFAULT_VIEW, CUTOFF);
    expect(out).toHaveLength(2);
  });
});
