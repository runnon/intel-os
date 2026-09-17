/** Core domain types for Theater Picture. Field names track Product Spec v0.1 §6. */

export const AORS = ['CENTCOM', 'EUCOM', 'INDOPACOM', 'AFRICOM', 'NORTHCOM', 'SOUTHCOM'] as const;

export type Aor = (typeof AORS)[number];

/** Actor conducting the action. DATA-4: contested/unclaimed resolves to 'unknown', never a guess. */
export type Affiliation = 'hostile' | 'friendly' | 'neutral' | 'unknown';

/** DATA-3 / spec §6: positional precision drives symbol treatment. */
export type Precision = 'point' | 'settlement' | 'region';

/** Confidence enums for origin (where) and actor (who) — DATA-5 keeps them separate. */
export type Confidence = 'high' | 'moderate' | 'low';

export type EventCategory =
  | 'strike' // missile/drone/air strike
  | 'ground' // ground combat / seizure of terrain
  | 'maritime' // attacks on or interference with shipping
  | 'infrastructure' // energy, pipelines, ports, C2 facilities
  | 'air-defense' // intercepts, AD engagements
  | 'movement' // force movements/deployments
  | 'political' // basing consent, diplomacy directly affecting posture
  | 'other';

export interface SourceRef {
  /** Resolvable reference to a specific report (DATA-1). */
  url: string;
  outlet: string;
  title?: string;
  publishedAt?: string; // ISO
  /** Reliability A–F / credibility 1–6 per ATP 2-33.4 (MIL-STD-2525E field J). */
  evaluation?: string;
  /** Social-media origin (Telegram/Bluesky/Mastodon/X). A social source is an
   *  early-warning LEAD only — an event carried solely by social sources is held
   *  unpublished until a non-social (news/official) source corroborates it. */
  social?: boolean;
}

/** True once an event has at least one non-social (news/official) source — the
 *  corroboration gate for social-media leads. Social-only events never publish. */
export function isCorroborated(sources: SourceRef[]): boolean {
  return sources.some((s) => !s.social);
}

export interface Revision {
  at: string; // ISO timestamp
  field: string;
  prior: string;
  current: string;
  note?: string;
}

export interface TheaterEvent {
  id: string;
  aor: Aor;
  title: string;
  summary: string;
  occurredAt: string; // ISO — best-known event time
  reportedAt: string; // ISO — first report time
  category: EventCategory;
  affiliation: Affiliation;
  /** Named place used for plotting. */
  placeName: string;
  country?: string;
  lat: number | null;
  lon: number | null;
  precision: Precision;
  /** DATA-2: gazetteer validation result recorded against the event. */
  geomValidated: boolean;
  geoConfidence: number; // 0..1 (AUTO-3)
  confOrigin: Confidence;
  confActor: Confidence;
  usForcesFlag: boolean;
  usImpact?: string;
  sources: SourceRef[]; // AUTO-2: dedup carries all sources
  revisions: Revision[]; // DATA-6
}

/** A published situation update (Phase 1 product type). AUTO-5: no judgement fields exist here. */
export interface SituationUpdate {
  serial: string; // e.g. SU-CEN-26-014
  aor: Aor;
  issueNumber: number;
  windowStart: string; // ISO
  infoCutoff: string; // ISO (UX-4)
  publishedAt: string;
  eventIds: string[];
  tempo: TempoMetrics;
  changeLog: ChangeLogEntry[];
  sourceSummary: SourceSummary;
  /** MARK-2 text, carried on the artifact itself. */
  disclaimer: string;
  productType: 'situation-update';
}

export interface TempoMetrics {
  totalEvents: number;
  newSinceLastIssue: number;
  byCategory: Record<string, number>;
  byAffiliation: Record<string, number>;
  usForcesEvents: number;
  unplottedEvents: number; // AUTO-3: withheld low-confidence geocodes, listed not plotted
}

export interface ChangeLogEntry {
  eventId: string;
  kind: 'new' | 'revised';
  summary: string;
}

export interface SourceSummary {
  outletCounts: Record<string, number>;
  totalSources: number;
  singleSourceEvents: number;
  statement: string;
}

export interface IngestRunResult {
  ok: boolean;
  fetched: number;
  extracted: number;
  deduped: number;
  published: boolean;
  error?: string;
}
