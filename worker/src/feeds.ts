import { XMLParser } from 'fast-xml-parser';
import { assertPublicSource } from '@intel-os/core';

/** A raw article pulled from a public feed, pre-extraction. */
export interface Article {
  title: string;
  url: string;
  outlet: string;
  publishedAt: string; // ISO
  summary: string;
}

export type FeedFetcher = () => Promise<Article[]>;

const RSS_FEEDS: { url: string; outlet: string }[] = [
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', outlet: 'Al Jazeera' },
  { url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', outlet: 'BBC' },
];

const GDELT_QUERY =
  '(Iran OR Houthi OR CENTCOM OR "Persian Gulf" OR Hormuz OR "Red Sea") (strike OR missile OR drone OR attack OR intercept OR base)';

const parser = new XMLParser({ ignoreAttributes: false });

async function fetchRss(url: string, outlet: string): Promise<Article[]> {
  const res = await fetch(url, { headers: { 'user-agent': 'theater-picture-ingest/0.1' } });
  if (!res.ok) throw new Error(`RSS fetch failed ${res.status}: ${url}`);
  const xml = parser.parse(await res.text());
  const items = xml?.rss?.channel?.item ?? [];
  const list = Array.isArray(items) ? items : [items];
  return list
    .filter((it: any) => it?.link && it?.title)
    .map((it: any) => ({
      title: String(it.title),
      url: String(it.link),
      outlet,
      publishedAt: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
      summary: String(it.description ?? '').replace(/<[^>]+>/g, '').slice(0, 500),
    }));
}

async function fetchGdelt(): Promise<Article[]> {
  const u = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  u.searchParams.set('query', GDELT_QUERY);
  u.searchParams.set('mode', 'artlist');
  u.searchParams.set('format', 'json');
  u.searchParams.set('maxrecords', '75');
  u.searchParams.set('timespan', '24h');
  const res = await fetch(u, { headers: { 'user-agent': 'theater-picture-ingest/0.1' } });
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
 * Fetch all configured public feeds. Partial feed failures are tolerated (one
 * dead RSS host must not kill the run) but total failure throws so AUTO-9
 * semantics apply upstream. Every article passes the MARK-4 public-source guard.
 */
export async function fetchAllFeeds(): Promise<Article[]> {
  const results = await Promise.allSettled([
    ...RSS_FEEDS.map((f) => fetchRss(f.url, f.outlet)),
    fetchGdelt(),
  ]);
  const ok = results.filter((r): r is PromiseFulfilledResult<Article[]> => r.status === 'fulfilled');
  if (ok.length === 0) {
    const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    throw new Error(`all feeds failed: ${first?.reason}`);
  }
  const articles = ok.flatMap((r) => r.value);
  for (const a of articles) assertPublicSource(a.url);
  // de-dupe by URL across feeds
  const seen = new Set<string>();
  return articles.filter((a) => (seen.has(a.url) ? false : (seen.add(a.url), true)));
}
