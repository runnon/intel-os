import { createHmac, randomBytes } from 'node:crypto';
import type { Aor, TheaterEvent } from '@intel-os/core';
import { AORS, isCorroborated, isSocialSource, titleSimilarity } from '@intel-os/core';

/**
 * X (Twitter) distribution: after each ingest cycle, post one thread that points
 * readers at the published picture.
 *
 * - AUTO-5: every word comes from fields the pipeline already extracted (title,
 *   place, sources, confidence, US-forces impact). No model writes here, so no
 *   judgement or assessment can reach the unattended path.
 * - MARK-2/3: the lead carries the open-sources / not-official line; nothing reads
 *   as a classification marking.
 * - Only CORROBORATED events from issues published this cycle are eligible, so a
 *   social-only lead can never be amplified.
 * - Cost: X bills ~$0.015 per post and ~$0.20 per post containing a link, so only
 *   the lead carries a link; the replies carry none.
 * - Opt-in: posts only when X_POST_ENABLED=1 and all four X_* credentials are set.
 *   Otherwise it composes the thread and records it as a dry run, so drafts can be
 *   reviewed before the account goes live. A posting failure never fails ingest.
 */

export const SITE_URL = 'https://intel-os.org';
export const MAX_POST_WEIGHT = 280;
/** X counts every URL as a t.co link of this length, whatever its real length. */
export const URL_WEIGHT = 23;
export const MAX_HIGHLIGHTS = 5;
/** Only events reported in the last day are news; older ones were posted already or are stale. */
export const HIGHLIGHT_MAX_AGE_MS = 24 * 3600_000;
/** Title overlap at which two picks from different commands are one story. */
export const SAME_STORY_SIMILARITY = 0.5;
export const DISCLAIMER = 'Open sources only. Not an official government product.';

const AOR_SLUG: Record<Aor, string> = {
  CENTCOM: 'centcom', EUCOM: 'eucom', INDOPACOM: 'indopacom',
  AFRICOM: 'africom', NORTHCOM: 'northcom', SOUTHCOM: 'southcom',
};

// X's weighted length (twitter-text v3): these code-point ranges weigh 1, the rest 2.
const WEIGHT_ONE: [number, number][] = [[0, 4351], [8192, 8205], [8208, 8223], [8242, 8247]];
const URL_RE = /https?:\/\/\S+/g;

/** The length X enforces against its 280 limit. */
export function weightedLength(text: string): number {
  let n = 0;
  const withoutUrls = text.replace(URL_RE, () => { n += URL_WEIGHT; return ''; });
  for (const ch of withoutUrls) {
    const cp = ch.codePointAt(0)!;
    n += WEIGHT_ONE.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2;
  }
  return n;
}

/** Trim `text` (no URLs inside) to `max` weighted characters, ending with an ellipsis. */
export function clip(text: string, max: number): string {
  if (weightedLength(text) <= max) return text;
  let out = '';
  for (const ch of text) {
    if (weightedLength(out + ch + '...') > max) break;
    out += ch;
  }
  return out.trimEnd() + '...';
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Date-time group in Zulu, e.g. 301200ZOCT26 — the format military readers scan for. */
export function dtg(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}Z${MONTHS[d.getUTCMonth()]}${p(d.getUTCFullYear() % 100)}`;
}

const CONF_SCORE = { high: 2, moderate: 1, low: 0 } as const;

function score(e: TheaterEvent, now: number): number {
  const ageHours = (now - new Date(e.reportedAt).getTime()) / 3600_000;
  return (e.usForcesFlag ? 6 : 0) + CONF_SCORE[e.confOrigin] + CONF_SCORE[e.confActor]
    + Math.min(e.sources.length, 4) + (e.geomValidated ? 1 : 0) - ageHours / 12;
}

/**
 * Pick at most `max` events worth a post: corroborated, reported in the last day,
 * not posted before. One per command first, so the thread covers the theaters,
 * then the next-best regardless of command.
 */
export function selectHighlights(
  events: TheaterEvent[], postedIds: Set<string>, now: Date, max = MAX_HIGHLIGHTS,
): TheaterEvent[] {
  const t = now.getTime();
  const seen = new Set<string>();
  const eligible = events
    .filter((e) => {
      if (seen.has(e.id) || postedIds.has(e.id)) return false;
      seen.add(e.id);
      const age = t - new Date(e.reportedAt).getTime();
      return isCorroborated(e.sources) && age >= 0 && age <= HIGHLIGHT_MAX_AGE_MS;
    })
    .sort((a, b) => score(b, t) - score(a, t));
  const picked: TheaterEvent[] = [];
  // One story is often extracted under two commands (a Pentagon firing lands in
  // NORTHCOM and EUCOM); the thread carries it once.
  const repeats = (e: TheaterEvent) => picked.some((p) =>
    p.sources.some((s) => e.sources.some((x) => x.url === s.url)) || titleSimilarity(p.title, e.title) >= SAME_STORY_SIMILARITY);
  for (const aor of AORS) {
    const best = eligible.find((e) => e.aor === aor && !repeats(e));
    if (best) picked.push(best);
  }
  picked.sort((a, b) => score(b, t) - score(a, t));
  for (const e of eligible) if (picked.length < max && !picked.includes(e) && !repeats(e)) picked.push(e);
  return picked.slice(0, max);
}

function place(e: TheaterEvent): string {
  const p = e.placeName?.trim();
  const c = e.country?.trim();
  if (p && c && p.toLowerCase() !== c.toLowerCase()) return `${p}, ${c}`;
  return p || c || 'Location unconfirmed';
}

function outlets(e: TheaterEvent): string {
  const names = [...new Set(e.sources.filter((s) => !isSocialSource(s)).map((s) => s.outlet))];
  const shown = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${shown} +${names.length - 3}` : shown;
}

/** UTM-tagged link to a command's live picture. */
export function pictureUrl(aor: Aor | null, now: Date): string {
  const path = aor ? `/t/${AOR_SLUG[aor]}` : '/';
  const day = now.toISOString().slice(0, 10);
  return `${SITE_URL}${path}?utm_source=x&utm_medium=social&utm_campaign=cycle-${day}`;
}

/**
 * The thread: a lead with the headline list and the one link, then one reply per
 * highlight. Every post fits X's weighted 280 limit.
 */
export function composeThread(highlights: TheaterEvent[], now: Date): string[] {
  if (highlights.length === 0) return [];
  const aors = [...new Set(highlights.map((e) => e.aor))];
  const link = pictureUrl(aors.length === 1 ? aors[0] : null, now);
  const head = `THEATER PICTURE ${dtg(now)}`;
  const count = `${highlights.length} new open-source ${highlights.length === 1 ? 'report' : 'reports'}: ${aors.join(', ')}`;
  const tail = `Map + sources: ${link}\n${DISCLAIMER}`;
  // The top story gets the rest of the post; the thread below carries the others.
  const topBudget = MAX_POST_WEIGHT - weightedLength(`${head}\n${count}\n\n\n\n${tail}`);
  const lead = `${head}\n${count}\n\n${clip(highlights[0].title, topBudget)}\n\n${tail}`;

  const replies = highlights.map((e, i) => {
    // Side lines get fixed caps; the title takes whatever is left of the 280.
    const others = [
      `${i + 1}/${highlights.length} ${e.aor} | ${dtg(new Date(e.occurredAt))}`,
      clip(place(e), 40),
      // The flag, never the extracted impact prose: AUTO-5 keeps judgement off this path.
      e.usForcesFlag ? 'US forces involved' : null,
      clip(`Sources: ${outlets(e)}`, 50),
      `Confidence: location ${e.confOrigin}, actor ${e.confActor}`,
    ].filter((l): l is string => Boolean(l));
    const title = clip(e.title, MAX_POST_WEIGHT - weightedLength(others.join('\n')) - 1);
    return [others[0], title, ...others.slice(1)].join('\n');
  });
  return [lead, ...replies];
}

// ---------------------------------------------------------------------------
// Posting (OAuth 1.0a user context, X API v2)

export interface XCreds { apiKey: string; apiSecret: string; accessToken: string; accessSecret: string }

export function xCredsFromEnv(env: NodeJS.ProcessEnv = process.env): XCreds | null {
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET } = env;
  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) return null;
  return { apiKey: X_API_KEY, apiSecret: X_API_SECRET, accessToken: X_ACCESS_TOKEN, accessSecret: X_ACCESS_TOKEN_SECRET };
}

const pct = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * OAuth 1.0a Authorization header. Signs the URL's query parameters plus any
 * form `params`; a JSON body (X API v2) is not part of the signature.
 */
export function oauth1Header(
  method: string, url: string, creds: XCreds,
  params: Record<string, string> = {},
  nonce = randomBytes(16).toString('hex'),
  timestamp = String(Math.floor(Date.now() / 1000)),
): string {
  const u = new URL(url);
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };
  const all: [string, string][] = [...u.searchParams.entries(), ...Object.entries(params), ...Object.entries(oauth)];
  const paramString = all
    .map(([k, v]) => [pct(k), pct(v)] as const)
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const base = [method.toUpperCase(), pct(`${u.origin}${u.pathname}`), pct(paramString)].join('&');
  const signature = createHmac('sha1', `${pct(creds.apiSecret)}&${pct(creds.accessSecret)}`).update(base).digest('base64');
  const header = { ...oauth, oauth_signature: signature };
  return 'OAuth ' + Object.entries(header).map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(', ');
}

const TWEETS_URL = 'https://api.x.com/2/tweets';

/** Post a thread; returns each post's id. Stops at the first failure, keeping what posted. */
export async function postThread(
  texts: string[], creds: XCreds, fetchImpl: typeof fetch = fetch,
): Promise<{ ids: string[]; error?: string }> {
  const ids: string[] = [];
  for (const text of texts) {
    const body: Record<string, unknown> = { text };
    if (ids.length) body.reply = { in_reply_to_tweet_id: ids[ids.length - 1] };
    const res = await fetchImpl(TWEETS_URL, {
      method: 'POST',
      headers: { Authorization: oauth1Header('POST', TWEETS_URL, creds), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { id?: string }; detail?: string; title?: string };
    if (!res.ok || !json.data?.id) {
      return { ids, error: `HTTP ${res.status}: ${json.detail ?? json.title ?? 'no post id returned'}` };
    }
    ids.push(json.data.id);
  }
  return { ids };
}

// ---------------------------------------------------------------------------
// Cycle hook

export interface XPostStore {
  /** Events in issues published at or after `since`. */
  eventsPublishedSince(since: string): Promise<TheaterEvent[]>;
  /** Event ids that went out in a real post (a row with a post id). */
  postedEventIds(): Promise<Set<string>>;
  recordXPosts(rows: { kind: 'lead' | 'event'; eventId: string | null; text: string; postId: string | null; dryRun: boolean; error?: string }[]): Promise<void>;
}

export async function runXPost(
  store: XPostStore, cycleStart: Date,
  opts: { env?: NodeJS.ProcessEnv; now?: Date; fetchImpl?: typeof fetch } = {},
): Promise<{ posted: number; dryRun: boolean; error?: string }> {
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date();
  const creds = xCredsFromEnv(env);
  const live = env.X_POST_ENABLED === '1' && creds !== null;

  const events = await store.eventsPublishedSince(cycleStart.toISOString());
  const highlights = selectHighlights(events, await store.postedEventIds(), now);
  const thread = composeThread(highlights, now);
  if (thread.length === 0) return { posted: 0, dryRun: !live };

  const result = live ? await postThread(thread, creds!, opts.fetchImpl) : { ids: [] as string[] };
  await store.recordXPosts(thread.map((text, i) => ({
    kind: i === 0 ? 'lead' : 'event',
    eventId: i === 0 ? null : highlights[i - 1].id,
    text,
    postId: result.ids[i] ?? null,
    dryRun: !live,
    error: live && i === result.ids.length ? result.error : undefined,
  })));
  return { posted: result.ids.length, dryRun: !live, error: result.error };
}
