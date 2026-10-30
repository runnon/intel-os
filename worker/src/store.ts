import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Aor, SituationUpdate, TheaterEvent } from '@intel-os/core';

/**
 * Storage interface — the pipeline depends on this, tests inject an in-memory
 * fake, production uses Supabase (service role; RLS gives the public read-only).
 */
export interface Store {
  loadRecentEvents(aor: Aor, sinceIso: string): Promise<TheaterEvent[]>;
  insertEvents(events: TheaterEvent[]): Promise<void>;
  mergeEventSources(events: TheaterEvent[]): Promise<void>;
  nextIssueNumber(aor: Aor): Promise<number>;
  publishIssue(issue: SituationUpdate, snapshot: TheaterEvent[]): Promise<string>;
  recordRun(run: {
    aor: Aor; ok: boolean; fetched: number; extracted: number; deduped: number;
    publishedIssue?: string; error?: string;
  }): Promise<void>;
}

/**
 * PostgREST puts every `.in()` value in the URL. A UUID costs ~37 characters, and
 * EUCOM's 30-day window holds 350-500 events, which built a 13-19 KB query string —
 * past the gateway's limit, so the request failed before any SQL ran ("TypeError:
 * fetch failed" / "Bad Request") and EUCOM published nothing for 22 straight cycles
 * (2026-10-04 → 10-14). Every id-list filter goes through `chunk`.
 */
export const ID_QUERY_CHUNK_SIZE = 100;
/** PostgREST answers at most `max_rows` (1000) per request and truncates silently. */
export const DB_PAGE_SIZE = 1000;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type SourceRow = {
  event_id: string; url: string; outlet: string; title: string | null; published_at: string | null;
};

/**
 * One upsert may not touch the same (event_id, url) twice, or Postgres refuses the
 * whole batch ("ON CONFLICT DO UPDATE command cannot affect row a second time").
 * Dedup can hand back an event carrying the same article twice; keep the last copy,
 * filling a missing title/date from an earlier one.
 */
export function uniqueSourceRows(rows: SourceRow[]): SourceRow[] {
  const byKey = new Map<string, SourceRow>();
  for (const r of rows) {
    const key = `${r.event_id}\u0001${r.url}`;
    const prev = byKey.get(key);
    byKey.set(key, prev
      ? { ...r, title: r.title ?? prev.title, published_at: r.published_at ?? prev.published_at }
      : r);
  }
  return [...byKey.values()];
}

/**
 * Postgres rejects a NUL character and an unpaired UTF-16 surrogate anywhere in a JSON
 * body ("invalid input syntax for type json"), which fails the whole cycle. Feed text
 * occasionally carries either; drop them rather than lose the run.
 */
const UNSAFE_JSON_CHARS = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function sanitizeText<T>(value: T): T {
  if (typeof value === 'string') return value.replace(UNSAFE_JSON_CHARS, '') as T;
  if (Array.isArray(value)) return value.map(sanitizeText) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitizeText(v)])) as T;
  }
  return value;
}

const toSourceRows = (e: TheaterEvent): SourceRow[] =>
  e.sources.map((s) => ({
    event_id: e.id, url: s.url, outlet: s.outlet,
    title: s.title ?? null, published_at: s.publishedAt ?? null,
  }));

export function makeSupabaseStore(url: string, serviceRoleKey: string): Store {
  const sb: SupabaseClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const rowToEvent = (r: any, sources: any[]): TheaterEvent => ({
    id: r.id,
    aor: r.aor,
    title: r.title,
    summary: r.summary,
    occurredAt: r.occurred_at,
    reportedAt: r.reported_at,
    category: r.category,
    affiliation: r.affiliation,
    placeName: r.place_name,
    country: r.country ?? undefined,
    lat: r.lat,
    lon: r.lon,
    precision: r.precision,
    geomValidated: r.geom_validated,
    geoConfidence: r.geo_confidence,
    confOrigin: r.conf_origin,
    confActor: r.conf_actor,
    usForcesFlag: r.us_forces_flag,
    usImpact: r.us_impact ?? undefined,
    sources: sources
      .filter((s) => s.event_id === r.id)
      .map((s) => ({ url: s.url, outlet: s.outlet, title: s.title ?? undefined, publishedAt: s.published_at ?? undefined })),
    revisions: [],
  });

  const eventToRow = (e: TheaterEvent) => ({
    id: e.id,
    aor: e.aor,
    title: e.title,
    summary: e.summary,
    occurred_at: e.occurredAt,
    reported_at: e.reportedAt,
    category: e.category,
    affiliation: e.affiliation,
    place_name: e.placeName,
    country: e.country ?? null,
    lat: e.lat,
    lon: e.lon,
    precision: e.precision,
    geom_validated: e.geomValidated,
    geo_confidence: e.geoConfidence,
    conf_origin: e.confOrigin,
    conf_actor: e.confActor,
    us_forces_flag: e.usForcesFlag,
    us_impact: e.usImpact ?? null,
  });

  return {
    async loadRecentEvents(aor, sinceIso) {
      const events: any[] = [];
      for (let from = 0; ; from += DB_PAGE_SIZE) {
        const { data, error } = await sb
          .from('events').select('*').eq('aor', aor).gte('occurred_at', sinceIso)
          .order('occurred_at', { ascending: false }).order('id', { ascending: true })
          .range(from, from + DB_PAGE_SIZE - 1);
        if (error) throw new Error(`loadRecentEvents: ${error.message}`);
        events.push(...(data ?? []));
        if ((data ?? []).length < DB_PAGE_SIZE) break;
      }
      if (events.length === 0) return [];
      const sources: any[] = [];
      for (const ids of chunk(events.map((e) => e.id), ID_QUERY_CHUNK_SIZE)) {
        const { data, error: se } = await sb.from('event_sources').select('*').in('event_id', ids);
        if (se) throw new Error(`loadRecentEvents sources: ${se.message}`);
        sources.push(...(data ?? []));
      }
      return events.map((r) => rowToEvent(r, sources));
    },

    async insertEvents(events) {
      if (events.length === 0) return;
      const { error } = await sb.from('events').insert(sanitizeText(events.map(eventToRow)));
      if (error) throw new Error(`insertEvents: ${error.message}`);
      const sourceRows = uniqueSourceRows(events.flatMap(toSourceRows));
      if (sourceRows.length > 0) {
        const { error: se } = await sb.from('event_sources')
          .upsert(sanitizeText(sourceRows), { onConflict: 'event_id,url' });
        if (se) throw new Error(`insertEvents sources: ${se.message}`);
      }
    },

    async mergeEventSources(events) {
      for (const e of events) {
        const sourceRows = uniqueSourceRows(toSourceRows(e));
        if (sourceRows.length > 0) {
          const { error } = await sb.from('event_sources')
            .upsert(sanitizeText(sourceRows), { onConflict: 'event_id,url' });
          if (error) throw new Error(`mergeEventSources: ${error.message}`);
        }
        const { error: ue } = await sb.from('events')
          .update({ conf_origin: e.confOrigin, conf_actor: e.confActor, us_forces_flag: e.usForcesFlag, updated_at: new Date().toISOString() })
          .eq('id', e.id);
        if (ue) throw new Error(`mergeEventSources update: ${ue.message}`);
      }
    },

    async nextIssueNumber(aor) {
      const { data, error } = await sb.from('issues').select('issue_number')
        .eq('aor', aor).order('issue_number', { ascending: false }).limit(1);
      if (error) throw new Error(`nextIssueNumber: ${error.message}`);
      return (data?.[0]?.issue_number ?? 0) + 1;
    },

    async publishIssue(issue, snapshot) {
      const { data, error } = await sb.from('issues').insert(sanitizeText({
        serial: issue.serial,
        aor: issue.aor,
        issue_number: issue.issueNumber,
        product_type: issue.productType,
        window_start: issue.windowStart,
        info_cutoff: issue.infoCutoff,
        published_at: issue.publishedAt,
        event_ids: issue.eventIds,
        tempo: issue.tempo,
        change_log: issue.changeLog,
        source_summary: issue.sourceSummary,
        disclaimer: issue.disclaimer,
        snapshot: snapshot,
      })).select('id').single();
      if (error) throw new Error(`publishIssue: ${error.message}`);
      return data.id;
    },

    async recordRun(run) {
      const { error } = await sb.from('ingest_runs').insert({
        aor: run.aor, finished_at: new Date().toISOString(), ok: run.ok,
        fetched: run.fetched, extracted: run.extracted, deduped: run.deduped,
        published_issue: run.publishedIssue ?? null, error: run.error ?? null,
      });
      if (error) throw new Error(`recordRun: ${error.message}`);
    },
  };
}
