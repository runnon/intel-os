import { describe, expect, it } from 'vitest';
import { runIngestOnce } from '../src/pipeline';
import { codeVersion } from '../src/version';
import type { Store } from '../src/store';

function recordingStore() {
  const runs: any[] = [];
  const store: Store = {
    async loadRecentEvents() { return []; },
    async insertEvents() {},
    async mergeEventSources() {},
    async nextIssueNumber() { return 1; },
    async publishIssue() { return 'issue-1'; },
    async recordRun(run) { runs.push(run); },
  };
  return { store, runs };
}

const meta = { cycleId: 'cycle-1', codeVersion: 'abc123', sourceHealth: { ok: 9, failed: 1, failedRatio: 0.1, degraded: false, failures: [] } };

describe('run metadata (audit 2026-10-30)', () => {
  it('stamps cycle id, code version and source health on a successful run', async () => {
    const { store, runs } = recordingStore();
    const r = await runIngestOnce('CENTCOM', {
      fetchFeeds: async () => [],
      extract: async () => [],
      store,
      runMeta: meta,
      now: () => new Date('2026-10-30T12:00:00Z'),
    });
    expect(r.ok).toBe(true);
    expect(runs[0]).toMatchObject({ ok: true, ...meta });
  });

  it('stamps the same metadata on a failed run (AUTO-9 still publishes nothing)', async () => {
    const { store, runs } = recordingStore();
    const r = await runIngestOnce('CENTCOM', {
      fetchFeeds: async () => { throw new Error('feeds down'); },
      extract: async () => [],
      store,
      runMeta: meta,
    });
    expect(r.ok).toBe(false);
    expect(r.published).toBe(false);
    expect(runs[0]).toMatchObject({ ok: false, error: 'feeds down', ...meta });
  });
});

describe('codeVersion', () => {
  it('prefers the Railway git SHA', () => {
    expect(codeVersion({ RAILWAY_GIT_COMMIT_SHA: '0123456789abcdef0123' })).toBe('0123456789ab');
  });
  it('falls back to a VERSION file, then "unknown"', () => {
    // No VERSION file in the repo checkout: a laptop `railway up` reports unknown.
    expect(codeVersion({})).toBe('unknown');
  });
});
