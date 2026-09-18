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
}

export const DEFAULT_VIEW: ViewState = {
  windowHours: null,
  affiliations: [],
  categories: [],
  usOnly: false,
  confidenceFloor: 'low',
  selectedEvent: null,
};

export function encodeView(v: ViewState): URLSearchParams {
  const p = new URLSearchParams();
  if (v.windowHours != null) p.set('w', String(v.windowHours));
  if (v.affiliations.length) p.set('aff', v.affiliations.join(','));
  if (v.categories.length) p.set('cat', v.categories.join(','));
  if (v.usOnly) p.set('us', '1');
  if (v.confidenceFloor !== 'low') p.set('conf', v.confidenceFloor);
  if (v.selectedEvent) p.set('ev', v.selectedEvent);
  return p;
}

const AFFS = new Set(['hostile', 'friendly', 'neutral', 'unknown']);
const CATS = new Set(['strike', 'ground', 'maritime', 'infrastructure', 'air-defense', 'movement', 'political', 'other']);

export function decodeView(p: URLSearchParams): ViewState {
  const w = p.get('w');
  const windowHours = w != null && /^\d+$/.test(w) ? Math.min(parseInt(w, 10), 24 * 365) : null;
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
  };
}

/** Public viewers can never request an archive window through a crafted URL. */
export function enforceAccessWindow(view: ViewState, hasArchiveAccess: boolean): ViewState {
  if (hasArchiveAccess || (view.windowHours != null && view.windowHours <= 72)) return view;
  return { ...view, windowHours: 72, selectedEvent: null };
}

const CONF_ORDER = { low: 0, moderate: 1, high: 2 } as const;

export interface FilterableEvent {
  id: string;
  occurredAt: string;
  affiliation: Affiliation;
  category: EventCategory;
  usForcesFlag: boolean;
  confOrigin: 'low' | 'moderate' | 'high';
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
    return true;
  });
}
