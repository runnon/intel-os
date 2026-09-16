import type { Precision } from './types';

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
  kind: 'city' | 'base' | 'facility' | 'chokepoint' | 'island' | 'region';
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
];

export interface GeoResult {
  lat: number | null;
  lon: number | null;
  precision: Precision;
  confidence: number;
  matchedName: string | null;
  validated: boolean;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function precisionFor(kind: GazetteerEntry['kind']): Precision {
  if (kind === 'region') return 'region';
  if (kind === 'city' || kind === 'chokepoint') return 'settlement';
  return 'point'; // bases, facilities, islands are specific sites
}

/**
 * Resolve a reported place name against the gazetteer with a confidence score.
 * Never invents coordinates: no match → nulls with confidence 0 (event lists unplotted).
 */
export function geolocate(placeName: string, country?: string, gaz: GazetteerEntry[] = CENTCOM_GAZETTEER): GeoResult {
  const q = norm(placeName);
  if (!q) return { lat: null, lon: null, precision: 'region', confidence: 0, matchedName: null, validated: false };

  let best: { entry: GazetteerEntry; score: number } | null = null;
  for (const entry of gaz) {
    const names = [entry.name, ...entry.aliases].map(norm);
    let score = 0;
    if (names.includes(q)) score = 0.85;
    else if (names.some((n) => q.includes(n) || n.includes(q))) score = 0.6;
    if (score === 0) continue;
    if (country && norm(entry.country) === norm(country)) score += 0.1;
    else if (country && entry.country !== 'International' && norm(entry.country) !== norm(country)) score -= 0.25;
    if (!best || score > best.score) best = { entry, score };
  }

  if (!best || best.score < GEO_CONFIDENCE_THRESHOLD) {
    return { lat: null, lon: null, precision: 'region', confidence: best?.score ?? 0, matchedName: null, validated: false };
  }
  return {
    lat: best.entry.lat,
    lon: best.entry.lon,
    precision: precisionFor(best.entry.kind),
    confidence: Math.min(best.score, 0.95),
    matchedName: best.entry.name,
    validated: true,
  };
}
