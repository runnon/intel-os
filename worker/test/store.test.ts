import { describe, expect, it, vi } from 'vitest';

// A minimal chainable stand-in for the Supabase query builder: records every `.in()`
// list and `.range()` call, and answers from in-memory tables.
const calls = { inSizes: [] as number[], ranges: [] as [number, number][] };
const tables: Record<string, any[]> = { events: [], event_sources: [] };

function query(table: string) {
  let rows = [...tables[table]];
  let range: [number, number] | null = null;
  const q: any = {
    select: () => q,
    eq: (col: string, v: unknown) => { rows = rows.filter((r) => r[col] === v); return q; },
    gte: (col: string, v: string) => { rows = rows.filter((r) => r[col] >= v); return q; },
    order: () => q,
    in: (col: string, vs: string[]) => {
      calls.inSizes.push(vs.length);
      rows = rows.filter((r) => vs.includes(r[col]));
      return q;
    },
    range: (from: number, to: number) => { calls.ranges.push([from, to]); range = [from, to]; return q; },
    then: (resolve: (v: unknown) => void) =>
      resolve({ data: range ? rows.slice(range[0], range[1] + 1) : rows, error: null }),
  };
  return q;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (t: string) => query(t) }),
}));

const { chunk, uniqueSourceRows, sanitizeText, makeSupabaseStore, ID_QUERY_CHUNK_SIZE, DB_PAGE_SIZE } =
  await import('../src/store');

describe('chunk', () => {
  it('splits into fixed-size pieces and keeps every item', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
  });
});

describe('uniqueSourceRows', () => {
  it('keeps one row per (event_id, url) so one upsert never touches a row twice', () => {
    const rows = uniqueSourceRows([
      { event_id: 'e1', url: 'u', outlet: 'A', title: 'first', published_at: '2026-10-01' },
      { event_id: 'e1', url: 'u', outlet: 'A', title: null, published_at: null },
      { event_id: 'e2', url: 'u', outlet: 'A', title: null, published_at: null },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.event_id === 'e1')).toMatchObject({ title: 'first', published_at: '2026-10-01' });
  });
});

describe('sanitizeText', () => {
  it('drops NUL and lone surrogates that Postgres JSON rejects, deeply', () => {
    const out = sanitizeText({ a: 'x\u0000y', b: ['ok\uD83D'], c: 3, d: null, e: 'emoji 😀 kept' });
    expect(out).toEqual({ a: 'xy', b: ['ok'], c: 3, d: null, e: 'emoji 😀 kept' });
  });
});

describe('loadRecentEvents', () => {
  it('never puts more than ID_QUERY_CHUNK_SIZE ids in one .in() and pages past max_rows', async () => {
    const n = DB_PAGE_SIZE + 250; // EUCOM's 30-day window reached ~500; go well past both limits
    tables.events = Array.from({ length: n }, (_, i) => ({
      id: `id-${i}`, aor: 'EUCOM', occurred_at: '2026-10-20T00:00:00Z',
    }));
    tables.event_sources = tables.events.map((e) => ({ event_id: e.id, url: `https://x/${e.id}`, outlet: 'X' }));
    calls.inSizes = []; calls.ranges = [];

    const store = makeSupabaseStore('https://example.supabase.co', 'key');
    const events = await store.loadRecentEvents('EUCOM', '2026-10-01T00:00:00Z');

    expect(events).toHaveLength(n);
    expect(events.every((e) => e.sources.length === 1)).toBe(true);
    expect(Math.max(...calls.inSizes)).toBeLessThanOrEqual(ID_QUERY_CHUNK_SIZE);
    expect(calls.ranges.length).toBe(2);
  });
});
