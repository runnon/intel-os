import type { Aor, Precision } from './types';

/**
 * Curated CENTCOM-AOR gazetteer (DATA-2: every coordinate validates against an
 * independent gazetteer before publication). v1 is a vetted static list — entries
 * were cross-checked once, by hand, which is exactly what "independent" requires
 * at this stage; a GeoNames-backed table replaces it under the same interface.
 * AUTO-3: below GEO_CONFIDENCE_THRESHOLD an event publishes to the list with no
 * map position rather than plot at a guess.
 */

export interface GazetteerEntry {
  name: string;
  aliases: string[];
  country: string;
  lat: number;
  lon: number;
  // Point-precision infrastructure (airport/port/pipeline/refinery/nuclear/dam)
  // is treated like a base/facility: a specific named site that plots at a point.
  kind:
    | 'city'
    | 'base'
    | 'facility'
    | 'chokepoint'
    | 'island'
    | 'region'
    | 'airport'
    | 'port'
    | 'pipeline'
    | 'refinery'
    | 'nuclear'
    | 'dam';
}

export const GEO_CONFIDENCE_THRESHOLD = 0.5;

export const CENTCOM_GAZETTEER: GazetteerEntry[] = [
  // Jordan
  { name: 'Amman', aliases: [], country: 'Jordan', lat: 31.95, lon: 35.93, kind: 'city' },
  { name: 'Muwaffaq Salti Air Base', aliases: ['muwaffaq salti', 'azraq air base'], country: 'Jordan', lat: 31.826, lon: 36.782, kind: 'base' },
  { name: 'Prince Hassan Air Base', aliases: ['prince hassan ab', 'h-5'], country: 'Jordan', lat: 32.161, lon: 37.149, kind: 'base' },
  { name: 'Al Azraq', aliases: ['azraq'], country: 'Jordan', lat: 31.834, lon: 36.816, kind: 'city' },
  // Iraq
  { name: 'Baghdad', aliases: [], country: 'Iraq', lat: 33.31, lon: 44.36, kind: 'city' },
  { name: 'Basra', aliases: ['basrah'], country: 'Iraq', lat: 30.51, lon: 47.78, kind: 'city' },
  { name: 'Erbil', aliases: ['arbil', 'irbil'], country: 'Iraq', lat: 36.19, lon: 44.01, kind: 'city' },
  { name: 'Al Asad Air Base', aliases: ['ain al-asad'], country: 'Iraq', lat: 33.785, lon: 42.441, kind: 'base' },
  // Iran
  { name: 'Tehran', aliases: [], country: 'Iran', lat: 35.69, lon: 51.39, kind: 'city' },
  { name: 'Isfahan', aliases: ['esfahan'], country: 'Iran', lat: 32.65, lon: 51.67, kind: 'city' },
  { name: 'Shiraz', aliases: [], country: 'Iran', lat: 29.6, lon: 52.53, kind: 'city' },
  { name: 'Bandar Abbas', aliases: [], country: 'Iran', lat: 27.18, lon: 56.28, kind: 'city' },
  { name: 'Kuhestak', aliases: ['sirik'], country: 'Iran', lat: 26.795, lon: 57.03, kind: 'city' },
  { name: 'Natanz', aliases: [], country: 'Iran', lat: 33.72, lon: 51.72, kind: 'facility' },
  { name: 'Bushehr', aliases: [], country: 'Iran', lat: 28.97, lon: 50.84, kind: 'city' },
  // Kuwait
  { name: 'Kuwait City', aliases: [], country: 'Kuwait', lat: 29.38, lon: 47.99, kind: 'city' },
  { name: 'Ahmed al-Jaber Air Base', aliases: ['ahmad al-jaber', 'al jaber'], country: 'Kuwait', lat: 28.935, lon: 47.792, kind: 'base' },
  { name: 'Ali Al Salem Air Base', aliases: ['ali al salem'], country: 'Kuwait', lat: 29.347, lon: 47.521, kind: 'base' },
  // Bahrain
  { name: 'Manama', aliases: [], country: 'Bahrain', lat: 26.23, lon: 50.59, kind: 'city' },
  { name: 'NSA Bahrain', aliases: ['naval support activity bahrain', 'nsa juffair'], country: 'Bahrain', lat: 26.21, lon: 50.61, kind: 'base' },
  { name: 'Sheikh Isa Air Base', aliases: ['shaikh isa'], country: 'Bahrain', lat: 25.918, lon: 50.591, kind: 'base' },
  // Qatar
  { name: 'Doha', aliases: [], country: 'Qatar', lat: 25.29, lon: 51.53, kind: 'city' },
  { name: 'Al Udeid Air Base', aliases: ['al udeid'], country: 'Qatar', lat: 25.117, lon: 51.315, kind: 'base' },
  // UAE
  { name: 'Abu Dhabi', aliases: [], country: 'UAE', lat: 24.45, lon: 54.38, kind: 'city' },
  { name: 'Dubai', aliases: [], country: 'UAE', lat: 25.2, lon: 55.27, kind: 'city' },
  { name: 'Al Minhad Air Base', aliases: ['al minhad'], country: 'UAE', lat: 25.027, lon: 55.366, kind: 'base' },
  { name: 'Al Dhafra Air Base', aliases: ['al dhafra'], country: 'UAE', lat: 24.248, lon: 54.548, kind: 'base' },
  // Oman
  { name: 'Muscat', aliases: [], country: 'Oman', lat: 23.59, lon: 58.41, kind: 'city' },
  { name: 'Khasab', aliases: ['khasab waters'], country: 'Oman', lat: 26.19, lon: 56.24, kind: 'city' },
  { name: 'Duqm', aliases: [], country: 'Oman', lat: 19.65, lon: 57.71, kind: 'city' },
  // Saudi Arabia
  { name: 'Riyadh', aliases: [], country: 'Saudi Arabia', lat: 24.71, lon: 46.68, kind: 'city' },
  { name: 'Jeddah', aliases: [], country: 'Saudi Arabia', lat: 21.49, lon: 39.19, kind: 'city' },
  { name: 'Dhahran', aliases: [], country: 'Saudi Arabia', lat: 26.27, lon: 50.15, kind: 'city' },
  { name: 'Abqaiq', aliases: ['buqayq'], country: 'Saudi Arabia', lat: 25.94, lon: 49.67, kind: 'facility' },
  { name: 'Yanbu', aliases: ['yanbu al bahr'], country: 'Saudi Arabia', lat: 24.09, lon: 38.06, kind: 'facility' },
  { name: 'Jazan', aliases: ['jizan', 'gizan'], country: 'Saudi Arabia', lat: 16.89, lon: 42.57, kind: 'city' },
  { name: 'Najran', aliases: [], country: 'Saudi Arabia', lat: 17.49, lon: 44.13, kind: 'city' },
  { name: 'Abha', aliases: [], country: 'Saudi Arabia', lat: 18.22, lon: 42.51, kind: 'city' },
  { name: 'King Khalid Air Base', aliases: ['king khalid ab'], country: 'Saudi Arabia', lat: 18.297, lon: 42.803, kind: 'base' },
  { name: 'Prince Sultan Air Base', aliases: ['psab'], country: 'Saudi Arabia', lat: 24.063, lon: 47.58, kind: 'base' },
  // Yemen
  { name: 'Sanaa', aliases: ["sana'a"], country: 'Yemen', lat: 15.35, lon: 44.21, kind: 'city' },
  { name: 'Aden', aliases: [], country: 'Yemen', lat: 12.79, lon: 45.03, kind: 'city' },
  { name: 'Hodeidah', aliases: ['al hudaydah'], country: 'Yemen', lat: 14.8, lon: 42.95, kind: 'city' },
  { name: 'Mocha', aliases: ['mokha', 'al makha'], country: 'Yemen', lat: 13.32, lon: 43.25, kind: 'city' },
  { name: 'Dhubab', aliases: [], country: 'Yemen', lat: 12.94, lon: 43.42, kind: 'city' },
  { name: 'Mayyun Island', aliases: ['perim', 'mayun'], country: 'Yemen', lat: 12.66, lon: 43.42, kind: 'island' },
  { name: 'Saada', aliases: ["sa'dah"], country: 'Yemen', lat: 16.94, lon: 43.76, kind: 'city' },
  // Syria
  { name: 'Damascus', aliases: [], country: 'Syria', lat: 33.51, lon: 36.29, kind: 'city' },
  { name: 'Al Tanf', aliases: ['at tanf'], country: 'Syria', lat: 33.49, lon: 38.62, kind: 'base' },
  // Israel (CENTCOM AOR since 2021)
  { name: 'Jerusalem', aliases: [], country: 'Israel', lat: 31.78, lon: 35.21, kind: 'city' },
  { name: 'Tel Aviv', aliases: ['tel aviv-yafo'], country: 'Israel', lat: 32.08, lon: 34.78, kind: 'city' },
  { name: 'Haifa', aliases: [], country: 'Israel', lat: 32.82, lon: 34.99, kind: 'city' },
  { name: 'Beersheba', aliases: ["be'er sheva", 'beer sheva'], country: 'Israel', lat: 31.25, lon: 34.79, kind: 'city' },
  { name: 'Nevatim Air Base', aliases: ['nevatim'], country: 'Israel', lat: 31.208, lon: 35.012, kind: 'base' },
  // Palestinian Territories
  { name: 'Gaza City', aliases: ['gaza'], country: 'Palestinian Territories', lat: 31.5, lon: 34.46, kind: 'city' },
  { name: 'Rafah', aliases: [], country: 'Palestinian Territories', lat: 31.29, lon: 34.25, kind: 'city' },
  { name: 'Khan Yunis', aliases: ['khan younis'], country: 'Palestinian Territories', lat: 31.34, lon: 34.3, kind: 'city' },
  { name: 'Ramallah', aliases: [], country: 'Palestinian Territories', lat: 31.9, lon: 35.21, kind: 'city' },
  { name: 'Jenin', aliases: [], country: 'Palestinian Territories', lat: 32.46, lon: 35.3, kind: 'city' },
  { name: 'Gaza Strip', aliases: [], country: 'Palestinian Territories', lat: 31.42, lon: 34.35, kind: 'region' },
  { name: 'West Bank', aliases: [], country: 'Palestinian Territories', lat: 31.95, lon: 35.25, kind: 'region' },
  // Lebanon (Hezbollah front)
  { name: 'Beirut', aliases: [], country: 'Lebanon', lat: 33.89, lon: 35.5, kind: 'city' },
  { name: 'Tyre', aliases: ['sour'], country: 'Lebanon', lat: 33.27, lon: 35.2, kind: 'city' },
  { name: 'Sidon', aliases: ['saida'], country: 'Lebanon', lat: 33.56, lon: 35.38, kind: 'city' },
  { name: 'Nabatieh', aliases: [], country: 'Lebanon', lat: 33.38, lon: 35.48, kind: 'city' },
  { name: 'Baalbek', aliases: [], country: 'Lebanon', lat: 34.0, lon: 36.21, kind: 'city' },
  // Chokepoints / waterways
  { name: 'Strait of Hormuz', aliases: ['hormuz'], country: 'International', lat: 26.57, lon: 56.25, kind: 'chokepoint' },
  { name: 'Bab al-Mandeb', aliases: ['bab el-mandeb', 'bab al mandab'], country: 'International', lat: 12.58, lon: 43.33, kind: 'chokepoint' },
  { name: 'Red Sea', aliases: [], country: 'International', lat: 20.0, lon: 38.5, kind: 'region' },
  { name: 'Persian Gulf', aliases: ['arabian gulf'], country: 'International', lat: 26.8, lon: 51.5, kind: 'region' },
  { name: 'Gulf of Oman', aliases: [], country: 'International', lat: 24.7, lon: 58.5, kind: 'region' },
  { name: 'Gulf of Aden', aliases: [], country: 'International', lat: 12.5, lon: 47.5, kind: 'region' },
  // Country centroids (region-level fallbacks; DATA-3 renders these distinguishably)
  { name: 'Iran', aliases: [], country: 'Iran', lat: 32.4, lon: 53.7, kind: 'region' },
  { name: 'Iraq', aliases: [], country: 'Iraq', lat: 33.2, lon: 43.7, kind: 'region' },
  { name: 'Jordan', aliases: [], country: 'Jordan', lat: 31.3, lon: 36.8, kind: 'region' },
  { name: 'Saudi Arabia', aliases: [], country: 'Saudi Arabia', lat: 23.9, lon: 45.1, kind: 'region' },
  { name: 'Yemen', aliases: [], country: 'Yemen', lat: 15.6, lon: 47.9, kind: 'region' },
  { name: 'Kuwait', aliases: [], country: 'Kuwait', lat: 29.3, lon: 47.5, kind: 'region' },
  { name: 'Bahrain', aliases: [], country: 'Bahrain', lat: 26.0, lon: 50.55, kind: 'region' },
  { name: 'Qatar', aliases: [], country: 'Qatar', lat: 25.3, lon: 51.2, kind: 'region' },
  { name: 'UAE', aliases: ['united arab emirates'], country: 'UAE', lat: 23.9, lon: 54.3, kind: 'region' },
  { name: 'Oman', aliases: [], country: 'Oman', lat: 21.0, lon: 57.0, kind: 'region' },
  { name: 'Syria', aliases: [], country: 'Syria', lat: 35.0, lon: 38.5, kind: 'region' },
  { name: 'Israel', aliases: [], country: 'Israel', lat: 31.4, lon: 34.9, kind: 'region' },
  { name: 'Lebanon', aliases: [], country: 'Lebanon', lat: 33.85, lon: 35.85, kind: 'region' },
  { name: 'Palestinian Territories', aliases: ['palestine'], country: 'Palestinian Territories', lat: 31.7, lon: 35.1, kind: 'region' },
  // infrastructure / special features
  { name: 'East-West Pipeline', aliases: ['petroline', 'east-west crude pipeline', 'east west pipeline'], country: 'Saudi Arabia', lat: 25.0, lon: 45.0, kind: 'pipeline' },
  { name: 'Ras Tanura', aliases: ['ras tanura terminal'], country: 'Saudi Arabia', lat: 26.64, lon: 50.16, kind: 'refinery' },
  { name: 'Khurais', aliases: ['khurais field'], country: 'Saudi Arabia', lat: 25.12, lon: 48.09, kind: 'refinery' },
  { name: 'Jubail', aliases: ['al jubail'], country: 'Saudi Arabia', lat: 27.0, lon: 49.66, kind: 'port' },
  { name: 'Kharg Island', aliases: ['kharg terminal', 'khark island'], country: 'Iran', lat: 29.23, lon: 50.32, kind: 'refinery' },
  { name: 'Fujairah', aliases: ['fujairah terminal', 'port of fujairah'], country: 'UAE', lat: 25.12, lon: 56.33, kind: 'port' },
  { name: 'Fordow', aliases: ['fordow enrichment', 'fordo'], country: 'Iran', lat: 34.88, lon: 50.99, kind: 'nuclear' },
  { name: 'Suez Canal', aliases: ['suez'], country: 'Egypt', lat: 30.5, lon: 32.35, kind: 'chokepoint' },
  // Added 2026-10-30 from the unplotted-event audit. Every coordinate was checked
  // against OpenStreetMap Nominatim (points within 15 km, regions within 400 km).
  { name: 'Taiz', aliases: ['taizz', 'taiz city', "ta'izz"], country: 'Yemen', lat: 13.58, lon: 44.02, kind: 'city' },
  { name: 'Shabwah', aliases: ['shabwa', 'shabwah governorate'], country: 'Yemen', lat: 14.75, lon: 46.83, kind: 'region' },
  { name: 'King Khalid International Airport', aliases: ['riyadh airport', 'king khalid airport'], country: 'Saudi Arabia', lat: 24.958, lon: 46.699, kind: 'airport' },
  { name: 'Mecca', aliases: ['makkah'], country: 'Saudi Arabia', lat: 21.42, lon: 39.83, kind: 'city' },
  { name: 'Ahvaz', aliases: ['ahwaz'], country: 'Iran', lat: 31.32, lon: 48.67, kind: 'city' },
  { name: 'Minab', aliases: [], country: 'Iran', lat: 27.15, lon: 57.08, kind: 'city' },
  { name: 'Meymeh', aliases: [], country: 'Iran', lat: 33.44, lon: 51.17, kind: 'city' },
  { name: 'Qeshm Island', aliases: ['qeshm'], country: 'Iran', lat: 26.85, lon: 55.95, kind: 'island' },
  { name: 'Hebron', aliases: ['al-khalil'], country: 'Palestinian Territories', lat: 31.53, lon: 35.1, kind: 'city' },
  { name: 'Ben Gurion Airport', aliases: ['ben gurion international airport'], country: 'Israel', lat: 32, lon: 34.88, kind: 'airport' },
  { name: 'Diego Garcia', aliases: ['naval support facility diego garcia'], country: 'British Indian Ocean Territory', lat: -7.32, lon: 72.42, kind: 'base' }, // INDOPACOM AOR; listed here as the staging base CENTCOM reporting cites
  { name: 'Egypt', aliases: [], country: 'Egypt', lat: 26.8, lon: 30.8, kind: 'region' },
  { name: 'Cairo', aliases: [], country: 'Egypt', lat: 30.04, lon: 31.24, kind: 'city' },
  { name: 'Pakistan', aliases: [], country: 'Pakistan', lat: 30.4, lon: 69.3, kind: 'region' },
  { name: 'Afghanistan', aliases: [], country: 'Afghanistan', lat: 33.9, lon: 67.7, kind: 'region' },
];

export interface GeoResult {
  lat: number | null;
  lon: number | null;
  precision: Precision;
  confidence: number;
  matchedName: string | null;
  validated: boolean;
}

/**
 * A place from an authoritative open gazetteer (GeoNames, CC-BY 4.0) — the
 * "GeoNames-backed table" this module was designed to grow into. Coordinates come
 * from the dataset, never from a model (DATA-2). The worker loads the table; core
 * only consumes it through PlaceIndex so the web bundle never carries it.
 */
export interface PlaceCandidate {
  name: string;
  lat: number;
  lon: number;
  /** ISO 3166-1 alpha-2; null for international waters (seas, straits, gulfs). */
  countryCode: string | null;
  kind: 'settlement' | 'site' | 'island' | 'admin' | 'area' | 'water';
  /** Population for settlements; a coarse rank otherwise. Used only to order candidates. */
  importance: number;
}

export interface PlaceIndex {
  /** Candidates whose name or alternate name normalizes (normPlace) to `key`. */
  lookup(key: string): PlaceCandidate[];
  /** ISO alpha-2 for a country name as the gazetteer spells it, or null. */
  countryCode(country: string): string | null;
}

/** Confidence for an exact, unambiguous, country-consistent GeoNames hit: above the
 * threshold and the country fallback, below a hand-curated exact match. */
export const INDEX_MATCH_CONFIDENCE = 0.8;
/** The same, for a hit that only places the event within an area (province, sea, "near X"). */
export const INDEX_REGION_CONFIDENCE = 0.7;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The one normalization shared by the curated lists and the GeoNames index. */
export const normPlace = norm;

// Partial (non-exact) matching must be on WHOLE-WORD boundaries and must never be
// anchored by a tiny name/alias. A raw substring test let the 2-letter alias "us"
// (United States) match "US bases in the Gulf" and pin a Persian-Gulf event on the
// US geographic centroid in Kansas. Short tokens ("us", "usa", "uae") still resolve
// via the exact-match path; they just can't anchor a fuzzy substring hit.
const PARTIAL_MIN_LEN = 4;
function wordIn(haystack: string, needle: string): boolean {
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${esc}\\b`).test(haystack);
}
function partialHit(q: string, name: string): boolean {
  if (name.replace(/ /g, '').length < PARTIAL_MIN_LEN) return false; // 'us'/'usa' can't anchor
  if (wordIn(q, name)) return true; // gazetteer name appears as whole word(s) in the query
  if (q.replace(/ /g, '').length >= PARTIAL_MIN_LEN && wordIn(name, q)) return true;
  return false;
}

function precisionFor(kind: GazetteerEntry['kind']): Precision {
  if (kind === 'region') return 'region';
  if (kind === 'city' || kind === 'chokepoint') return 'settlement';
  return 'point'; // bases, facilities, islands are specific sites
}

/**
 * The extractor spells a country however its source did. Map the common variants
 * onto the gazetteer's own country names, so "Palestinian Territory" or "USA" is not
 * scored as a country MISMATCH against an entry that is in fact the same country.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  'palestine': 'palestinian territories',
  'palestinian territory': 'palestinian territories',
  'state of palestine': 'palestinian territories',
  'united arab emirates': 'uae',
  'usa': 'united states',
  'us': 'united states',
  'united states of america': 'united states',
  'uk': 'united kingdom',
  'britain': 'united kingdom',
  'great britain': 'united kingdom',
  'democratic republic of congo': 'democratic republic of the congo',
  'dr congo': 'democratic republic of the congo',
  'drc': 'democratic republic of the congo',
  'russian federation': 'russia',
  'islamic republic of iran': 'iran',
  'syrian arab republic': 'syria',
  'republic of korea': 'south korea',
  'dprk': 'north korea',
  'burma': 'myanmar',
  'turkiye': 'turkey',
  'the netherlands': 'netherlands',
  'holland': 'netherlands',
};

export function canonicalCountry(country: string): string {
  const c = norm(country);
  return COUNTRY_ALIASES[c] ?? c;
}

/**
 * Confidence for an event plotted at its country's curated centroid because the named
 * place itself is not in the gazetteer. It sits at the partial-match level: above the
 * threshold (the centroid is a curated, validated coordinate), never above a real hit.
 */
export const COUNTRY_FALLBACK_CONFIDENCE = 0.6;

/** The curated country-centroid entry: kind region, named (or aliased) for its own country. */
function countryCentroid(country: string, gaz: GazetteerEntry[]): GazetteerEntry | null {
  const c = canonicalCountry(country);
  return gaz.find((e) =>
    e.kind === 'region' &&
    canonicalCountry(e.country) === c &&
    [e.name, ...e.aliases].some((n) => canonicalCountry(n) === c),
  ) ?? null;
}

/**
 * Resolve a reported place name against the gazetteer with a confidence score.
 * Never invents coordinates: no match → nulls (event lists unplotted).
 *
 * When the place name matches NOTHING in the gazetteer but the reported country has a
 * curated centroid in this theater, the event plots at that centroid at `region`
 * precision (dashed frame, DATA-3) — the same fallback extract.ts already uses for an
 * event reported with a country and no place. A place that DOES match but conflicts
 * with the country stays unplotted: contradictory evidence is not a fallback case.
 */
/**
 * Countries (ISO 3166-1 alpha-2) in each command's area of responsibility under the
 * current Unified Command Plan (Israel → CENTCOM 2021; Greenland → NORTHCOM 2025).
 * Bounds where the open gazetteer may resolve a place: land outside the theater
 * stays withheld, as it always has.
 */
export const AOR_COUNTRIES: Record<Aor, readonly string[]> = {
  CENTCOM: ['AF', 'BH', 'EG', 'IR', 'IQ', 'IL', 'JO', 'KZ', 'KW', 'KG', 'LB', 'OM', 'PK', 'PS', 'QA', 'SA', 'SY', 'TJ', 'TM', 'AE', 'UZ', 'YE'],
  EUCOM: [
    'AD', 'AL', 'AM', 'AT', 'AX', 'AZ', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO', 'FR', 'GB', 'GE',
    'GG', 'GI', 'GR', 'HR', 'HU', 'IE', 'IM', 'IS', 'IT', 'JE', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL',
    'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SJ', 'SK', 'SM', 'TR', 'UA', 'VA', 'XK',
  ],
  AFRICOM: [
    'AO', 'BF', 'BI', 'BJ', 'BW', 'CD', 'CF', 'CG', 'CI', 'CM', 'CV', 'DJ', 'DZ', 'EH', 'ER', 'ET', 'GA', 'GH', 'GM', 'GN', 'GQ', 'GW',
    'KE', 'KM', 'LR', 'LS', 'LY', 'MA', 'MG', 'ML', 'MR', 'MU', 'MW', 'MZ', 'NA', 'NE', 'NG', 'RW', 'SC', 'SD', 'SH', 'SL', 'SN', 'SO',
    'SS', 'ST', 'SZ', 'TD', 'TG', 'TN', 'TZ', 'UG', 'ZA', 'ZM', 'ZW',
  ],
  INDOPACOM: [
    'AS', 'AU', 'BD', 'BN', 'BT', 'CK', 'CN', 'CX', 'FJ', 'FM', 'GU', 'HK', 'ID', 'IN', 'IO', 'JP', 'KH', 'KI', 'KP', 'KR', 'LA', 'LK',
    'MH', 'MM', 'MN', 'MO', 'MP', 'MV', 'MY', 'NC', 'NF', 'NP', 'NR', 'NU', 'NZ', 'PF', 'PG', 'PH', 'PN', 'PW', 'SB', 'SG', 'TH', 'TK',
    'TL', 'TO', 'TV', 'TW', 'UM', 'VN', 'VU', 'WF', 'WS',
  ],
  NORTHCOM: ['US', 'CA', 'MX', 'BS', 'PR', 'VI', 'GL', 'BM', 'PM', 'TC'],
  SOUTHCOM: [
    'AG', 'AI', 'AR', 'AW', 'BB', 'BL', 'BO', 'BQ', 'BR', 'BZ', 'CL', 'CO', 'CR', 'CU', 'CW', 'DM', 'DO', 'EC', 'FK', 'GD', 'GF', 'GP',
    'GT', 'GY', 'HN', 'HT', 'JM', 'KN', 'KY', 'LC', 'MF', 'MQ', 'MS', 'NI', 'PA', 'PE', 'PY', 'SR', 'SV', 'SX', 'TT', 'UY', 'VC', 'VE', 'VG',
  ],
};

export interface GeolocateOptions {
  /** Open-gazetteer index consulted when the curated list has no exact match. */
  index?: PlaceIndex;
  /** The theater: bounds which countries the open gazetteer may resolve into. */
  aor?: Aor;
  /** First-level admin area (province / state / oblast / governorate) the reporting
   * names; a region-precision fallback when the place itself doesn't resolve. */
  admin1?: string;
}

export function geolocate(
  placeName: string,
  country?: string,
  gaz: GazetteerEntry[] = CENTCOM_GAZETTEER,
  opts: GeolocateOptions = {},
): GeoResult {
  const q = norm(placeName);
  if (!q) return { lat: null, lon: null, precision: 'region', confidence: 0, matchedName: null, validated: false };
  const reported = country ? canonicalCountry(country) : null;

  let best: { entry: GazetteerEntry; score: number } | null = null;
  for (const entry of gaz) {
    const names = [entry.name, ...entry.aliases].map(norm);
    let score = 0;
    if (names.includes(q)) score = 0.85;
    else if (names.some((n) => partialHit(q, n))) score = 0.6;
    if (score === 0) continue;
    if (reported && canonicalCountry(entry.country) === reported) score += 0.1;
    else if (reported && entry.country !== 'International' && canonicalCountry(entry.country) !== reported) score -= 0.25;
    if (!best || score > best.score) best = { entry, score };
  }

  // Order of evidence: curated exact hit → GeoNames exact hit → curated partial hit
  // → GeoNames admin1 → curated country centroid → withheld.
  const curatedExact = best && best.score >= 0.85;
  if (!curatedExact && opts.index) {
    const hit = resolveFromIndex(placeName, country, gaz, opts.index, opts.aor);
    if (hit) return hit;
  }
  if (best && !curatedExact && best.score >= GEO_CONFIDENCE_THRESHOLD) {
    return fromCurated(best.entry, best.score);
  }
  if (!best && opts.index && opts.admin1) {
    const hit = resolveFromIndex(opts.admin1, country, gaz, opts.index, opts.aor, true);
    if (hit) return hit;
  }

  if (!best && country) {
    const centroid = countryCentroid(country, gaz);
    if (centroid) {
      return {
        lat: centroid.lat,
        lon: centroid.lon,
        precision: 'region',
        confidence: COUNTRY_FALLBACK_CONFIDENCE,
        matchedName: centroid.name,
        validated: true,
      };
    }
  }

  if (!best || best.score < GEO_CONFIDENCE_THRESHOLD) {
    return { lat: null, lon: null, precision: 'region', confidence: best?.score ?? 0, matchedName: null, validated: false };
  }
  return fromCurated(best.entry, best.score);
}

function fromCurated(entry: GazetteerEntry, score: number): GeoResult {
  return {
    lat: entry.lat,
    lon: entry.lon,
    precision: precisionFor(entry.kind),
    confidence: Math.min(score, 0.95),
    matchedName: entry.name,
    validated: true,
  };
}

// ---------------------------------------------------------------------------
// GeoNames-backed resolution
// ---------------------------------------------------------------------------

const DIRECTIONAL = /^(?:northern|southern|eastern|western|central|north|south|east|west|northeast|northwest|southeast|southwest|greater|outskirts of|near|around)\s+/;
const ADMIN_WORDS = ['governorate', 'province', 'region', 'oblast', 'state', 'district', 'prefecture', 'county', 'municipality', 'raion', 'krai', 'wilaya', 'department', 'territory'];
const ADMIN_SUFFIX = new RegExp(`\\s+(?:${[...ADMIN_WORDS, 'city'].join('|')})$`);
// "20 km north of X", "outskirts of X", "near X" — but not "Port of X" (that names X's port).
const OFFSET = /\b(?:(?:north|south|east|west|northeast|northwest|southeast|southwest)(?:ern)?|kms?|kilometres?|kilometers?|miles?|outskirts)\s+(?:of|from)\s+([a-z][a-z0-9 ]+)$|\b(?:near|outside)\s+([a-z][a-z0-9 ]+)$/;

/**
 * Name variants a report uses for one place, most literal first:
 * "Red Sea coast, Yemen" → ["red sea coast yemen", "red sea coast", "yemen"];
 * "20 km north of Kherson" → [..., "kherson"]; "Tigray region" → [..., "tigray"].
 * Each variant past the first only ever coarsens the result (see `coarse`).
 */
interface Variant { key: string; coarse: boolean; admin: boolean }
function variants(raw: string): Variant[] {
  const out: Variant[] = [];
  const add = (s: string, coarse: boolean, admin = false) => {
    const k = norm(s);
    if (k && !out.some((o) => o.key === k)) out.push({ key: k, coarse, admin });
  };
  add(raw, false);
  for (const part of raw.split(/[,;/]|\s+-\s+/)) add(part, false);
  const base = norm(raw.split(',')[0] ?? raw);
  // "Kursk region" / "Donetsk Oblast" name the province, not its capital city.
  if (ADMIN_SUFFIX.test(base)) add(base.replace(ADMIN_SUFFIX, ''), true, true);
  const offset = base.match(OFFSET);
  const near = offset?.[1] ?? offset?.[2];
  if (near) add(near.replace(ADMIN_SUFFIX, ''), true);
  if (DIRECTIONAL.test(base)) add(base.replace(DIRECTIONAL, '').replace(ADMIN_SUFFIX, ''), true);
  return out;
}

/** Countries this theater covers: its UCP list plus any with a curated centroid. */
function theaterCodes(gaz: GazetteerEntry[], index: PlaceIndex, aor?: Aor): Set<string> {
  const codes = new Set<string>(aor ? AOR_COUNTRIES[aor] : []);
  for (const e of gaz) {
    if (e.kind !== 'region') continue;
    const code = index.countryCode(e.country);
    if (code) codes.add(code);
  }
  return codes;
}

// A name shared by a town and a facility resolves to the town: claiming point
// precision needs the report to name the facility itself.
const KIND_RANK: Record<PlaceCandidate['kind'], number> = {
  settlement: 0, site: 1, island: 2, water: 3, admin: 4, area: 5,
};

function km(a: PlaceCandidate, b: PlaceCandidate): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/**
 * Exact-name lookup in the open gazetteer, constrained to the reported country (or,
 * with none reported, to this theater's countries and international waters — one
 * AOR's events never resolve against another theater's land). Returns null rather
 * than guess when two plausible same-named places are far apart (AUTO-3).
 */
function resolveFromIndex(
  raw: string,
  country: string | undefined,
  gaz: GazetteerEntry[],
  index: PlaceIndex,
  aor?: Aor,
  adminOnly = false,
): GeoResult | null {
  const code = country ? index.countryCode(country) : null;
  if (country && !code) return null; // a country we can't identify can't constrain the match
  const theater = theaterCodes(gaz, index, aor);
  // Land outside this theater never resolves, even when reported: it stays withheld.
  const allowed = code ? new Set(theater.has(code) ? [code] : []) : theater;

  for (const { key, coarse, admin } of variants(raw)) {
    if (code && index.countryCode(key) === code) continue; // the country itself → centroid path
    const areaOnly = adminOnly || admin;
    // GeoNames spells provinces "Kursk Oblast" / "Donetsk Oblast": try each admin word.
    const keys = admin ? [key, ...ADMIN_WORDS.map((w) => `${key} ${w}`)] : [key];
    const cands = [...new Set(keys.flatMap((k) => index.lookup(k)))]
      // Only seas and straits are placeless; a countryless "Middle East" is not a location.
      .filter((c) => (c.countryCode === null ? !adminOnly && c.kind === 'water' : allowed.has(c.countryCode)))
      .filter((c) => !areaOnly || c.kind === 'admin' || c.kind === 'area')
      .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || b.importance - a.importance);
    const top = cands[0];
    if (!top) continue;
    // Genuinely ambiguous → withheld: a same-named rival of comparable size, or a
    // name shared by several places (Ukraine has dozens of Oleksandrivkas) unless
    // the top hit is a major city, by its own name, that the bare name conventionally means.
    const rivals = cands.filter((c) => c !== top && c.kind === top.kind && km(c, top) > 25);
    if (rivals.some((c) => c.importance * 3 >= top.importance)) return null;
    const isMajorCity = top.kind === 'settlement' && top.importance >= 250_000 && norm(top.name) === key;
    if (rivals.length >= 2 && !isMajorCity) return null;

    const regionLevel = coarse || adminOnly || top.kind === 'admin' || top.kind === 'area' || top.kind === 'water';
    return {
      lat: top.lat,
      lon: top.lon,
      precision: regionLevel ? 'region' : top.kind === 'settlement' ? 'settlement' : 'point',
      confidence: regionLevel ? INDEX_REGION_CONFIDENCE : INDEX_MATCH_CONFIDENCE,
      matchedName: top.name,
      validated: true,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-AOR gazetteers. Same discipline as CENTCOM: hand-curated, well-known
// locations only — capitals, major cities, key bases, chokepoints, active
// conflict areas, and country centroids as region-level fallbacks.
// ---------------------------------------------------------------------------

export const EUCOM_GAZETTEER: GazetteerEntry[] = [
  // Ukraine
  { name: 'Kyiv', aliases: ['kiev'], country: 'Ukraine', lat: 50.45, lon: 30.52, kind: 'city' },
  { name: 'Kharkiv', aliases: ['kharkov'], country: 'Ukraine', lat: 49.99, lon: 36.23, kind: 'city' },
  { name: 'Odesa', aliases: ['odessa'], country: 'Ukraine', lat: 46.48, lon: 30.73, kind: 'city' },
  { name: 'Lviv', aliases: [], country: 'Ukraine', lat: 49.84, lon: 24.03, kind: 'city' },
  { name: 'Dnipro', aliases: [], country: 'Ukraine', lat: 48.47, lon: 35.04, kind: 'city' },
  { name: 'Zaporizhzhia', aliases: ['zaporozhye'], country: 'Ukraine', lat: 47.84, lon: 35.14, kind: 'city' },
  { name: 'Enerhodar', aliases: ['zaporizhzhia nuclear power plant', 'znpp'], country: 'Ukraine', lat: 47.5, lon: 34.58, kind: 'facility' },
  { name: 'Kherson', aliases: [], country: 'Ukraine', lat: 46.64, lon: 32.61, kind: 'city' },
  { name: 'Mykolaiv', aliases: ['nikolaev'], country: 'Ukraine', lat: 46.98, lon: 32.0, kind: 'city' },
  { name: 'Mariupol', aliases: [], country: 'Ukraine', lat: 47.1, lon: 37.55, kind: 'city' },
  { name: 'Donetsk', aliases: [], country: 'Ukraine', lat: 48.0, lon: 37.8, kind: 'city' },
  { name: 'Luhansk', aliases: ['lugansk'], country: 'Ukraine', lat: 48.57, lon: 39.31, kind: 'city' },
  { name: 'Bakhmut', aliases: [], country: 'Ukraine', lat: 48.59, lon: 38.0, kind: 'city' },
  { name: 'Kramatorsk', aliases: [], country: 'Ukraine', lat: 48.72, lon: 37.55, kind: 'city' },
  { name: 'Pokrovsk', aliases: [], country: 'Ukraine', lat: 48.28, lon: 37.18, kind: 'city' },
  { name: 'Sumy', aliases: [], country: 'Ukraine', lat: 50.91, lon: 34.8, kind: 'city' },
  { name: 'Sevastopol', aliases: [], country: 'Ukraine', lat: 44.6, lon: 33.52, kind: 'city' },
  { name: 'Crimea', aliases: ['crimean peninsula'], country: 'Ukraine', lat: 45.3, lon: 34.4, kind: 'region' },
  { name: 'Kerch Strait', aliases: ['kerch bridge', 'crimean bridge'], country: 'International', lat: 45.32, lon: 36.62, kind: 'chokepoint' },
  // Russia / Belarus
  { name: 'Moscow', aliases: [], country: 'Russia', lat: 55.76, lon: 37.62, kind: 'city' },
  { name: 'St Petersburg', aliases: ['saint petersburg'], country: 'Russia', lat: 59.94, lon: 30.31, kind: 'city' },
  { name: 'Belgorod', aliases: [], country: 'Russia', lat: 50.6, lon: 36.58, kind: 'city' },
  { name: 'Kursk', aliases: [], country: 'Russia', lat: 51.73, lon: 36.19, kind: 'city' },
  { name: 'Rostov-on-Don', aliases: ['rostov'], country: 'Russia', lat: 47.24, lon: 39.71, kind: 'city' },
  { name: 'Engels Air Base', aliases: ['engels-2'], country: 'Russia', lat: 51.48, lon: 46.21, kind: 'base' },
  { name: 'Kaliningrad', aliases: [], country: 'Russia', lat: 54.71, lon: 20.45, kind: 'city' },
  { name: 'Minsk', aliases: [], country: 'Belarus', lat: 53.9, lon: 27.57, kind: 'city' },
  // NATO Europe
  { name: 'Suwalki Gap', aliases: ['suwalki corridor'], country: 'International', lat: 54.3, lon: 23.0, kind: 'chokepoint' },
  { name: 'Warsaw', aliases: [], country: 'Poland', lat: 52.23, lon: 21.01, kind: 'city' },
  { name: 'Rzeszow', aliases: ['rzeszow-jasionka'], country: 'Poland', lat: 50.04, lon: 22.0, kind: 'city' },
  { name: 'Vilnius', aliases: [], country: 'Lithuania', lat: 54.69, lon: 25.28, kind: 'city' },
  { name: 'Riga', aliases: [], country: 'Latvia', lat: 56.95, lon: 24.11, kind: 'city' },
  { name: 'Tallinn', aliases: [], country: 'Estonia', lat: 59.44, lon: 24.75, kind: 'city' },
  { name: 'Helsinki', aliases: [], country: 'Finland', lat: 60.17, lon: 24.94, kind: 'city' },
  { name: 'Stockholm', aliases: [], country: 'Sweden', lat: 59.33, lon: 18.06, kind: 'city' },
  { name: 'Gotland', aliases: [], country: 'Sweden', lat: 57.5, lon: 18.5, kind: 'island' },
  { name: 'Copenhagen', aliases: [], country: 'Denmark', lat: 55.68, lon: 12.57, kind: 'city' },
  { name: 'Berlin', aliases: [], country: 'Germany', lat: 52.52, lon: 13.4, kind: 'city' },
  { name: 'Ramstein Air Base', aliases: ['ramstein'], country: 'Germany', lat: 49.44, lon: 7.6, kind: 'base' },
  { name: 'Paris', aliases: [], country: 'France', lat: 48.86, lon: 2.35, kind: 'city' },
  { name: 'London', aliases: [], country: 'United Kingdom', lat: 51.51, lon: -0.13, kind: 'city' },
  { name: 'Brussels', aliases: [], country: 'Belgium', lat: 50.85, lon: 4.35, kind: 'city' },
  { name: 'Bucharest', aliases: [], country: 'Romania', lat: 44.43, lon: 26.1, kind: 'city' },
  { name: 'Constanta', aliases: [], country: 'Romania', lat: 44.17, lon: 28.65, kind: 'city' },
  { name: 'Chisinau', aliases: [], country: 'Moldova', lat: 47.01, lon: 28.86, kind: 'city' },
  { name: 'Tiraspol', aliases: ['transnistria'], country: 'Moldova', lat: 46.84, lon: 29.62, kind: 'city' },
  { name: 'Ankara', aliases: [], country: 'Turkey', lat: 39.93, lon: 32.86, kind: 'city' },
  { name: 'Istanbul', aliases: [], country: 'Turkey', lat: 41.01, lon: 28.98, kind: 'city' },
  { name: 'Bosphorus', aliases: ['bosporus strait'], country: 'International', lat: 41.12, lon: 29.05, kind: 'chokepoint' },
  { name: 'Incirlik Air Base', aliases: ['incirlik'], country: 'Turkey', lat: 37.0, lon: 35.43, kind: 'base' },
  { name: 'Black Sea', aliases: [], country: 'International', lat: 43.5, lon: 34.0, kind: 'region' },
  { name: 'Baltic Sea', aliases: [], country: 'International', lat: 58.0, lon: 20.0, kind: 'region' },
  // country centroids
  { name: 'Ukraine', aliases: [], country: 'Ukraine', lat: 49.0, lon: 31.5, kind: 'region' },
  { name: 'Russia', aliases: [], country: 'Russia', lat: 55.0, lon: 45.0, kind: 'region' },
  { name: 'Belarus', aliases: [], country: 'Belarus', lat: 53.7, lon: 28.0, kind: 'region' },
  { name: 'Poland', aliases: [], country: 'Poland', lat: 52.1, lon: 19.4, kind: 'region' },
  { name: 'Romania', aliases: [], country: 'Romania', lat: 45.9, lon: 25.0, kind: 'region' },
  { name: 'Germany', aliases: [], country: 'Germany', lat: 51.2, lon: 10.4, kind: 'region' },
  { name: 'Moldova', aliases: [], country: 'Moldova', lat: 47.2, lon: 28.5, kind: 'region' },
  { name: 'Turkey', aliases: [], country: 'Turkey', lat: 39.0, lon: 35.0, kind: 'region' },
  { name: 'Finland', aliases: [], country: 'Finland', lat: 64.0, lon: 26.0, kind: 'region' },
  { name: 'Sweden', aliases: [], country: 'Sweden', lat: 62.0, lon: 15.0, kind: 'region' },
  { name: 'Lithuania', aliases: [], country: 'Lithuania', lat: 55.2, lon: 23.9, kind: 'region' },
  { name: 'Latvia', aliases: [], country: 'Latvia', lat: 56.9, lon: 24.6, kind: 'region' },
  { name: 'Estonia', aliases: [], country: 'Estonia', lat: 58.7, lon: 25.0, kind: 'region' },
  { name: 'United Kingdom', aliases: ['uk', 'britain'], country: 'United Kingdom', lat: 54.0, lon: -2.0, kind: 'region' },
  { name: 'France', aliases: [], country: 'France', lat: 46.6, lon: 2.5, kind: 'region' },
  { name: 'Norway', aliases: [], country: 'Norway', lat: 64.5, lon: 11.0, kind: 'region' },
  { name: 'Netherlands', aliases: ['the netherlands', 'holland'], country: 'Netherlands', lat: 52.2, lon: 5.3, kind: 'region' },
  { name: 'Denmark', aliases: [], country: 'Denmark', lat: 56.0, lon: 10.0, kind: 'region' },
  { name: 'Italy', aliases: [], country: 'Italy', lat: 42.8, lon: 12.8, kind: 'region' },
  { name: 'Sicily', aliases: [], country: 'Italy', lat: 37.6, lon: 14.2, kind: 'region' },
  { name: 'Spain', aliases: [], country: 'Spain', lat: 40.2, lon: -3.7, kind: 'region' },
  // infrastructure / special features
  { name: 'Nord Stream', aliases: ['nord stream 1', 'nord stream 2', 'nordstream'], country: 'International', lat: 55.5, lon: 15.6, kind: 'pipeline' },
  { name: 'Druzhba Pipeline', aliases: ['druzhba', 'friendship pipeline'], country: 'International', lat: 52.1, lon: 24.0, kind: 'pipeline' },
  { name: 'TurkStream', aliases: ['turk stream'], country: 'International', lat: 43.2, lon: 32.0, kind: 'pipeline' },
  { name: 'Novorossiysk', aliases: ['novorossiysk port'], country: 'Russia', lat: 44.72, lon: 37.77, kind: 'port' },
  { name: 'Ust-Luga', aliases: ['ust luga'], country: 'Russia', lat: 59.67, lon: 28.4, kind: 'port' },
  { name: 'Primorsk', aliases: ['primorsk terminal'], country: 'Russia', lat: 60.35, lon: 28.6, kind: 'refinery' },
  { name: 'Belbek Air Base', aliases: ['belbek'], country: 'Ukraine', lat: 44.69, lon: 33.57, kind: 'airport' },
  // Added 2026-10-30 from the unplotted-event audit. Every coordinate was checked
  // against OpenStreetMap Nominatim (points within 15 km, regions within 400 km).
  { name: 'Oleshky', aliases: ['oleshki', 'tsiurupynsk'], country: 'Ukraine', lat: 46.62, lon: 32.72, kind: 'city' },
  { name: 'Chernihiv', aliases: ['chernigov'], country: 'Ukraine', lat: 51.49, lon: 31.29, kind: 'city' },
  { name: 'Chornomorsk', aliases: ['chornomorsk port', 'illichivsk'], country: 'Ukraine', lat: 46.3, lon: 30.66, kind: 'port' },
  { name: 'Slavutych', aliases: [], country: 'Ukraine', lat: 51.52, lon: 30.75, kind: 'city' },
  { name: 'Lyman', aliases: ['lyman city'], country: 'Ukraine', lat: 48.99, lon: 37.81, kind: 'city' },
  { name: 'Zhytomyr', aliases: [], country: 'Ukraine', lat: 50.25, lon: 28.66, kind: 'city' },
  { name: 'Rivne', aliases: ['rovno'], country: 'Ukraine', lat: 50.62, lon: 26.25, kind: 'city' },
  { name: 'Lutsk', aliases: [], country: 'Ukraine', lat: 50.75, lon: 25.34, kind: 'city' },
  { name: 'Lozova', aliases: [], country: 'Ukraine', lat: 48.89, lon: 36.32, kind: 'city' },
  { name: 'Mayaky', aliases: [], country: 'Ukraine', lat: 46.41, lon: 30.27, kind: 'city' },
  { name: 'Voronezh', aliases: [], country: 'Russia', lat: 51.67, lon: 39.2, kind: 'city' },
  { name: 'Sochi', aliases: [], country: 'Russia', lat: 43.6, lon: 39.73, kind: 'city' },
  { name: 'Zeebrugge', aliases: ['port of zeebrugge'], country: 'Belgium', lat: 51.33, lon: 3.2, kind: 'port' },
  { name: 'Lanester', aliases: [], country: 'France', lat: 47.76, lon: -3.34, kind: 'city' },
  { name: 'Limoges', aliases: [], country: 'France', lat: 45.83, lon: 1.26, kind: 'city' },
  { name: 'Tirana', aliases: [], country: 'Albania', lat: 41.33, lon: 19.82, kind: 'city' },
  { name: 'Athens', aliases: ['acropolis'], country: 'Greece', lat: 37.98, lon: 23.73, kind: 'city' },
  { name: 'RAF Fairford', aliases: ['fairford'], country: 'United Kingdom', lat: 51.68, lon: -1.79, kind: 'base' },
  { name: 'Landstuhl Regional Medical Center', aliases: ['landstuhl'], country: 'Germany', lat: 49.4, lon: 7.56, kind: 'facility' },
  { name: 'Belgium', aliases: [], country: 'Belgium', lat: 50.64, lon: 4.67, kind: 'region' },
  { name: 'Serbia', aliases: [], country: 'Serbia', lat: 44, lon: 20.9, kind: 'region' },
  { name: 'Bulgaria', aliases: [], country: 'Bulgaria', lat: 42.7, lon: 25.4, kind: 'region' },
  { name: 'Albania', aliases: [], country: 'Albania', lat: 41.15, lon: 20.17, kind: 'region' },
  { name: 'Greece', aliases: [], country: 'Greece', lat: 39.07, lon: 21.82, kind: 'region' },
  { name: 'Switzerland', aliases: [], country: 'Switzerland', lat: 46.8, lon: 8.23, kind: 'region' },
];

export const INDOPACOM_GAZETTEER: GazetteerEntry[] = [
  // Taiwan
  { name: 'Taipei', aliases: [], country: 'Taiwan', lat: 25.03, lon: 121.57, kind: 'city' },
  { name: 'Hsinchu', aliases: [], country: 'Taiwan', lat: 24.8, lon: 120.97, kind: 'city' },
  { name: 'Kaohsiung', aliases: [], country: 'Taiwan', lat: 22.62, lon: 120.31, kind: 'city' },
  { name: 'Taiwan Strait', aliases: [], country: 'International', lat: 24.5, lon: 119.5, kind: 'chokepoint' },
  { name: 'Kinmen', aliases: ['quemoy'], country: 'Taiwan', lat: 24.44, lon: 118.32, kind: 'island' },
  // China
  { name: 'Beijing', aliases: [], country: 'China', lat: 39.9, lon: 116.4, kind: 'city' },
  { name: 'Shanghai', aliases: [], country: 'China', lat: 31.23, lon: 121.47, kind: 'city' },
  { name: 'Fujian', aliases: [], country: 'China', lat: 26.0, lon: 118.3, kind: 'region' },
  { name: 'Guangzhou', aliases: [], country: 'China', lat: 23.13, lon: 113.26, kind: 'city' },
  { name: 'Hainan', aliases: [], country: 'China', lat: 19.2, lon: 109.7, kind: 'region' },
  // South China Sea
  { name: 'South China Sea', aliases: [], country: 'International', lat: 12.0, lon: 114.0, kind: 'region' },
  { name: 'Scarborough Shoal', aliases: [], country: 'International', lat: 15.15, lon: 117.77, kind: 'island' },
  { name: 'Second Thomas Shoal', aliases: ['ayungin shoal'], country: 'International', lat: 9.73, lon: 115.87, kind: 'island' },
  { name: 'Mischief Reef', aliases: [], country: 'International', lat: 9.9, lon: 115.53, kind: 'island' },
  { name: 'Spratly Islands', aliases: ['spratlys'], country: 'International', lat: 10.0, lon: 114.0, kind: 'region' },
  { name: 'Paracel Islands', aliases: ['paracels'], country: 'International', lat: 16.5, lon: 112.0, kind: 'region' },
  { name: 'Luzon Strait', aliases: ['bashi channel'], country: 'International', lat: 20.5, lon: 121.0, kind: 'chokepoint' },
  { name: 'Strait of Malacca', aliases: ['malacca strait'], country: 'International', lat: 3.0, lon: 100.5, kind: 'chokepoint' },
  // Philippines / SE Asia
  { name: 'Manila', aliases: [], country: 'Philippines', lat: 14.6, lon: 120.98, kind: 'city' },
  { name: 'Subic Bay', aliases: [], country: 'Philippines', lat: 14.79, lon: 120.28, kind: 'base' },
  { name: 'Palawan', aliases: [], country: 'Philippines', lat: 9.8, lon: 118.7, kind: 'region' },
  { name: 'Hanoi', aliases: [], country: 'Vietnam', lat: 21.03, lon: 105.85, kind: 'city' },
  { name: 'Singapore', aliases: [], country: 'Singapore', lat: 1.35, lon: 103.82, kind: 'city' },
  { name: 'Jakarta', aliases: [], country: 'Indonesia', lat: -6.21, lon: 106.85, kind: 'city' },
  { name: 'Bangkok', aliases: [], country: 'Thailand', lat: 13.76, lon: 100.5, kind: 'city' },
  // Koreas
  { name: 'Seoul', aliases: [], country: 'South Korea', lat: 37.57, lon: 126.98, kind: 'city' },
  { name: 'Pyongyang', aliases: [], country: 'North Korea', lat: 39.03, lon: 125.75, kind: 'city' },
  { name: 'Osan Air Base', aliases: ['osan'], country: 'South Korea', lat: 37.09, lon: 127.03, kind: 'base' },
  { name: 'Camp Humphreys', aliases: ['pyeongtaek'], country: 'South Korea', lat: 36.96, lon: 127.03, kind: 'base' },
  { name: 'Panmunjom', aliases: ['dmz', 'joint security area'], country: 'International', lat: 37.96, lon: 126.68, kind: 'facility' },
  // Japan / Pacific
  { name: 'Tokyo', aliases: [], country: 'Japan', lat: 35.68, lon: 139.69, kind: 'city' },
  { name: 'Yokosuka', aliases: [], country: 'Japan', lat: 35.28, lon: 139.67, kind: 'base' },
  { name: 'Okinawa', aliases: [], country: 'Japan', lat: 26.33, lon: 127.8, kind: 'region' },
  { name: 'Kadena Air Base', aliases: ['kadena'], country: 'Japan', lat: 26.36, lon: 127.77, kind: 'base' },
  { name: 'Senkaku Islands', aliases: ['diaoyu islands'], country: 'International', lat: 25.75, lon: 123.47, kind: 'island' },
  { name: 'Guam', aliases: [], country: 'United States', lat: 13.44, lon: 144.79, kind: 'island' },
  { name: 'Andersen Air Force Base', aliases: ['andersen afb'], country: 'United States', lat: 13.58, lon: 144.92, kind: 'base' },
  // South Asia / Oceania
  { name: 'New Delhi', aliases: ['delhi'], country: 'India', lat: 28.61, lon: 77.21, kind: 'city' },
  { name: 'Ladakh', aliases: ['line of actual control', 'lac'], country: 'India', lat: 34.2, lon: 77.6, kind: 'region' },
  { name: 'Darwin', aliases: [], country: 'Australia', lat: -12.46, lon: 130.84, kind: 'city' },
  { name: 'Canberra', aliases: [], country: 'Australia', lat: -35.28, lon: 149.13, kind: 'city' },
  // country centroids
  { name: 'China', aliases: [], country: 'China', lat: 35.0, lon: 105.0, kind: 'region' },
  { name: 'Taiwan', aliases: [], country: 'Taiwan', lat: 23.7, lon: 121.0, kind: 'region' },
  { name: 'Japan', aliases: [], country: 'Japan', lat: 36.2, lon: 138.2, kind: 'region' },
  { name: 'Philippines', aliases: [], country: 'Philippines', lat: 12.9, lon: 121.8, kind: 'region' },
  { name: 'South Korea', aliases: [], country: 'South Korea', lat: 36.5, lon: 127.8, kind: 'region' },
  { name: 'North Korea', aliases: [], country: 'North Korea', lat: 40.3, lon: 127.4, kind: 'region' },
  { name: 'Vietnam', aliases: [], country: 'Vietnam', lat: 16.0, lon: 107.8, kind: 'region' },
  { name: 'India', aliases: [], country: 'India', lat: 22.0, lon: 79.0, kind: 'region' },
  { name: 'Australia', aliases: [], country: 'Australia', lat: -25.3, lon: 133.8, kind: 'region' },
  { name: 'Indonesia', aliases: [], country: 'Indonesia', lat: -2.5, lon: 118.0, kind: 'region' },
  // infrastructure / special features
  { name: 'Yulin Naval Base', aliases: ['yulin', 'longpo'], country: 'China', lat: 18.23, lon: 109.69, kind: 'base' },
  { name: 'Ream Naval Base', aliases: ['ream'], country: 'Cambodia', lat: 10.51, lon: 103.61, kind: 'base' },
  { name: 'Power of Siberia', aliases: ['power of siberia pipeline'], country: 'International', lat: 50.3, lon: 127.5, kind: 'pipeline' },
  { name: 'Ningbo-Zhoushan Port', aliases: ['ningbo', 'zhoushan'], country: 'China', lat: 29.87, lon: 122.0, kind: 'port' },
  { name: 'Changi Naval Base', aliases: ['changi'], country: 'Singapore', lat: 1.32, lon: 103.99, kind: 'base' },
  // Added 2026-10-30 from the unplotted-event audit. Every coordinate was checked
  // against OpenStreetMap Nominatim (points within 15 km, regions within 400 km).
  { name: 'Diego Garcia', aliases: ['naval support facility diego garcia'], country: 'British Indian Ocean Territory', lat: -7.32, lon: 72.42, kind: 'base' },
  { name: 'Misawa Air Base', aliases: ['misawa'], country: 'Japan', lat: 40.7, lon: 141.37, kind: 'base' },
  { name: 'Torii Station', aliases: [], country: 'Japan', lat: 26.37, lon: 127.74, kind: 'base' },
  { name: 'Iruma Air Base', aliases: ['iruma'], country: 'Japan', lat: 35.84, lon: 139.41, kind: 'base' },
  { name: 'Ishigaki Island', aliases: ['ishigaki'], country: 'Japan', lat: 24.4, lon: 124.18, kind: 'island' },
  { name: 'Dongsha Islands', aliases: ['pratas islands', 'pratas'], country: 'Taiwan', lat: 20.7, lon: 116.72, kind: 'island' },
  { name: 'HMAS Stirling', aliases: ['garden island'], country: 'Australia', lat: -32.24, lon: 115.69, kind: 'base' },
  { name: 'Auli', aliases: [], country: 'India', lat: 30.53, lon: 79.57, kind: 'city' },
  { name: 'Java Sea', aliases: [], country: 'International', lat: -5.5, lon: 111, kind: 'region' },
  { name: 'Phnom Penh', aliases: [], country: 'Cambodia', lat: 11.56, lon: 104.92, kind: 'city' },
  { name: 'Myanmar', aliases: ['burma'], country: 'Myanmar', lat: 21.9, lon: 95.96, kind: 'region' },
  { name: 'Thailand', aliases: [], country: 'Thailand', lat: 15.87, lon: 100.99, kind: 'region' },
  { name: 'Malaysia', aliases: [], country: 'Malaysia', lat: 4.21, lon: 101.98, kind: 'region' },
  { name: 'Nepal', aliases: [], country: 'Nepal', lat: 28.39, lon: 84.12, kind: 'region' },
  { name: 'Cambodia', aliases: [], country: 'Cambodia', lat: 12.57, lon: 104.99, kind: 'region' },
  { name: 'Sri Lanka', aliases: [], country: 'Sri Lanka', lat: 7.87, lon: 80.77, kind: 'region' },
  { name: 'Laos', aliases: [], country: 'Laos', lat: 19.86, lon: 102.5, kind: 'region' },
];

export const AFRICOM_GAZETTEER: GazetteerEntry[] = [
  { name: 'Djibouti City', aliases: [], country: 'Djibouti', lat: 11.59, lon: 43.15, kind: 'city' },
  { name: 'Camp Lemonnier', aliases: [], country: 'Djibouti', lat: 11.54, lon: 43.15, kind: 'base' },
  { name: 'Mogadishu', aliases: [], country: 'Somalia', lat: 2.05, lon: 45.32, kind: 'city' },
  { name: 'Kismayo', aliases: [], country: 'Somalia', lat: -0.36, lon: 42.55, kind: 'city' },
  { name: 'Addis Ababa', aliases: [], country: 'Ethiopia', lat: 9.02, lon: 38.75, kind: 'city' },
  { name: 'Asmara', aliases: [], country: 'Eritrea', lat: 15.34, lon: 38.93, kind: 'city' },
  { name: 'Khartoum', aliases: [], country: 'Sudan', lat: 15.55, lon: 32.53, kind: 'city' },
  { name: 'Port Sudan', aliases: [], country: 'Sudan', lat: 19.62, lon: 37.22, kind: 'city' },
  { name: 'El Fasher', aliases: ['al-fashir'], country: 'Sudan', lat: 13.63, lon: 25.35, kind: 'city' },
  { name: 'Darfur', aliases: [], country: 'Sudan', lat: 13.0, lon: 25.0, kind: 'region' },
  { name: 'Juba', aliases: [], country: 'South Sudan', lat: 4.85, lon: 31.58, kind: 'city' },
  { name: "N'Djamena", aliases: ['ndjamena'], country: 'Chad', lat: 12.11, lon: 15.04, kind: 'city' },
  { name: 'Niamey', aliases: [], country: 'Niger', lat: 13.51, lon: 2.11, kind: 'city' },
  { name: 'Agadez', aliases: [], country: 'Niger', lat: 16.97, lon: 7.99, kind: 'city' },
  { name: 'Bamako', aliases: [], country: 'Mali', lat: 12.64, lon: -8.0, kind: 'city' },
  { name: 'Gao', aliases: [], country: 'Mali', lat: 16.27, lon: -0.04, kind: 'city' },
  { name: 'Timbuktu', aliases: ['tombouctou'], country: 'Mali', lat: 16.77, lon: -3.01, kind: 'city' },
  { name: 'Ouagadougou', aliases: [], country: 'Burkina Faso', lat: 12.37, lon: -1.53, kind: 'city' },
  { name: 'Abuja', aliases: [], country: 'Nigeria', lat: 9.06, lon: 7.49, kind: 'city' },
  { name: 'Lagos', aliases: [], country: 'Nigeria', lat: 6.52, lon: 3.38, kind: 'city' },
  { name: 'Maiduguri', aliases: [], country: 'Nigeria', lat: 11.83, lon: 13.15, kind: 'city' },
  { name: 'Tripoli', aliases: [], country: 'Libya', lat: 32.89, lon: 13.19, kind: 'city' },
  { name: 'Benghazi', aliases: [], country: 'Libya', lat: 32.12, lon: 20.07, kind: 'city' },
  { name: 'Tunis', aliases: [], country: 'Tunisia', lat: 36.81, lon: 10.18, kind: 'city' },
  { name: 'Algiers', aliases: [], country: 'Algeria', lat: 36.75, lon: 3.06, kind: 'city' },
  { name: 'Kinshasa', aliases: [], country: 'DRC', lat: -4.32, lon: 15.31, kind: 'city' },
  { name: 'Goma', aliases: [], country: 'DRC', lat: -1.66, lon: 29.22, kind: 'city' },
  { name: 'Bukavu', aliases: [], country: 'DRC', lat: -2.51, lon: 28.86, kind: 'city' },
  { name: 'Kigali', aliases: [], country: 'Rwanda', lat: -1.95, lon: 30.06, kind: 'city' },
  { name: 'Kampala', aliases: [], country: 'Uganda', lat: 0.35, lon: 32.58, kind: 'city' },
  { name: 'Nairobi', aliases: [], country: 'Kenya', lat: -1.29, lon: 36.82, kind: 'city' },
  { name: 'Cabo Delgado', aliases: [], country: 'Mozambique', lat: -12.3, lon: 39.3, kind: 'region' },
  { name: 'Maputo', aliases: [], country: 'Mozambique', lat: -25.97, lon: 32.58, kind: 'city' },
  { name: 'Gulf of Guinea', aliases: [], country: 'International', lat: 2.0, lon: 2.0, kind: 'region' },
  { name: 'Sahel', aliases: [], country: 'International', lat: 15.0, lon: 0.0, kind: 'region' },
  // country centroids
  { name: 'Somalia', aliases: [], country: 'Somalia', lat: 5.2, lon: 46.2, kind: 'region' },
  { name: 'Ethiopia', aliases: [], country: 'Ethiopia', lat: 9.1, lon: 40.5, kind: 'region' },
  { name: 'Sudan', aliases: [], country: 'Sudan', lat: 15.5, lon: 30.0, kind: 'region' },
  { name: 'South Sudan', aliases: [], country: 'South Sudan', lat: 7.3, lon: 30.3, kind: 'region' },
  { name: 'Chad', aliases: [], country: 'Chad', lat: 15.4, lon: 18.7, kind: 'region' },
  { name: 'Niger', aliases: [], country: 'Niger', lat: 17.6, lon: 8.1, kind: 'region' },
  { name: 'Mali', aliases: [], country: 'Mali', lat: 17.6, lon: -4.0, kind: 'region' },
  { name: 'Burkina Faso', aliases: [], country: 'Burkina Faso', lat: 12.2, lon: -1.6, kind: 'region' },
  { name: 'Nigeria', aliases: [], country: 'Nigeria', lat: 9.1, lon: 8.7, kind: 'region' },
  { name: 'Libya', aliases: [], country: 'Libya', lat: 27.0, lon: 17.0, kind: 'region' },
  { name: 'DRC', aliases: ['democratic republic of the congo', 'democratic republic of congo', 'dr congo', 'congo'], country: 'Democratic Republic of Congo', lat: -2.9, lon: 23.6, kind: 'region' },
  { name: 'Eastern DRC', aliases: ['eastern congo', 'north kivu', 'south kivu'], country: 'Democratic Republic of Congo', lat: -2.0, lon: 28.5, kind: 'region' },
  { name: 'Johannesburg', aliases: [], country: 'South Africa', lat: -26.2, lon: 28.05, kind: 'city' },
  { name: 'South Africa', aliases: [], country: 'South Africa', lat: -29.0, lon: 25.1, kind: 'region' },
  { name: 'Kenya', aliases: [], country: 'Kenya', lat: 0.4, lon: 37.9, kind: 'region' },
  { name: 'Mozambique', aliases: [], country: 'Mozambique', lat: -18.7, lon: 35.5, kind: 'region' },
  // infrastructure / special features
  { name: 'Es Sider', aliases: ['es sider terminal', 'sidra'], country: 'Libya', lat: 30.64, lon: 18.35, kind: 'refinery' },
  { name: 'Ras Lanuf', aliases: ['ras lanuf terminal'], country: 'Libya', lat: 30.5, lon: 18.53, kind: 'refinery' },
  { name: 'Sharara Oilfield', aliases: ['sharara'], country: 'Libya', lat: 27.85, lon: 12.5, kind: 'refinery' },
  { name: 'Mombasa Port', aliases: ['mombasa'], country: 'Kenya', lat: -4.04, lon: 39.67, kind: 'port' },
  { name: 'East African Crude Oil Pipeline', aliases: ['eacop'], country: 'International', lat: -2.5, lon: 33.0, kind: 'pipeline' },
  // Added 2026-10-30 from the unplotted-event audit. Every coordinate was checked
  // against OpenStreetMap Nominatim (points within 15 km, regions within 400 km).
  { name: 'Tigray', aliases: ['tigray region'], country: 'Ethiopia', lat: 14, lon: 38.9, kind: 'region' },
  { name: 'Amhara Region', aliases: ['amhara'], country: 'Ethiopia', lat: 11.6, lon: 38, kind: 'region' },
  { name: 'Mekelle', aliases: ['mekele', 'makelle'], country: 'Ethiopia', lat: 13.5, lon: 39.47, kind: 'city' },
  { name: 'Mekelle Airport', aliases: ['alula aba nega airport'], country: 'Ethiopia', lat: 13.47, lon: 39.53, kind: 'airport' },
  { name: 'Adigrat', aliases: [], country: 'Ethiopia', lat: 14.28, lon: 39.46, kind: 'city' },
  { name: 'Adwa', aliases: ['adua'], country: 'Ethiopia', lat: 14.16, lon: 38.9, kind: 'city' },
  { name: 'Nyala', aliases: [], country: 'Sudan', lat: 12.05, lon: 24.88, kind: 'city' },
  { name: 'El Obeid', aliases: ['al-ubayyid', 'el-obeid'], country: 'Sudan', lat: 13.18, lon: 30.22, kind: 'city' },
  { name: 'Tawila', aliases: [], country: 'Sudan', lat: 13.48, lon: 24.95, kind: 'city' },
  { name: 'Abyei', aliases: [], country: 'International', lat: 9.59, lon: 28.44, kind: 'city' }, // disputed: Sudan / South Sudan
  { name: 'Blue Nile State', aliases: ['blue nile'], country: 'Sudan', lat: 11.3, lon: 34.1, kind: 'region' },
  { name: 'Baidoa', aliases: [], country: 'Somalia', lat: 3.11, lon: 43.65, kind: 'city' },
  { name: 'Obock', aliases: [], country: 'Djibouti', lat: 11.97, lon: 43.29, kind: 'city' },
  { name: 'Durban', aliases: [], country: 'South Africa', lat: -29.86, lon: 31.03, kind: 'city' },
  { name: 'Ituri', aliases: ['ituri province'], country: 'Democratic Republic of the Congo', lat: 1.6, lon: 29.4, kind: 'region' },
  { name: 'Butembo', aliases: [], country: 'Democratic Republic of the Congo', lat: 0.14, lon: 29.29, kind: 'city' },
  { name: 'Morocco', aliases: [], country: 'Morocco', lat: 32, lon: -5, kind: 'region' },
  { name: 'Algeria', aliases: [], country: 'Algeria', lat: 28, lon: 3, kind: 'region' },
  { name: 'Tunisia', aliases: [], country: 'Tunisia', lat: 34, lon: 9.5, kind: 'region' },
  { name: 'Central African Republic', aliases: ['car'], country: 'Central African Republic', lat: 6.6, lon: 20.9, kind: 'region' },
  { name: 'Rwanda', aliases: [], country: 'Rwanda', lat: -1.94, lon: 29.87, kind: 'region' },
  { name: 'Uganda', aliases: [], country: 'Uganda', lat: 1.37, lon: 32.29, kind: 'region' },
  { name: 'Djibouti', aliases: [], country: 'Djibouti', lat: 11.83, lon: 42.59, kind: 'region' },
  { name: 'Cameroon', aliases: [], country: 'Cameroon', lat: 5.7, lon: 12.4, kind: 'region' },
  { name: 'Mauritius', aliases: [], country: 'Mauritius', lat: -20.2, lon: 57.5, kind: 'region' },
];

export const NORTHCOM_GAZETTEER: GazetteerEntry[] = [
  { name: 'Washington DC', aliases: ['washington, d.c.', 'washington'], country: 'United States', lat: 38.9, lon: -77.04, kind: 'city' },
  { name: 'New York', aliases: ['new york city'], country: 'United States', lat: 40.71, lon: -74.01, kind: 'city' },
  { name: 'Los Angeles', aliases: [], country: 'United States', lat: 34.05, lon: -118.24, kind: 'city' },
  { name: 'San Diego', aliases: [], country: 'United States', lat: 32.72, lon: -117.16, kind: 'city' },
  { name: 'Norfolk', aliases: ['naval station norfolk'], country: 'United States', lat: 36.85, lon: -76.29, kind: 'base' },
  { name: 'Colorado Springs', aliases: ['norad', 'peterson sfb'], country: 'United States', lat: 38.83, lon: -104.82, kind: 'base' },
  { name: 'Anchorage', aliases: [], country: 'United States', lat: 61.22, lon: -149.9, kind: 'city' },
  { name: 'Eielson Air Force Base', aliases: ['eielson afb'], country: 'United States', lat: 64.67, lon: -147.1, kind: 'base' },
  { name: 'Aleutian Islands', aliases: ['aleutians'], country: 'United States', lat: 52.0, lon: -174.0, kind: 'region' },
  { name: 'El Paso', aliases: [], country: 'United States', lat: 31.76, lon: -106.49, kind: 'city' },
  { name: 'The Pentagon', aliases: ['pentagon', 'arlington'], country: 'United States', lat: 38.87, lon: -77.06, kind: 'facility' },
  { name: 'Naval Station Mayport', aliases: ['mayport'], country: 'United States', lat: 30.39, lon: -81.41, kind: 'base' },
  { name: 'Houston', aliases: [], country: 'United States', lat: 29.76, lon: -95.37, kind: 'city' },
  { name: 'Seattle', aliases: [], country: 'United States', lat: 47.61, lon: -122.33, kind: 'city' },
  { name: 'Mexico City', aliases: [], country: 'Mexico', lat: 19.43, lon: -99.13, kind: 'city' },
  { name: 'Tijuana', aliases: [], country: 'Mexico', lat: 32.51, lon: -117.04, kind: 'city' },
  { name: 'Ciudad Juarez', aliases: ['juarez'], country: 'Mexico', lat: 31.69, lon: -106.42, kind: 'city' },
  { name: 'Culiacan', aliases: [], country: 'Mexico', lat: 24.81, lon: -107.39, kind: 'city' },
  { name: 'Sinaloa', aliases: [], country: 'Mexico', lat: 25.0, lon: -107.5, kind: 'region' },
  { name: 'Ottawa', aliases: [], country: 'Canada', lat: 45.42, lon: -75.7, kind: 'city' },
  { name: 'Toronto', aliases: [], country: 'Canada', lat: 43.65, lon: -79.38, kind: 'city' },
  { name: 'Vancouver', aliases: [], country: 'Canada', lat: 49.28, lon: -123.12, kind: 'city' },
  { name: 'Havana', aliases: [], country: 'Cuba', lat: 23.11, lon: -82.37, kind: 'city' },
  { name: 'Guantanamo Bay', aliases: ['gitmo'], country: 'Cuba', lat: 19.9, lon: -75.1, kind: 'base' },
  { name: 'Nassau', aliases: [], country: 'Bahamas', lat: 25.05, lon: -77.35, kind: 'city' },
  { name: 'Gulf of Mexico', aliases: ['gulf of america'], country: 'International', lat: 25.0, lon: -90.0, kind: 'region' },
  // country centroids
  { name: 'United States', aliases: ['usa', 'us'], country: 'United States', lat: 39.8, lon: -98.6, kind: 'region' },
  { name: 'Mexico', aliases: [], country: 'Mexico', lat: 23.6, lon: -102.5, kind: 'region' },
  { name: 'Canada', aliases: [], country: 'Canada', lat: 56.1, lon: -106.3, kind: 'region' },
  { name: 'Cuba', aliases: [], country: 'Cuba', lat: 21.5, lon: -79.5, kind: 'region' },
  { name: 'Bahamas', aliases: [], country: 'Bahamas', lat: 24.3, lon: -76.0, kind: 'region' },
  // Added 2026-10-30 from the unplotted-event audit. Every coordinate was checked
  // against OpenStreetMap Nominatim (points within 15 km, regions within 400 km).
  { name: 'Fort Hood', aliases: ['fort cavazos'], country: 'United States', lat: 31.14, lon: -97.78, kind: 'base' },
  { name: 'Joint Base Elmendorf-Richardson', aliases: ['jber', 'elmendorf'], country: 'United States', lat: 61.25, lon: -149.8, kind: 'base' },
  { name: 'Naval Base Point Loma', aliases: ['point loma'], country: 'United States', lat: 32.68, lon: -117.24, kind: 'base' },
  { name: 'Naval Air Station North Island', aliases: ['nas north island', 'north island'], country: 'United States', lat: 32.7, lon: -117.21, kind: 'base' },
  { name: 'Cape Canaveral Space Force Station', aliases: ['cape canaveral'], country: 'United States', lat: 28.49, lon: -80.58, kind: 'base' },
  { name: 'Yakima Training Center', aliases: [], country: 'United States', lat: 46.761, lon: -120.191, kind: 'base' },
  { name: 'Thurmont', aliases: ['camp david'], country: 'United States', lat: 39.62, lon: -77.41, kind: 'city' },
  { name: 'Miami', aliases: [], country: 'United States', lat: 25.76, lon: -80.19, kind: 'city' },
  { name: 'Alberta', aliases: [], country: 'Canada', lat: 53.9, lon: -116.6, kind: 'region' },
  { name: 'Greenland', aliases: [], country: 'Greenland', lat: 72, lon: -40, kind: 'region' },
];

export const SOUTHCOM_GAZETTEER: GazetteerEntry[] = [
  { name: 'Caracas', aliases: [], country: 'Venezuela', lat: 10.49, lon: -66.88, kind: 'city' },
  { name: 'Maracaibo', aliases: [], country: 'Venezuela', lat: 10.65, lon: -71.64, kind: 'city' },
  { name: 'Bogota', aliases: [], country: 'Colombia', lat: 4.71, lon: -74.07, kind: 'city' },
  { name: 'Medellin', aliases: [], country: 'Colombia', lat: 6.24, lon: -75.58, kind: 'city' },
  { name: 'Catatumbo', aliases: [], country: 'Colombia', lat: 8.6, lon: -73.0, kind: 'region' },
  { name: 'Quito', aliases: [], country: 'Ecuador', lat: -0.18, lon: -78.47, kind: 'city' },
  { name: 'Guayaquil', aliases: [], country: 'Ecuador', lat: -2.19, lon: -79.89, kind: 'city' },
  { name: 'Lima', aliases: [], country: 'Peru', lat: -12.05, lon: -77.04, kind: 'city' },
  { name: 'La Paz', aliases: [], country: 'Bolivia', lat: -16.49, lon: -68.15, kind: 'city' },
  { name: 'Santiago', aliases: [], country: 'Chile', lat: -33.45, lon: -70.67, kind: 'city' },
  { name: 'Buenos Aires', aliases: [], country: 'Argentina', lat: -34.6, lon: -58.38, kind: 'city' },
  { name: 'Brasilia', aliases: [], country: 'Brazil', lat: -15.79, lon: -47.88, kind: 'city' },
  { name: 'Sao Paulo', aliases: [], country: 'Brazil', lat: -23.55, lon: -46.63, kind: 'city' },
  { name: 'Rio de Janeiro', aliases: [], country: 'Brazil', lat: -22.91, lon: -43.17, kind: 'city' },
  { name: 'Georgetown', aliases: [], country: 'Guyana', lat: 6.8, lon: -58.16, kind: 'city' },
  { name: 'Essequibo', aliases: [], country: 'Guyana', lat: 6.0, lon: -59.5, kind: 'region' },
  { name: 'Panama City', aliases: [], country: 'Panama', lat: 8.98, lon: -79.52, kind: 'city' },
  { name: 'Panama Canal', aliases: [], country: 'Panama', lat: 9.08, lon: -79.68, kind: 'chokepoint' },
  { name: 'Port-au-Prince', aliases: [], country: 'Haiti', lat: 18.54, lon: -72.34, kind: 'city' },
  { name: 'Santo Domingo', aliases: [], country: 'Dominican Republic', lat: 18.49, lon: -69.9, kind: 'city' },
  { name: 'San Salvador', aliases: [], country: 'El Salvador', lat: 13.69, lon: -89.19, kind: 'city' },
  { name: 'Tegucigalpa', aliases: [], country: 'Honduras', lat: 14.07, lon: -87.19, kind: 'city' },
  { name: 'Guatemala City', aliases: [], country: 'Guatemala', lat: 14.63, lon: -90.51, kind: 'city' },
  { name: 'Managua', aliases: [], country: 'Nicaragua', lat: 12.11, lon: -86.24, kind: 'city' },
  { name: 'Caribbean Sea', aliases: ['caribbean'], country: 'International', lat: 15.0, lon: -75.0, kind: 'region' },
  // country centroids
  { name: 'Venezuela', aliases: [], country: 'Venezuela', lat: 6.4, lon: -66.6, kind: 'region' },
  { name: 'Colombia', aliases: [], country: 'Colombia', lat: 4.6, lon: -74.1, kind: 'region' },
  { name: 'Ecuador', aliases: [], country: 'Ecuador', lat: -1.8, lon: -78.2, kind: 'region' },
  { name: 'Peru', aliases: [], country: 'Peru', lat: -9.2, lon: -75.0, kind: 'region' },
  { name: 'Bolivia', aliases: [], country: 'Bolivia', lat: -16.3, lon: -63.6, kind: 'region' },
  { name: 'Chile', aliases: [], country: 'Chile', lat: -35.7, lon: -71.5, kind: 'region' },
  { name: 'Argentina', aliases: [], country: 'Argentina', lat: -38.4, lon: -63.6, kind: 'region' },
  { name: 'Brazil', aliases: [], country: 'Brazil', lat: -14.2, lon: -51.9, kind: 'region' },
  { name: 'Guyana', aliases: [], country: 'Guyana', lat: 4.9, lon: -58.9, kind: 'region' },
  { name: 'Panama', aliases: [], country: 'Panama', lat: 8.5, lon: -80.8, kind: 'region' },
  { name: 'Haiti', aliases: [], country: 'Haiti', lat: 19.0, lon: -72.7, kind: 'region' },
  { name: 'Honduras', aliases: [], country: 'Honduras', lat: 14.8, lon: -86.6, kind: 'region' },
  { name: 'Guatemala', aliases: [], country: 'Guatemala', lat: 15.8, lon: -90.2, kind: 'region' },
  { name: 'Nicaragua', aliases: [], country: 'Nicaragua', lat: 12.9, lon: -85.2, kind: 'region' },
  // infrastructure / special features
  { name: 'José Terminal', aliases: ['jose terminal', 'puerto la cruz'], country: 'Venezuela', lat: 10.08, lon: -64.86, kind: 'refinery' },
  { name: 'Amuay Refinery', aliases: ['amuay', 'paraguaná refinery'], country: 'Venezuela', lat: 11.75, lon: -70.2, kind: 'refinery' },
  { name: 'Cano Limon Pipeline', aliases: ['cano limon', 'caño limón'], country: 'Colombia', lat: 6.93, lon: -71.3, kind: 'pipeline' },
  { name: 'Cartagena Refinery', aliases: ['reficar'], country: 'Colombia', lat: 10.32, lon: -75.5, kind: 'refinery' },
  { name: 'Callao Port', aliases: ['callao'], country: 'Peru', lat: -12.05, lon: -77.14, kind: 'port' },
  // Added 2026-10-30 from the unplotted-event audit. Every coordinate was checked
  // against OpenStreetMap Nominatim (points within 15 km, regions within 400 km).
  { name: 'Falkland Islands', aliases: ['malvinas', 'islas malvinas'], country: 'Falkland Islands', lat: -51.75, lon: -59.17, kind: 'island' },
  { name: 'Santa Marta', aliases: [], country: 'Colombia', lat: 11.24, lon: -74.2, kind: 'city' },
  { name: 'El Salvador', aliases: [], country: 'El Salvador', lat: 13.79, lon: -88.9, kind: 'region' },
  { name: 'Dominican Republic', aliases: [], country: 'Dominican Republic', lat: 18.74, lon: -70.16, kind: 'region' },
  { name: 'Costa Rica', aliases: [], country: 'Costa Rica', lat: 9.75, lon: -83.75, kind: 'region' },
];


/** Per-AOR gazetteer lookup; the pipeline passes GAZETTEERS[aor] into geolocate. */
export const GAZETTEERS: Record<Aor, GazetteerEntry[]> = {
  CENTCOM: CENTCOM_GAZETTEER,
  EUCOM: EUCOM_GAZETTEER,
  INDOPACOM: INDOPACOM_GAZETTEER,
  AFRICOM: AFRICOM_GAZETTEER,
  NORTHCOM: NORTHCOM_GAZETTEER,
  SOUTHCOM: SOUTHCOM_GAZETTEER,
};
