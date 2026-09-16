import type { SourceRef, TheaterEvent } from './types';

/**
 * AUTO-2: a single event reported by four outlets plots once, carrying all four
 * sources. Dedup is deliberately conservative — merging two *different* events is
 * worse than listing one event twice, because a merge silently destroys reporting.
 */

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'and', 'or', 'for', 'with',
  'after', 'near', 'by', 'from', 'is', 'are', 'was', 'were', 'as', 'its',
]);

function tokens(s: string): Set<string> {
  return new Set(norm(s).split(' ').filter((t) => t.length > 2 && !STOPWORDS.has(t)));
}

export function titleSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

function hoursApart(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3_600_000;
}

function samePlace(a: TheaterEvent, b: TheaterEvent): boolean {
  if (norm(a.placeName) === norm(b.placeName)) return true;
  if (a.lat != null && b.lat != null && a.lon != null && b.lon != null) {
    const km = Math.hypot(a.lat - b.lat, (a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180)) * 111;
    return km < 25;
  }
  return false;
}

/** Two candidate events describe the same incident if place, time and content agree. */
export function isDuplicate(a: TheaterEvent, b: TheaterEvent): boolean {
  if (a.aor !== b.aor) return false;
  if (!samePlace(a, b)) return false;
  if (hoursApart(a.occurredAt, b.occurredAt) > 36) return false;
  if (a.category !== b.category) return false;
  return titleSimilarity(a.title + ' ' + a.summary, b.title + ' ' + b.summary) >= 0.4;
}

function mergeSources(a: SourceRef[], b: SourceRef[]): SourceRef[] {
  const seen = new Set(a.map((s) => s.url));
  return [...a, ...b.filter((s) => !seen.has(s.url))];
}

/**
 * Merge duplicate `incoming` into `existing`. Existing text wins (stability across
 * issues, DATA-6 revisions handle real changes); sources union; confidence takes the max.
 */
export function mergeEvents(existing: TheaterEvent, incoming: TheaterEvent): TheaterEvent {
  const order: Record<string, number> = { low: 0, moderate: 1, high: 2 };
  return {
    ...existing,
    sources: mergeSources(existing.sources, incoming.sources),
    confOrigin: (order[incoming.confOrigin] ?? 0) > (order[existing.confOrigin] ?? 0) ? incoming.confOrigin : existing.confOrigin,
    confActor: (order[incoming.confActor] ?? 0) > (order[existing.confActor] ?? 0) ? incoming.confActor : existing.confActor,
    usForcesFlag: existing.usForcesFlag || incoming.usForcesFlag,
  };
}

/** Dedup a batch of candidates against themselves and a set of existing events. */
export function dedupe(candidates: TheaterEvent[], existing: TheaterEvent[]): { fresh: TheaterEvent[]; merged: TheaterEvent[] } {
  const kept: TheaterEvent[] = [];
  const merged: TheaterEvent[] = [];
  const updatedExisting = new Map<string, TheaterEvent>();

  outer: for (const cand of candidates) {
    for (const ex of existing) {
      if (isDuplicate(ex, cand)) {
        const base = updatedExisting.get(ex.id) ?? ex;
        updatedExisting.set(ex.id, mergeEvents(base, cand));
        continue outer;
      }
    }
    for (let i = 0; i < kept.length; i++) {
      const k = kept[i]!;
      if (isDuplicate(k, cand)) {
        kept[i] = mergeEvents(k, cand);
        continue outer;
      }
    }
    kept.push(cand);
  }
  merged.push(...updatedExisting.values());
  return { fresh: kept, merged };
}
