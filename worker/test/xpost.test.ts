import { describe, expect, it, vi } from 'vitest';
import type { TheaterEvent } from '@intel-os/core';
import {
  DISCLAIMER, MAX_POST_WEIGHT, composeThread, dtg, oauth1Header, postThread, runXPost,
  selectHighlights, weightedLength, type XPostStore,
} from '../src/xpost';

const NOW = new Date('2026-10-30T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

// Each fixture gets its own story and source unless a test says otherwise, so the
// same-story rule only folds events a test means to be one story.
const STORIES = ['Drone strike reported on fuel depot', 'Navy intercepts cruise missile over sea lane',
  'Border clash leaves soldiers wounded', 'Militia seizes airport terminal', 'Warship transits contested strait',
  'Pipeline explosion halts exports', 'Rocket barrage targets garrison town'];
let fixture = 0;
function ev(over: Partial<TheaterEvent> = {}): TheaterEvent {
  const n = fixture++;
  return {
    id: over.id ?? `ev${n}`,
    aor: 'CENTCOM', title: STORIES[n % STORIES.length] + ` ${n}`, summary: '',
    occurredAt: hoursAgo(3), reportedAt: hoursAgo(2), category: 'strike', affiliation: 'unknown',
    placeName: 'Taiz', country: 'Yemen', lat: 13.58, lon: 44.02, precision: 'settlement',
    geomValidated: true, geoConfidence: 0.95, confOrigin: 'moderate', confActor: 'low',
    usForcesFlag: false, sources: [{ url: `https://news.example/${n}`, outlet: 'Reuters' }], revisions: [],
    ...over,
  };
}

const urls = (s: string) => s.match(/https?:\/\/\S+/g) ?? [];

describe('weightedLength', () => {
  it('counts a URL as 23 and wide characters as 2', () => {
    expect(weightedLength('abc')).toBe(3);
    expect(weightedLength('see https://intel-os.org/t/centcom?utm_source=x')).toBe(4 + 23);
    expect(weightedLength('台湾')).toBe(4);
  });
});

describe('dtg', () => {
  it('formats a Zulu date-time group', () => {
    expect(dtg(NOW)).toBe('301200ZOCT26');
    expect(dtg(new Date('2027-01-05T03:07:00Z'))).toBe('050307ZJAN27');
  });
});

describe('oauth1Header', () => {
  it("matches X's published signing example", () => {
    const header = oauth1Header(
      'POST', 'https://api.twitter.com/1.1/statuses/update.json?include_entities=true',
      {
        apiKey: 'xvz1evFS4wEEPTGEFPHBog', apiSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
        accessToken: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
        accessSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
      },
      { status: 'Hello Ladies + Gentlemen, a signed OAuth request!' },
      'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg', '1318622958',
    );
    expect(header).toContain('oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"');
  });
});

describe('selectHighlights', () => {
  it('drops social-only, stale, future and already-posted events', () => {
    const keep = ev({ id: 'keep' });
    const picked = selectHighlights([
      keep,
      ev({ id: 'social', sources: [{ url: 'https://t.me/x/1', outlet: 'Telegram', social: true }] }),
      ev({ id: 'stale', reportedAt: hoursAgo(30) }),
      ev({ id: 'future', reportedAt: hoursAgo(-1) }),
      ev({ id: 'posted' }),
    ], new Set(['posted']), NOW);
    expect(picked.map((e) => e.id)).toEqual(['keep']);
  });

  it('covers each command before taking a second from one, and caps the count', () => {
    const events = [
      ev({ id: 'c1', usForcesFlag: true }), ev({ id: 'c2', usForcesFlag: true }), ev({ id: 'c3', usForcesFlag: true }),
      ev({ id: 'e1', aor: 'EUCOM' }), ev({ id: 'a1', aor: 'AFRICOM' }),
    ];
    const picked = selectHighlights(events, new Set(), NOW, 4);
    expect(picked).toHaveLength(4);
    expect(new Set(picked.map((e) => e.aor))).toEqual(new Set(['CENTCOM', 'EUCOM', 'AFRICOM']));
    expect(picked[0].usForcesFlag).toBe(true);
  });

  it('carries one story once when two commands extracted it (similar titles)', () => {
    const picked = selectHighlights([
      ev({ id: 'n', aor: 'NORTHCOM', title: 'Pentagon fires Lt. Gen. Brett Sylvia over alleged classified leaks' }),
      ev({ id: 'e', aor: 'EUCOM', title: 'Pentagon Fires Lt. General Sylvia Over Classified Leaks on Iran and Ukraine' }),
      ev({ id: 's', aor: 'SOUTHCOM', title: 'Coast Guard seizes cocaine off Colombia' }),
    ], new Set(), NOW);
    expect(picked.map((e) => e.id).sort()).toEqual(['e', 's']);
  });

  it('carries one story once when two commands cite the same report', () => {
    const shared = [{ url: 'https://news.example/shared', outlet: 'Reuters' }];
    const picked = selectHighlights([
      ev({ id: 'c', title: 'Tanker struck near port', sources: shared }),
      ev({ id: 'a', aor: 'AFRICOM', title: 'Shipping disrupted in Gulf of Aden', sources: shared }),
    ], new Set(), NOW);
    expect(picked).toHaveLength(1);
  });

  it('treats a Mastodon/Telegram/Bluesky source as social even without the flag (lost on reload)', () => {
    const picked = selectHighlights([
      ev({ id: 'm', sources: [{ url: 'https://example.org/story', outlet: 'Mastodon #OSINT' }] }),
      ev({ id: 't', aor: 'EUCOM', sources: [{ url: 'https://t.me/channel/42', outlet: 'channel' }] }),
    ], new Set(), NOW);
    expect(picked).toEqual([]);
  });

  it('never picks the same event twice when it appears in two snapshots', () => {
    const e = ev({ id: 'dup' });
    expect(selectHighlights([e, { ...e }], new Set(), NOW)).toHaveLength(1);
  });
});

describe('composeThread', () => {
  const long = 'X'.repeat(400);
  const highlights = [
    ev({ id: '1', title: long, usForcesFlag: true, usImpact: long, placeName: long, sources: Array.from({ length: 9 }, (_, i) => ({ url: `https://n/${i}`, outlet: `Outlet number ${i}` })) }),
    ev({ id: '2', aor: 'EUCOM', title: 'Missile strike on Odesa port', placeName: 'Odesa', country: 'Ukraine' }),
    ev({ id: '3', aor: 'INDOPACOM', title: '台湾海峡で演習' + long }),
    ev({ id: '4', aor: 'AFRICOM' }), ev({ id: '5', aor: 'SOUTHCOM' }),
  ];
  const thread = composeThread(highlights, NOW);

  it('is a lead plus one reply per highlight, every post within 280', () => {
    expect(thread).toHaveLength(6);
    for (const post of thread) expect(weightedLength(post)).toBeLessThanOrEqual(MAX_POST_WEIGHT);
  });

  it('puts the only link in the lead (links cost ~13x a plain post)', () => {
    expect(urls(thread[0])).toHaveLength(1);
    expect(urls(thread[0])[0]).toMatch(/^https:\/\/intel-os\.org\/\?utm_source=x&/);
    for (const reply of thread.slice(1)) expect(urls(reply)).toHaveLength(0);
  });

  it('links a single-command thread to that command', () => {
    expect(urls(composeThread([ev()], NOW)[0])[0]).toMatch(/^https:\/\/intel-os\.org\/t\/centcom\?/);
  });

  it('carries the not-official line and no classification marking (MARK-2/3)', () => {
    expect(thread[0]).toContain(DISCLAIMER);
    for (const post of thread) expect(post).not.toMatch(/UNCLASSIFIED|\(U\)|CONFIDENTIAL|SECRET/);
  });

  it('keeps the facts after the title when the title is clipped', () => {
    expect(thread[1]).toContain('Confidence: location moderate, actor low');
    expect(thread[1]).toContain('US forces involved');
    expect(thread[1]).toContain('Sources: Outlet number 0, Outlet number 1, ');
  });

  it('leads with the count, the commands and the top story', () => {
    const lead = composeThread([ev({ title: 'Missile strike on Odesa port', aor: 'EUCOM' }), ev()], NOW)[0];
    expect(lead).toContain('2 new open-source reports: EUCOM, CENTCOM');
    expect(lead).toContain('Missile strike on Odesa port');
  });

  it('never posts the extracted impact prose (AUTO-5)', () => {
    const t = composeThread([ev({ usForcesFlag: true, usImpact: 'This likely signals escalation' })], NOW);
    expect(t.join('\n')).not.toContain('likely signals');
  });

  it('composes nothing when there is nothing to post', () => {
    expect(composeThread([], NOW)).toEqual([]);
  });
});

function fakeStore(events: TheaterEvent[]) {
  const rows: any[] = [];
  const store: XPostStore = {
    eventsPublishedSince: async () => events,
    postedEventIds: async () => new Set(rows.filter((r) => r.postId && r.eventId).map((r) => r.eventId)),
    recordXPosts: async (r) => { rows.push(...r); },
  };
  return { store, rows };
}

const CREDS_ENV = { X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts' };

describe('runXPost', () => {
  it('only drafts unless X_POST_ENABLED=1 and credentials are set', async () => {
    const { store, rows } = fakeStore([ev({ id: 'a' })]);
    const fetchImpl = vi.fn();
    const out = await runXPost(store, NOW, { env: { ...CREDS_ENV }, now: NOW, fetchImpl });
    expect(out).toMatchObject({ posted: 0, dryRun: true });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.dryRun && r.postId === null)).toBe(true);
    // A draft never blocks the real post later.
    expect(await store.postedEventIds()).toEqual(new Set());
  });

  it('posts a reply chain and records each post id', async () => {
    const { store, rows } = fakeStore([ev({ id: 'a' }), ev({ id: 'b', aor: 'EUCOM' })]);
    let n = 0;
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: { id: `p${++n}` } }), { status: 201 }));
    const out = await runXPost(store, NOW, { env: { ...CREDS_ENV, X_POST_ENABLED: '1' }, now: NOW, fetchImpl });
    expect(out).toMatchObject({ posted: 3, dryRun: false });
    const bodies = fetchImpl.mock.calls.map((c: any[]) => JSON.parse(c[1].body));
    expect(bodies[0].reply).toBeUndefined();
    expect(bodies[1].reply).toEqual({ in_reply_to_tweet_id: 'p1' });
    expect(bodies[2].reply).toEqual({ in_reply_to_tweet_id: 'p2' });
    expect(rows.map((r) => r.postId)).toEqual(['p1', 'p2', 'p3']);
    // The next cycle does not post the same events again.
    expect(await runXPost(store, NOW, { env: { ...CREDS_ENV, X_POST_ENABLED: '1' }, now: NOW, fetchImpl })).toMatchObject({ posted: 0 });
  });

  it('stops at the first refused post and records the error on it', async () => {
    const { store, rows } = fakeStore([ev({ id: 'a' }), ev({ id: 'b', aor: 'EUCOM' })]);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'p1' } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ title: 'Too Many Requests' }), { status: 429 }));
    const out = await runXPost(store, NOW, { env: { ...CREDS_ENV, X_POST_ENABLED: '1' }, now: NOW, fetchImpl });
    expect(out).toMatchObject({ posted: 1, error: 'HTTP 429: Too Many Requests' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(rows.map((r) => [r.postId, r.error ?? null])).toEqual([['p1', null], [null, 'HTTP 429: Too Many Requests'], [null, null]]);
  });
});

describe('postThread', () => {
  it('reports a missing id as a failure', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    const out = await postThread(['hi'], { apiKey: 'k', apiSecret: 's', accessToken: 't', accessSecret: 'ts' }, fetchImpl as any);
    expect(out).toEqual({ ids: [], error: 'HTTP 200: no post id returned' });
  });
});
