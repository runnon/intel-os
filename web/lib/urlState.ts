import type { Affiliation, EventCategory } from '@intel-os/core';

/**
 * UX-1/UX-2: one state object drives map, list, counts and cross-references,
 * and it round-trips through the URL so an analyst can send a colleague the
 * exact picture they are looking at.
 */

export interface ViewState {
  /** hours back from the info cut-off; null = whole issue window */
  windowHours: number | null;
  affiliations: Affiliation[]; // empty = all
  categories: EventCategory[]; // empty = all
  usOnly: boolean; // deploying-unit filter (us_forces_flag)
  confidenceFloor: 'low' | 'moderate' | 'high'; // low = show everything
  selectedEvent: string | null;
  /** free-text search over title, summary, place and country; '' = no search */
  q: string;
}

/**
 * A first visit opens on the last 3 days, not the whole 30-day window: newcomers asked
 * "what happened recently?" and the full window buried it (persona review 2026-11-02).
 * "All" is encoded explicitly as w=all; a bare ?ev= link still opens the whole window so
 * an older event it points at is never filtered out.
 */
export const DEFAULT_WINDOW_HOURS = 72;

export const DEFAULT_VIEW: ViewState = {
  windowHours: DEFAULT_WINDOW_HOURS,
  affiliations: [],
  categories: [],
  usOnly: false,
  confidenceFloor: 'low',
  selectedEvent: null,
  q: '',
};

export function encodeView(v: ViewState): URLSearchParams {
  const p = new URLSearchParams();
  if (v.windowHours == null) p.set('w', 'all');
  // explicit when an event is selected, since a bare ?ev= means "whole window"
  else if (v.windowHours !== DEFAULT_WINDOW_HOURS || v.selectedEvent) p.set('w', String(v.windowHours));
  if (v.affiliations.length) p.set('aff', v.affiliations.join(','));
  if (v.categories.length) p.set('cat', v.categories.join(','));
  if (v.usOnly) p.set('us', '1');
  if (v.confidenceFloor !== 'low') p.set('conf', v.confidenceFloor);
  if (v.q.trim()) p.set('q', v.q.trim());
  if (v.selectedEvent) p.set('ev', v.selectedEvent);
  return p;
}

const AFFS = new Set(['hostile', 'friendly', 'neutral', 'unknown']);
const CATS = new Set(['strike', 'ground', 'maritime', 'infrastructure', 'air-defense', 'movement', 'political', 'other']);

export function decodeView(p: URLSearchParams): ViewState {
  const w = p.get('w');
  const windowHours =
    w != null && /^\d+$/.test(w)
      ? Math.min(parseInt(w, 10), 24 * 365)
      : w === 'all' || (w == null && p.get('ev'))
        ? null
        : DEFAULT_WINDOW_HOURS;
  const affiliations = (p.get('aff') ?? '').split(',').filter((a) => AFFS.has(a)) as Affiliation[];
  const categories = (p.get('cat') ?? '').split(',').filter((c) => CATS.has(c)) as EventCategory[];
  const conf = p.get('conf');
  return {
    windowHours,
    affiliations,
    categories,
    usOnly: p.get('us') === '1',
    confidenceFloor: conf === 'moderate' || conf === 'high' ? conf : 'low',
    selectedEvent: p.get('ev'),
    q: (p.get('q') ?? '').slice(0, 100),
  };
}

const CONF_ORDER = { low: 0, moderate: 1, high: 2 } as const;

export interface FilterableEvent {
  id: string;
  occurredAt: string;
  affiliation: Affiliation;
  category: EventCategory;
  usForcesFlag: boolean;
  confOrigin: 'low' | 'moderate' | 'high';
  title?: string;
  summary?: string;
  placeName?: string;
  country?: string;
}

/** Every search word must appear somewhere in the event's text (case-insensitive). */
export function matchesSearch(e: Pick<FilterableEvent, 'title' | 'summary' | 'placeName' | 'country'>, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = [e.title, e.summary, e.placeName, e.country].filter(Boolean).join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** Apply the view state to an event set. infoCutoff anchors the time window (UX-4). */
export function applyView<T extends FilterableEvent>(events: T[], v: ViewState, infoCutoff: string): T[] {
  const cutoffMs = new Date(infoCutoff).getTime();
  return events.filter((e) => {
    if (v.windowHours != null) {
      const t = new Date(e.occurredAt).getTime();
      if (t < cutoffMs - v.windowHours * 3_600_000 || t > cutoffMs) return false;
    }
    if (v.affiliations.length && !v.affiliations.includes(e.affiliation)) return false;
    if (v.categories.length && !v.categories.includes(e.category)) return false;
    if (v.usOnly && !e.usForcesFlag) return false;
    if (CONF_ORDER[e.confOrigin] < CONF_ORDER[v.confidenceFloor]) return false;
    if (v.q && !matchesSearch(e, v.q)) return false;
    return true;
  });
}
