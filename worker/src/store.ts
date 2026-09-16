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
      const { data: events, error } = await sb
        .from('events').select('*').eq('aor', aor).gte('occurred_at', sinceIso)
        .order('occurred_at', { ascending: false });
      if (error) throw new Error(`loadRecentEvents: ${error.message}`);
      const ids = (events ?? []).map((e) => e.id);
      if (ids.length === 0) return [];
      const { data: sources, error: se } = await sb.from('event_sources').select('*').in('event_id', ids);
      if (se) throw new Error(`loadRecentEvents sources: ${se.message}`);
      return (events ?? []).map((r) => rowToEvent(r, sources ?? []));
    },

    async insertEvents(events) {
      if (events.length === 0) return;
      const { error } = await sb.from('events').insert(events.map(eventToRow));
      if (error) throw new Error(`insertEvents: ${error.message}`);
      const sourceRows = events.flatMap((e) =>
        e.sources.map((s) => ({
          event_id: e.id, url: s.url, outlet: s.outlet,
          title: s.title ?? null, published_at: s.publishedAt ?? null,
        })),
      );
      if (sourceRows.length > 0) {
        const { error: se } = await sb.from('event_sources').upsert(sourceRows, { onConflict: 'event_id,url' });
        if (se) throw new Error(`insertEvents sources: ${se.message}`);
      }
    },

    async mergeEventSources(events) {
      for (const e of events) {
        const sourceRows = e.sources.map((s) => ({
          event_id: e.id, url: s.url, outlet: s.outlet,
          title: s.title ?? null, published_at: s.publishedAt ?? null,
        }));
        if (sourceRows.length > 0) {
          const { error } = await sb.from('event_sources').upsert(sourceRows, { onConflict: 'event_id,url' });
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
      const { data, error } = await sb.from('issues').insert({
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
      }).select('id').single();
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
