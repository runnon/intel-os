import type { Aor } from '@intel-os/core';
import { AORS } from '@intel-os/core';
import type { Article } from './feeds';

/**
 * Social-media ingest — an EARLY-WARNING / velocity layer, never an authority.
 * Every article returned here is tagged `social: true`; the pipeline's
 * corroboration gate holds a social-only event unpublished until a news/official
 * source reports the same incident. All three sources are FREE (no paid SaaS)
 * and OPT-IN via env vars — with no credentials configured they return nothing,
 * so the NIPRNet build is unaffected (interim, swappable; see docs/DECISIONS.md).
 *
 * - Telegram: GramJS over the official MTProto API (free api_id/api_hash from
 *   my.telegram.org + a one-time StringSession). Reads a configured list of
 *   public channels.
 * - Bluesky: the open AT Protocol public API via @atproto/api (free app
 *   password). Per-AOR keyword search — this is an API call, not scraping.
 * - Mastodon: plain hashtag RSS (no credentials at all).
 */

const SOCIAL_AGE_MS = 24 * 3600_000; // social is a velocity layer — last 24h only

// Simple per-AOR search terms for Bluesky (its search is space/OR based, not the
// full GDELT boolean grammar). Kept short and high-signal.
const SOCIAL_QUERIES: Record<Aor, string> = {
  CENTCOM: 'Iran OR Houthi OR "Red Sea" OR Hormuz strike OR missile OR drone',
  EUCOM: 'Ukraine OR Russia strike OR missile OR drone OR offensive',
  INDOPACOM: 'Taiwan OR "South China Sea" OR "North Korea" missile OR incursion OR drills',
  AFRICOM: 'Sudan OR Somalia OR Sahel OR Libya attack OR strike OR clashes',
  NORTHCOM: 'cartel OR "southern border" OR NORAD seizure OR incursion OR strike',
  SOUTHCOM: 'Venezuela OR Haiti OR "drug trafficking" navy OR seizure OR gang',
};

// Public Mastodon hashtag RSS feeds (no auth). Low volume but zero-setup.
export const SOCIAL_RSS: { url: string; outlet: string }[] = [
  { url: 'https://mastodon.social/tags/OSINT.rss', outlet: 'Mastodon #OSINT' },
  { url: 'https://mastodon.social/tags/Ukraine.rss', outlet: 'Mastodon #Ukraine' },
];

/** Bluesky (AT Protocol) per-AOR latest-post search. Empty unless configured. */
export async function fetchBluesky(aor: Aor): Promise<Article[]> {
  const identifier = process.env.BLUESKY_IDENTIFIER;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!identifier || !password) return [];
  const { AtpAgent } = await import('@atproto/api');
  const agent = new AtpAgent({ service: 'https://bsky.social' });
  await agent.login({ identifier, password });
  const res = await agent.app.bsky.feed.searchPosts({ q: SOCIAL_QUERIES[aor], limit: 25, sort: 'latest' });
  const cutoff = Date.now() - SOCIAL_AGE_MS;
  return (res.data.posts ?? [])
    .filter((p) => new Date(p.indexedAt).getTime() >= cutoff)
    .map((p): Article => {
      const text = String((p.record as { text?: string })?.text ?? '');
      const rkey = p.uri.split('/').pop();
      return {
        title: text.slice(0, 160) || '(no text)',
        url: `https://bsky.app/profile/${p.author.handle}/post/${rkey}`,
        outlet: `Bluesky @${p.author.handle}`,
        publishedAt: p.indexedAt,
        summary: text.slice(0, 500),
        social: true,
      };
    });
}

/** Telegram public channels via GramJS/MTProto. Empty unless configured. */
export async function fetchTelegram(): Promise<Article[]> {
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const session = process.env.TELEGRAM_SESSION;
  const channels = (process.env.TELEGRAM_CHANNELS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!apiId || !apiHash || !session || channels.length === 0) return [];
  const { TelegramClient } = await import('telegram');
  const { StringSession } = await import('telegram/sessions');
  const client = new TelegramClient(new StringSession(session), Number(apiId), apiHash, { connectionRetries: 2 });
  await client.connect();
  const cutoff = Date.now() - SOCIAL_AGE_MS;
  const out: Article[] = [];
  try {
    for (const ch of channels) {
      try {
        const messages = await client.getMessages(ch, { limit: 30 });
        for (const m of messages) {
          const text = m.message;
          if (!text) continue;
          const ts = (m.date ?? 0) * 1000;
          if (ts < cutoff) continue;
          const handle = ch.replace(/^@/, '');
          out.push({
            title: text.slice(0, 160),
            url: `https://t.me/${handle}/${m.id}`,
            outlet: `Telegram @${handle}`,
            publishedAt: new Date(ts).toISOString(),
            summary: text.slice(0, 500),
            social: true,
          });
        }
      } catch (e) {
        console.warn(`[telegram] ${ch} failed: ${e}`);
      }
    }
  } finally {
    await client.disconnect().catch(() => {});
  }
  return out;
}

/** True if any social source is configured (used to skip the work entirely). */
export function socialEnabled(): boolean {
  return Boolean(
    (process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD) ||
      (process.env.TELEGRAM_API_ID && process.env.TELEGRAM_SESSION),
  );
}

/** All Bluesky-per-AOR + one Telegram fetch, tagged for their AOR(s). */
export async function fetchSocial(): Promise<{ aor: Aor | null; articles: Article[] }[]> {
  const out: { aor: Aor | null; articles: Article[] }[] = [];
  for (const aor of AORS) {
    try {
      const arts = await fetchBluesky(aor);
      if (arts.length) out.push({ aor, articles: arts });
    } catch (e) {
      console.warn(`[bluesky ${aor}] failed: ${e}`);
    }
  }
  try {
    const tg = await fetchTelegram();
    if (tg.length) out.push({ aor: null, articles: tg }); // channels are general → relevance-routed
  } catch (e) {
    console.warn(`[telegram] failed: ${e}`);
  }
  return out;
}
