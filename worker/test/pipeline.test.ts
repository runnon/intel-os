import { describe, expect, it } from 'vitest';
import type { Aor, SituationUpdate, TheaterEvent } from '@intel-os/core';
import { runIngestOnce } from '../src/pipeline';
import type { Store } from '../src/store';
import type { Article } from '../src/feeds';

function fakeEvent(overrides: Partial<TheaterEvent>): TheaterEvent {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    aor: 'CENTCOM',
    title: 'Missile strike on Muwaffaq Salti air base',
    summary: 'Ballistic missiles engaged over the base.',
    occurredAt: '2026-09-14T06:00:00Z',
    reportedAt: '2026-09-14T09:00:00Z',
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

function makeFakeStore(existing: TheaterEvent[] = []) {
  const state = {
    events: [...existing],
    issues: [] as { issue: SituationUpdate; snapshot: TheaterEvent[] }[],
    runs: [] as any[],
    merged: [] as TheaterEvent[],
  };
  const store: Store = {
    async loadRecentEvents() { return [...state.events]; },
    async insertEvents(evts) { state.events.push(...evts); },
    async mergeEventSources(evts) { state.merged.push(...evts); },
    async nextIssueNumber() { return state.issues.length + 1; },
    async publishIssue(issue, snapshot) {
      state.issues.push({ issue, snapshot });
      return `issue-${state.issues.length}`;
    },
    async recordRun(run) { state.runs.push(run); },
  };
  return { store, state };
}

const articles: Article[] = [
  { title: 'a', url: 'https://n.com/1', outlet: 'N', publishedAt: '2026-09-15T01:00:00Z', summary: '' },
];

describe('runIngestOnce', () => {
  it('publishes an issue with new events (happy path)', async () => {
    const { store, state } = makeFakeStore();
    const candidate = fakeEvent({ id: 'c1' });
    const result = await runIngestOnce('CENTCOM' as Aor, {
      fetchFeeds: async () => articles,
      extract: async () => [candidate],
      store,
      now: () => new Date('2026-09-15T12:00:00Z'),
    });
    expect(result.ok).toBe(true);
    expect(result.published).toBe(true);
    expect(state.issues).toHaveLength(1);
    const { issue, snapshot } = state.issues[0]!;
    expect(issue.serial).toBe('SU-CEN-26-001');
    expect(issue.tempo.newSinceLastIssue).toBe(1);
    expect(snapshot).toHaveLength(1);
    expect(state.runs[0].ok).toBe(true);
  });

  it('AUTO-1: publishes a no-change issue when nothing new is found', async () => {
    const existing = [fakeEvent({ id: 'e1' })];
    const { store, state } = makeFakeStore(existing);
    const result = await runIngestOnce('CENTCOM' as Aor, {
      fetchFeeds: async () => [],
      extract: async () => [],
      store,
      now: () => new Date('2026-09-15T12:00:00Z'),
    });
    expect(result.ok).toBe(true);
    expect(result.published).toBe(true);
    expect(state.issues).toHaveLength(1);
    expect(state.issues[0]!.issue.tempo.newSinceLastIssue).toBe(0);
    expect(state.issues[0]!.issue.tempo.totalEvents).toBe(1); // window still shown
  });

  it('AUTO-2: duplicate of existing event merges instead of inserting', async () => {
    const existing = [fakeEvent({ id: 'e1' })];
    const { store, state } = makeFakeStore(existing);
    const dup = fakeEvent({
      id: 'c-dup',
      title: 'Muwaffaq Salti base struck by missiles',
      sources: [{ url: 'https://other.com/x', outlet: 'Other' }],
    });
    const result = await runIngestOnce('CENTCOM' as Aor, {
      fetchFeeds: async () => articles,
      extract: async () => [dup],
      store,
      now: () => new Date('2026-09-15T12:00:00Z'),
    });
    expect(result.ok).toBe(true);
    expect(result.deduped).toBe(1);
    expect(state.events).toHaveLength(1); // no new row
    expect(state.merged).toHaveLength(1);
    expect(state.merged[0]!.sources).toHaveLength(2); // carries both sources
    // the issue snapshot uses the merged version
    expect(state.issues[0]!.snapshot[0]!.sources).toHaveLength(2);
  });

  it('AUTO-9: failed extraction publishes nothing and records the failed run', async () => {
    const { store, state } = makeFakeStore();
    const result = await runIngestOnce('CENTCOM' as Aor, {
      fetchFeeds: async () => articles,
      extract: async () => { throw new Error('model unavailable'); },
      store,
    });
    expect(result.ok).toBe(false);
    expect(result.published).toBe(false);
    expect(state.issues).toHaveLength(0);
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0].ok).toBe(false);
    expect(state.runs[0].error).toContain('model unavailable');
  });

  it('AUTO-9: feed failure publishes nothing', async () => {
    const { store, state } = makeFakeStore();
    const result = await runIngestOnce('CENTCOM' as Aor, {
      fetchFeeds: async () => { throw new Error('all feeds failed'); },
      extract: async () => [],
      store,
    });
    expect(result.ok).toBe(false);
    expect(state.issues).toHaveLength(0);
  });

  it('AUTO-5: published issue carries no judgement sections', async () => {
    const { store, state } = makeFakeStore();
    await runIngestOnce('CENTCOM' as Aor, {
      fetchFeeds: async () => articles,
      extract: async () => [fakeEvent({ id: 'c1' })],
      store,
      now: () => new Date('2026-09-15T12:00:00Z'),
    });
    const keys = JSON.stringify(Object.keys(state.issues[0]!.issue)).toLowerCase();
    for (const banned of ['judgement', 'judgment', 'assessment', 'alternative', 'implication']) {
      expect(keys).not.toContain(banned);
    }
  });

  it('issue numbers increment per run (AUTO-10 addressability)', async () => {
    const { store, state } = makeFakeStore();
    const deps = {
      fetchFeeds: async () => [] as Article[],
      extract: async () => [] as TheaterEvent[],
      store,
      now: () => new Date('2026-09-15T12:00:00Z'),
    };
    await runIngestOnce('CENTCOM' as Aor, deps);
    await runIngestOnce('CENTCOM' as Aor, deps);
    expect(state.issues.map((i) => i.issue.serial)).toEqual(['SU-CEN-26-001', 'SU-CEN-26-002']);
  });
});
