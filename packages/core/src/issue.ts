import type {
  Aor,
  ChangeLogEntry,
  SituationUpdate,
  SourceSummary,
  TempoMetrics,
  TheaterEvent,
} from './types';

/**
 * Situation-update builder (Phase 1 product type).
 * AUTO-1: publishes whether or not new events were found — a no-change issue is a product.
 * AUTO-5: the type carries no key-judgements/alternatives/implications section in any form.
 * AUTO-10: issues are immutable snapshots addressable by serial.
 */

export const DISCLAIMER =
  'Not an official product of any government agency. Carries no official coordination. ' +
  'Derived entirely from publicly available information.';

const AOR_CODE: Record<Aor, string> = {
  CENTCOM: 'CEN',
  EUCOM: 'EUR',
  INDOPACOM: 'IPC',
  AFRICOM: 'AFR',
  NORTHCOM: 'NOR',
  SOUTHCOM: 'SOU',
};

export function makeSerial(aor: Aor, issueNumber: number, at: Date): string {
  const yy = String(at.getUTCFullYear()).slice(2);
  return `SU-${AOR_CODE[aor]}-${yy}-${String(issueNumber).padStart(3, '0')}`;
}

export function tempoMetrics(events: TheaterEvent[], newIds: Set<string>): TempoMetrics {
  const byCategory: Record<string, number> = {};
  const byAffiliation: Record<string, number> = {};
  let usForcesEvents = 0;
  let unplotted = 0;
  for (const e of events) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    byAffiliation[e.affiliation] = (byAffiliation[e.affiliation] ?? 0) + 1;
    if (e.usForcesFlag) usForcesEvents++;
    if (e.lat == null || e.lon == null) unplotted++;
  }
  return {
    totalEvents: events.length,
    newSinceLastIssue: newIds.size,
    byCategory,
    byAffiliation,
    usForcesEvents,
    unplottedEvents: unplotted,
  };
}

/** AUTO-5 change log carries reported facts only — no assessment language. */
export function changeLog(events: TheaterEvent[], newIds: Set<string>, revisedIds: Set<string>): ChangeLogEntry[] {
  const entries: ChangeLogEntry[] = [];
  for (const e of events) {
    if (newIds.has(e.id)) entries.push({ eventId: e.id, kind: 'new', summary: `${e.placeName}: ${e.title}` });
    else if (revisedIds.has(e.id)) entries.push({ eventId: e.id, kind: 'revised', summary: `${e.placeName}: ${e.title} (revised)` });
  }
  return entries;
}

export function sourceSummary(events: TheaterEvent[]): SourceSummary {
  const outletCounts: Record<string, number> = {};
  let total = 0;
  let singleSource = 0;
  for (const e of events) {
    total += e.sources.length;
    if (e.sources.length <= 1) singleSource++;
    for (const s of e.sources) outletCounts[s.outlet] = (outletCounts[s.outlet] ?? 0) + 1;
  }
  const outlets = Object.entries(outletCounts).sort((a, b) => b[1] - a[1]);
  const top = outlets.slice(0, 5).map(([o, n]) => `${o} (${n})`).join(', ');
  const statement =
    `All information derives from publicly available reporting across ${outlets.length} outlet(s): ${top}. ` +
    `${singleSource} of ${events.length} events rest on a single source and should not be treated as confirmed. ` +
    `No imagery exploitation or independent collection was performed; positions derive from place names ` +
    `validated against a gazetteer, and region-level reports are listed without a plotted point.`;
  return { outletCounts, totalSources: total, singleSourceEvents: singleSource, statement };
}

export interface BuildIssueInput {
  aor: Aor;
  issueNumber: number;
  events: TheaterEvent[]; // events in window, already deduped
  newIds: Set<string>;
  revisedIds: Set<string>;
  windowStart: Date;
  infoCutoff: Date;
  now: Date;
}

export function buildSituationUpdate(input: BuildIssueInput): SituationUpdate {
  const { aor, issueNumber, events, newIds, revisedIds, windowStart, infoCutoff, now } = input;
  return {
    serial: makeSerial(aor, issueNumber, now),
    aor,
    issueNumber,
    windowStart: windowStart.toISOString(),
    infoCutoff: infoCutoff.toISOString(),
    publishedAt: now.toISOString(),
    eventIds: events.map((e) => e.id),
    tempo: tempoMetrics(events, newIds),
    changeLog: changeLog(events, newIds, revisedIds),
    sourceSummary: sourceSummary(events),
    disclaimer: DISCLAIMER,
    productType: 'situation-update',
  };
}

/**
 * MARK-4 guard: the system refuses ingest of any material not publicly sourced.
 * A source must be a resolvable public URL — no file paths, no private hosts.
 */
export function assertPublicSource(url: string): void {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`MARK-4: source is not a resolvable public URL: ${url}`);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error(`MARK-4: non-web source refused: ${url}`);
  }
  const host = u.hostname.toLowerCase();
  const forbidden =
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.intranet') ||
    /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  if (forbidden) {
    throw new Error(`MARK-4: non-public host refused: ${host}`);
  }
}
