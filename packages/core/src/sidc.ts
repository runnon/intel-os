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

/**
 * Activities (set 40) entity/type codes from MIL-STD-2525E (tsv-tables/Activities.tsv).
 * Honesty over decoration: 2525E's Activities set has no icons for conventional
 * operations (no "missile strike", no "ground offensive"). Where the standard
 * defines a matching icon we use it; where it doesn't, the code stays at the
 * reserved Incident entity (110000), which renders as affiliation framing only —
 * exactly the "2525-informed framing" posture GEO-4 requires us to disclose.
 * Verified against milsymbol: 110600/110605 render true icons; 110000 does not.
 */
const ACTIVITY_CODE: Record<EventCategory, string> = {
  strike: '110605', // Incident > Explosion > Rocket Explosion (closest true icon for missile/rocket/drone strikes)
  ground: '110000', // no doctrinal icon — framing only
  maritime: '110600', // Incident > Explosion (attack on shipping renders as explosion incident)
  infrastructure: '110600', // Incident > Explosion
  'air-defense': '110000', // no doctrinal icon — framing only
  movement: '110000', // no doctrinal icon — framing only
  political: '110000', // no doctrinal icon — framing only
  other: '110000',
};

export function eventSidc(ev: Pick<TheaterEvent, 'affiliation' | 'category' | 'precision'>): string {
  const identity = IDENTITY[ev.affiliation] ?? '01';
  const symbolSet = '40';
  // Deliberate, documented adaptation: DATA-3 demands region-level reports look
  // different from confirmed points. We express that with status digit 1
  // (planned/anticipated/SUSPECTED → dashed frame). Doctrinally status describes
  // the event, not its position — accepted trade-off, disclosed in docs/symbology.
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
