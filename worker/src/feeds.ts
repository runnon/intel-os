import { XMLParser } from 'fast-xml-parser';
import type { Aor } from '@intel-os/core';
import { AORS, GAZETTEERS, assertPublicSource } from '@intel-os/core';
import { SOCIAL_RSS, fetchSocial, socialEnabled } from './social';

/** A raw article pulled from a public feed, pre-extraction. */
export interface Article {
  title: string;
  url: string;
  outlet: string;
  publishedAt: string; // ISO
  summary: string;
  /** True for social-media origin (Telegram/Bluesky/Mastodon). A social-only
   *  event is held until a news/official source corroborates it. */
  social?: boolean;
}

/**
 * A pooled article carries the AORs whose *targeted* sources (regional feed or
 * GDELT query) surfaced it. Every AOR's extraction draws from the same pool, so
 * an article a regional feed missed can still reach a command via a broad
 * source (Al Jazeera global, BBC World, DoD releases, another AOR's GDELT).
 */
export interface PooledArticle extends Article {
  targetedFor: Aor[];
}

export type FeedFetcher = () => Promise<Article[]>;

interface FeedDef {
  url: string;
  outlet: string;
}

// Sources every AOR ingests each cycle. All are direct public HTTPS feeds
// (NIPRNet-reachable, no auth, no third-party API keys); .mil feeds are
// official public-affairs releases and pass the MARK-4 public-source guard.
const SHARED_FEEDS: FeedDef[] = [
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', outlet: 'Al Jazeera' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', outlet: 'BBC' },
  { url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', outlet: 'UN News' },
  { url: 'https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=30', outlet: 'US DoD' },
  { url: 'https://www.dvidshub.net/rss/news', outlet: 'DVIDS' }, // official US military releases firehose
  { url: 'https://www.defenseone.com/rss/all/', outlet: 'Defense One' },
  { url: 'https://gcaptain.com/feed/', outlet: 'gCaptain' },
  { url: 'https://www.navalnews.com/feed/', outlet: 'Naval News' },
];

// Regional feeds layered on top of the shared set, per combatant command.
const AOR_FEEDS: Record<Aor, FeedDef[]> = {
  CENTCOM: [
    { url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', outlet: 'BBC Middle East' },
  ],
  EUCOM: [
    { url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml', outlet: 'BBC Europe' },
  ],
  INDOPACOM: [
    { url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml', outlet: 'BBC Asia' },
  ],
  AFRICOM: [
    { url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', outlet: 'BBC Africa' },
    { url: 'https://www.france24.com/en/africa/rss', outlet: 'France 24 Africa' },
  ],
  NORTHCOM: [
    { url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml', outlet: 'BBC US & Canada' },
    { url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml', outlet: 'BBC Latin America' },
  ],
  SOUTHCOM: [
    { url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml', outlet: 'BBC Latin America' },
    { url: 'https://www.france24.com/en/americas/rss', outlet: 'France 24 Americas' },
  ],
};

// GDELT DOC API sweeps thousands of outlets worldwide — this is the broad
// "multiple points" net; the curated RSS feeds above anchor source quality.
const GDELT_QUERIES: Record<Aor, string> = {
  CENTCOM:
    '(Iran OR Houthi OR CENTCOM OR Yemen OR Syria OR Iraq OR Hezbollah OR IRGC OR "Persian Gulf" OR Hormuz OR "Red Sea" OR "Bab el-Mandeb") (strike OR airstrike OR missile OR drone OR attack OR intercept OR shelling OR seizure OR launch OR killed)',
  EUCOM:
    '(Ukraine OR Russia OR NATO OR Crimea OR Belarus OR Moldova OR "Black Sea" OR Kaliningrad OR "Baltic Sea" OR Zaporizhzhia) (strike OR airstrike OR missile OR drone OR offensive OR shelling OR sabotage OR incursion OR advance OR killed)',
  INDOPACOM:
    '(Taiwan OR "South China Sea" OR "North Korea" OR PLA OR Senkaku OR Philippines OR "Taiwan Strait" OR Pyongyang OR "East China Sea") (missile OR incursion OR drills OR blockade OR launch OR warship OR intercept OR jet OR coast guard)',
  AFRICOM:
    '(Somalia OR "al-Shabaab" OR Sudan OR Mali OR Niger OR "Burkina Faso" OR Libya OR Congo OR Sahel OR Mozambique OR Nigeria OR "Boko Haram") (attack OR strike OR ambush OR offensive OR militants OR insurgents OR clashes OR killed OR raid)',
  NORTHCOM:
    '(NORAD OR "Coast Guard" OR cartel OR "Mexican military" OR Arctic OR Alaska OR Sinaloa OR fentanyl OR "southern border") (intercept OR seizure OR deployment OR incursion OR operation OR trafficking OR strike OR patrol)',
  SOUTHCOM:
    '(Venezuela OR Colombia OR Ecuador OR Haiti OR "Panama Canal" OR Guyana OR Caribbean OR Maduro OR Essequibo OR "drug trafficking") (military OR navy OR seizure OR gang OR deployment OR strike OR patrol OR incursion)',
};

const MAX_ARTICLE_AGE_MS = 72 * 3600_000; // stale RSS backlog is noise, not reporting

// processEntities off: some feeds (Defense One) exceed the parser's entity
// expansion limit; we decode the common named entities ourselves.
const parser = new XMLParser({ ignoreAttributes: false, processEntities: false });

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&apos;|&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

async function fetchRss(url: string, outlet: string): Promise<Article[]> {
  const res = await fetch(url, { headers: { 'user-agent': 'theater-picture-ingest/0.1' } });
  if (!res.ok) throw new Error(`RSS fetch failed ${res.status}: ${url}`);
  const xml = parser.parse(await res.text());
  // RSS 2.0 or Atom
  const rssItems = xml?.rss?.channel?.item;
  const atomItems = xml?.feed?.entry;
  const items = rssItems ?? atomItems ?? [];
  const list = Array.isArray(items) ? items : [items];
  return list
    .map((it: any) => {
      const link = typeof it?.link === 'object' ? it.link?.['@_href'] : it?.link;
      if (!link) return null;
      const date = it.pubDate ?? it.published ?? it.updated;
      const rawTitle = decodeEntities(String(typeof it.title === 'object' ? it.title['#text'] ?? '' : it.title ?? ''));
      const bodyText = decodeEntities(String(it.description ?? it.summary ?? it.content ?? ''))
        .replace(/<[^>]+>/g, '')
        .trim();
      // Mastodon and other title-less feeds: fall back to the post body as title.
      const title = rawTitle.trim() || bodyText.slice(0, 140);
      if (!title) return null;
      return {
        title,
        url: decodeEntities(String(link)),
        outlet,
        publishedAt: date ? new Date(date).toISOString() : new Date().toISOString(),
        summary: decodeEntities(String(it.description ?? it.summary ?? it.content ?? ''))
          .replace(/<[^>]+>/g, '')
          .slice(0, 500),
      };
    })
    .filter((a): a is Article => a !== null && a.title.length > 0);
}

// GDELT rate-limits closely spaced requests; a multi-AOR run makes six calls,
// so enforce a minimum gap between them and retry once on 429.
const GDELT_MIN_GAP_MS = 8000;
let lastGdeltCall = 0;

async function fetchGdelt(query: string): Promise<Article[]> {
  const wait = lastGdeltCall + GDELT_MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGdeltCall = Date.now();
  const u = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  u.searchParams.set('query', query);
  u.searchParams.set('mode', 'artlist');
  u.searchParams.set('format', 'json');
  u.searchParams.set('maxrecords', '75');
  u.searchParams.set('timespan', '24h');
  let res = await fetch(u, { headers: { 'user-agent': 'theater-picture-ingest/0.1' } });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 15000));
    lastGdeltCall = Date.now();
    res = await fetch(u, { headers: { 'user-agent': 'theater-picture-ingest/0.1' } });
  }
  if (!res.ok) throw new Error(`GDELT fetch failed ${res.status}`);
  const body = await res.json().catch(() => ({ articles: [] }));
  return (body.articles ?? [])
    .filter((a: any) => a?.url && a?.title)
    .map((a: any) => ({
      title: String(a.title),
      url: String(a.url),
      outlet: String(a.domain ?? 'GDELT'),
      publishedAt: a.seendate
        ? new Date(
            a.seendate.replace(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/, '$1-$2-$3T$4:$5:$6Z'),
          ).toISOString()
        : new Date().toISOString(),
      summary: '',
    }));
}

/**
 * Fetch EVERY source once into one deduped pool: shared global feeds, all AORs'
 * regional feeds, and all six GDELT queries. Each article is tagged with the
 * AORs whose targeted sources surfaced it. Shared feeds (Al Jazeera global, BBC
 * World, UN, DoD, Defense One, gCaptain, Naval News) carry no tag — they belong
 * to every command via the relevance pass in selectForAor.
 *
 * Partial failures are tolerated (a dead host must not kill the cycle); total
 * source failure throws so AUTO-9 applies. Every article passes the MARK-4
 * public-source guard. A feed shared by two AORs (e.g. BBC Latin America) is
 * fetched once and tagged for both.
 */
export async function fetchGlobalPool(): Promise<PooledArticle[]> {
  // Build a fetch plan deduped by URL, tracking which AORs each feed serves.
  const plan = new Map<string, { url: string; outlet: string; aors: Set<Aor> }>();
  const addFeed = (url: string, outlet: string, aor?: Aor) => {
    let e = plan.get(url);
    if (!e) {
      e = { url, outlet, aors: new Set() };
      plan.set(url, e);
    }
    if (aor) e.aors.add(aor);
  };
  for (const f of SHARED_FEEDS) addFeed(f.url, f.outlet);
  for (const aor of AORS) for (const f of AOR_FEEDS[aor]) addFeed(f.url, f.outlet, aor);
  const feeds = [...plan.values()].map((e) => ({ url: e.url, outlet: e.outlet, aors: [...e.aors] }));

  const cutoff = Date.now() - MAX_ARTICLE_AGE_MS;
  const pool = new Map<string, PooledArticle>();
  let okSources = 0;

  const ingest = (arts: Article[], aors: Aor[]) => {
    for (const a of arts) {
      if (new Date(a.publishedAt).getTime() < cutoff) continue;
      try {
        assertPublicSource(a.url);
      } catch {
        continue; // MARK-4: drop a non-public URL rather than fail the whole pool
      }
      const existing = pool.get(a.url);
      if (existing) {
        for (const aor of aors) if (!existing.targetedFor.includes(aor)) existing.targetedFor.push(aor);
      } else {
        pool.set(a.url, { ...a, targetedFor: [...aors] });
      }
    }
  };

  // RSS feeds concurrently.
  const rss = await Promise.allSettled(feeds.map((f) => fetchRss(f.url, f.outlet)));
  rss.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      okSources++;
      ingest(r.value, feeds[i].aors);
    } else {
      console.warn(`feed failed: ${feeds[i].url}: ${r.reason}`);
    }
  });

  // GDELT queries sequentially so the module-level throttle actually spaces them.
  for (const aor of AORS) {
    try {
      ingest(await fetchGdelt(GDELT_QUERIES[aor]), [aor]);
      okSources++;
    } catch (e) {
      console.warn(`[${aor}] gdelt failed: ${e}`);
    }
  }

  // Social layer (velocity / early-warning). Every article is tagged social so
  // the corroboration gate holds social-only events until a news source confirms.
  // Mastodon hashtag RSS needs no credentials; Bluesky/Telegram are opt-in.
  const socialRss = await Promise.allSettled(SOCIAL_RSS.map((f) => fetchRss(f.url, f.outlet)));
  socialRss.forEach((r, i) => {
    if (r.status === 'fulfilled') ingest(r.value.map((a) => ({ ...a, social: true })), []);
    else console.warn(`social feed failed: ${SOCIAL_RSS[i].url}: ${r.reason}`);
  });
  if (socialEnabled()) {
    for (const { aor, articles } of await fetchSocial()) ingest(articles, aor ? [aor] : []);
  }

  if (okSources === 0) throw new Error('global pool: all sources failed');
  return [...pool.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

// Per-AOR relevance keywords derived from that command's curated gazetteer
// (place names, aliases, countries) — the same vocabulary that geolocates its
// events. Matched with word boundaries so short names don't match substrings.
const AOR_REGEX = new Map<Aor, RegExp>();
function aorRegex(aor: Aor): RegExp {
  let re = AOR_REGEX.get(aor);
  if (re) return re;
  // Terms too broad to be a useful relevance signal: they appear in most global
  // reporting regardless of theater. Genuine events in these places still reach
  // the command via its own regional feed + GDELT query (always kept).
  const TOO_BROAD = new Set(['international', 'united states', 'united kingdom']);
  const terms = new Set<string>();
  for (const e of GAZETTEERS[aor]) {
    for (const n of [e.name, ...e.aliases, e.country]) {
      const t = n.trim();
      if (t.length >= 4 && !TOO_BROAD.has(t.toLowerCase())) terms.add(t);
    }
  }
  const escaped = [...terms].map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  re = new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'gi');
  AOR_REGEX.set(aor, re);
  return re;
}

const SELECT_CAP = 150; // articles handed to one AOR's extraction

/**
 * Select this AOR's slice of the global pool. An article is a candidate if it
 * came from one of the AOR's targeted sources OR mentions any of the AOR's
 * gazetteer terms. Own-source articles rank first, then by keyword-match count,
 * then recency — so the extraction budget goes to the most relevant reporting
 * regardless of which source surfaced it.
 */
export function selectForAor(pool: PooledArticle[], aor: Aor): Article[] {
  const re = aorRegex(aor);
  const scored = pool
    .map((a) => {
      const own = a.targetedFor.includes(aor);
      const score = (`${a.title} ${a.summary}`.match(re) ?? []).length;
      return { a, own, score };
    })
    .filter((s) => s.own || s.score > 0);
  scored.sort(
    (x, y) =>
      Number(y.own) - Number(x.own) ||
      y.score - x.score ||
      y.a.publishedAt.localeCompare(x.a.publishedAt),
  );
  return scored.slice(0, SELECT_CAP).map(({ a }) => ({
    title: a.title,
    url: a.url,
    outlet: a.outlet,
    publishedAt: a.publishedAt,
    summary: a.summary,
  }));
}

/** All ingest-enabled AORs; override with a comma-separated AORS env var. */
export function configuredAors(env: string | undefined): Aor[] {
  if (!env) return [...AORS];
  const wanted = env.split(',').map((s) => s.trim().toUpperCase());
  const valid = wanted.filter((w): w is Aor => (AORS as readonly string[]).includes(w));
  if (valid.length === 0) throw new Error(`AORS env var matched no known AOR: ${env}`);
  return valid;
}
