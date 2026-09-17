import type { Aor } from './types';
import { GAZETTEERS } from './gazetteer';

/**
 * Persistent military-installation layer: the curated bases in each theater's
 * gazetteer, always shown (independent of events) as MIL-STD-2525 installation
 * symbols, framed by operator.
 *
 * `operator` is a PUBLIC, open-source attribute (who runs / is based at the site),
 * not an assessment: `us` = significant US/coalition forces based there, `host` =
 * an allied/partner national base, `adversary` = a strategic-competitor base,
 * `unknown` = unclear. It drives the affiliation frame (friendly / neutral /
 * hostile / unknown) exactly the way 2525 installations are framed. Untagged bases
 * default to `host` — never to a US or adversary claim we haven't curated.
 */

export type BaseOperator = 'us' | 'host' | 'adversary' | 'unknown';

export interface Installation {
  name: string;
  country: string;
  lat: number;
  lon: number;
  operator: BaseOperator;
}

// Curated from public reporting. Bases not listed default to host-nation.
const BASE_OPERATOR: Record<string, BaseOperator> = {
  // US / coalition presence
  'Muwaffaq Salti Air Base': 'us',
  'Prince Hassan Air Base': 'us',
  'Al Asad Air Base': 'us',
  'Ahmed al-Jaber Air Base': 'us',
  'Ali Al Salem Air Base': 'us',
  'NSA Bahrain': 'us',
  'Sheikh Isa Air Base': 'us',
  'Al Udeid Air Base': 'us',
  'Al Minhad Air Base': 'us',
  'Al Dhafra Air Base': 'us',
  'Prince Sultan Air Base': 'us',
  'Al Tanf': 'us',
  'Ramstein Air Base': 'us',
  'Incirlik Air Base': 'us',
  'Subic Bay': 'us',
  'Osan Air Base': 'us',
  'Camp Humphreys': 'us',
  'Yokosuka': 'us',
  'Kadena Air Base': 'us',
  'Andersen Air Force Base': 'us',
  'Camp Lemonnier': 'us',
  'Norfolk': 'us',
  'Colorado Springs': 'us',
  'Eielson Air Force Base': 'us',
  'Naval Station Mayport': 'us',
  'Guantanamo Bay': 'us',
  // Allied / partner national bases
  'King Khalid Air Base': 'host',
  'Nevatim Air Base': 'host',
  'Changi Naval Base': 'host',
  'Ream Naval Base': 'host',
  // Strategic-competitor bases
  'Engels Air Base': 'adversary',
  'Yulin Naval Base': 'adversary',
};

/** Curated installations for a theater, framed by operator (default host-nation). */
export function installations(aor: Aor): Installation[] {
  return (GAZETTEERS[aor] ?? [])
    .filter((e) => e.kind === 'base')
    .map((e) => ({
      name: e.name,
      country: e.country,
      lat: e.lat,
      lon: e.lon,
      operator: BASE_OPERATOR[e.name] ?? 'host',
    }));
}
