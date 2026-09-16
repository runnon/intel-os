import type { Affiliation, EventCategory, Precision, TheaterEvent } from './types';

/**
 * MIL-STD-2525E SIDC assembly for theater events.
 * Events render from the Activities symbol set (40); see docs/symbology/README.md.
 * Positions (set A): version(2) identity(2) symbolset(2) status(1) hq(1) descriptor(2)
 * Positions (set B): entity(2) type(2) subtype(2) mod1(2) mod2(2)
 */

const VERSION = '13'; // 2525E baseline; renderers treat 13/15 identically

/** DATA-4: contested/unclaimed attribution → Unknown (1). Suspect (5) is deliberate, never a default. */
export const IDENTITY: Record<Affiliation, string> = {
  hostile: '06',
  friendly: '03',
  neutral: '04',
  unknown: '01',
};

/** Activities (set 40) entity/type codes from MIL-STD-2525E Appendix (tsv-tables/Activities.tsv). */
const ACTIVITY_CODE: Record<EventCategory, string> = {
  strike: '110600', // Incident > Explosion
  ground: '110000', // Incident (general)
  maritime: '110000',
  infrastructure: '110600',
  'air-defense': '110000',
  movement: '110000',
  political: '110000',
  other: '110000',
};

export function eventSidc(ev: Pick<TheaterEvent, 'affiliation' | 'category' | 'precision'>): string {
  const identity = IDENTITY[ev.affiliation] ?? '01';
  const symbolSet = '40';
  // status digit: region-level reporting renders as anticipated/suspected location (dashed)
  const status = ev.precision === 'region' ? '1' : '0';
  const setA = `${VERSION}0${identity[1]}${symbolSet}${status}0` + '00';
  const setB = (ACTIVITY_CODE[ev.category] ?? '110000') + '0000';
  return setA + setB;
}

/** Frame-only fallback ("2525-informed framing", spec GEO-4) for pre-milsymbol rendering. */
export type FrameShape = 'diamond' | 'rectangle' | 'square' | 'quatrefoil';

export const FRAME: Record<Affiliation, FrameShape> = {
  hostile: 'diamond',
  friendly: 'rectangle',
  neutral: 'square',
  unknown: 'quatrefoil',
};

/** MIL-STD-2525E Table XV medium luminance set (filled symbols). */
export const IDENTITY_COLOR: Record<Affiliation, string> = {
  hostile: 'rgb(255,48,49)',
  friendly: 'rgb(0,168,220)',
  neutral: 'rgb(0,226,0)',
  unknown: 'rgb(255,255,0)',
};

/** Light set for translucent fills (35% opacity per §5.5b). */
export const IDENTITY_COLOR_LIGHT: Record<Affiliation, string> = {
  hostile: 'rgb(255,128,128)',
  friendly: 'rgb(128,224,255)',
  neutral: 'rgb(170,255,170)',
  unknown: 'rgb(255,255,128)',
};
