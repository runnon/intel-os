import { XMLParser } from 'fast-xml-parser';
import type { Aor } from '@intel-os/core';
import { AORS, assertPublicSource } from '@intel-os/core';

/** A raw article pulled from a public feed, pre-extraction. */
export interface Article {
  title: string;
  url: string;
  outlet: string;
  publishedAt: string; // ISO
  summary: string;
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
    '(Iran OR Houthi OR CENTCOM OR "Persian Gulf" OR Hormuz OR "Red Sea") (strike OR missile OR drone OR attack OR intercept OR base)',
  EUCOM:
    '(Ukraine OR Russia OR NATO OR Crimea OR "Black Sea" OR Kaliningrad OR "Baltic Sea") (strike OR missile OR drone OR offensive OR shelling OR sabotage OR incursion)',
  INDOPACOM:
    '(Taiwan OR "South China Sea" OR "North Korea" OR PLA OR Senkaku OR Philippines) (missile OR incursion OR drills OR blockade OR launch OR warship OR intercept)',
  AFRICOM:
    '(Somalia OR "al-Shabaab" OR Sudan OR Mali OR Niger OR "Burkina Faso" OR Libya OR Congo OR Sahel) (attack OR strike OR ambush OR offensive OR militants OR insurgents)',
  NORTHCOM:
    '(NORAD OR "Coast Guard" OR cartel OR "Mexican military" OR Arctic OR Alaska) (intercept OR seizure OR deployment OR incursion OR operation OR trafficking)',
  SOUTHCOM:
    '(Venezuela OR Colombia OR Ecuador OR Haiti OR "Panama Canal" OR Guyana OR Caribbean) (military OR navy OR seizure OR gang OR deployment OR strike)',
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
      if (!link || !it?.title) return null;
      const date = it.pubDate ?? it.published ?? it.updated;
      return {
        title: decodeEntities(String(typeof it.title === 'object' ? it.title['#text'] ?? '' : it.title)),
        url: decodeEntities(String(link)),
        outlet,
        publishedAt: date ? new Date(date).toISOString() : new Date().toISOString(),
        summary: decodeEntities(String(it.description ?? it.summary ?? ''))
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
 * Feed fetcher for one AOR: shared feeds + regional feeds + the AOR's GDELT
 * sweep. Partial feed failures are tolerated (one dead RSS host must not kill
 * the run) but total failure throws so AUTO-9 semantics apply upstream. Every
 * article passes the MARK-4 public-source guard.
 */
export function makeFeedFetcher(aor: Aor): FeedFetcher {
  return async () => {
    const feeds = [...SHARED_FEEDS, ...AOR_FEEDS[aor]];
    const results = await Promise.allSettled([
      ...feeds.map((f) => fetchRss(f.url, f.outlet)),
      fetchGdelt(GDELT_QUERIES[aor]),
    ]);
    const failed = results
      .map((r, i) => (r.status === 'rejected' ? { feed: feeds[i]?.url ?? 'gdelt', reason: r.reason } : null))
      .filter(Boolean);
    for (const f of failed) console.warn(`[${aor}] feed failed: ${f!.feed}: ${f!.reason}`);
    const ok = results.filter((r): r is PromiseFulfilledResult<Article[]> => r.status === 'fulfilled');
    if (ok.length === 0) {
      throw new Error(`all feeds failed for ${aor}: ${failed[0]?.reason}`);
    }
    const cutoff = Date.now() - MAX_ARTICLE_AGE_MS;
    const articles = ok
      .flatMap((r) => r.value)
      .filter((a) => new Date(a.publishedAt).getTime() >= cutoff);
    for (const a of articles) assertPublicSource(a.url);
    // de-dupe by URL across feeds, newest first so batch truncation keeps fresh items
    const seen = new Set<string>();
    return articles
      .filter((a) => (seen.has(a.url) ? false : (seen.add(a.url), true)))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  };
}

/** All ingest-enabled AORs; override with a comma-separated AORS env var. */
export function configuredAors(env: string | undefined): Aor[] {
  if (!env) return [...AORS];
  const wanted = env.split(',').map((s) => s.trim().toUpperCase());
  const valid = wanted.filter((w): w is Aor => (AORS as readonly string[]).includes(w));
  if (valid.length === 0) throw new Error(`AORS env var matched no known AOR: ${env}`);
  return valid;
}
