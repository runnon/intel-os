import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { TheaterEvent } from '@intel-os/core';
import { geolocate } from '@intel-os/core';
import { makeSupabaseStore } from './store';
import { runIngestOnce } from './pipeline';

/**
 * Seed run: pushes the OS-IRN-26-001 proof-build event set (20 Aug – 12 Sep 2026,
 * all from public reporting) through the REAL pipeline into the real database —
 * exercising dedup, geolocation, issue build and publish without the LLM step.
 * Idempotent-ish: dedup collapses repeats into source merges on re-runs.
 */

const GS = (day: number) => ({
  url: `https://www.globalsecurity.org/military/world/war/iran-war-2026-day${day}.htm`,
  outlet: 'GlobalSecurity.org',
});

interface SeedRow {
  title: string;
  summary: string;
  occurredAt: string;
  category: TheaterEvent['category'];
  affiliation: TheaterEvent['affiliation'];
  placeName: string;
  country?: string;
  confOrigin: TheaterEvent['confOrigin'];
  confActor: TheaterEvent['confActor'];
  usForcesFlag: boolean;
  usImpact?: string;
  day: number;
}

const ROWS: SeedRow[] = [
  { title: 'First Iranian ballistic missile salvo against Al Azraq area bases', summary: 'At least 8 ballistic missiles launched at Jordanian bases hosting US A-10 and F-15 operations. No casualties reported.', occurredAt: '2026-08-30T18:00:00Z', category: 'strike', affiliation: 'hostile', placeName: 'Al Azraq', country: 'Jordan', confOrigin: 'high', confActor: 'high', usForcesFlag: true, usImpact: 'Opened the ballistic missile campaign against Jordan basing.', day: 184 },
  { title: 'Tankers Senegal Prosperity and Sidr struck in Khasab waters', summary: 'Two commercial tankers struck by unattributed projectiles near Khasab. Two crew killed aboard Sidr — first commercial crew deaths of the period.', occurredAt: '2026-08-31T12:00:00Z', category: 'maritime', affiliation: 'unknown', placeName: 'Khasab', country: 'Oman', confOrigin: 'moderate', confActor: 'low', usForcesFlag: false, usImpact: 'Drives USN escort tasking for traffic 5th Fleet must protect.', day: 185 },
  { title: 'US SLAM-ER strike near wedding venue at Kuhestak', summary: 'US strike during a ~100-target CENTCOM wave hit near a wedding venue. Casualty reporting revised from five to four killed, 50-68 wounded. CENTCOM investigating.', occurredAt: '2026-09-01T05:00:00Z', category: 'strike', affiliation: 'friendly', placeName: 'Kuhestak', country: 'Iran', confOrigin: 'moderate', confActor: 'high', usForcesFlag: true, usImpact: 'Civilian casualties are the main IO threat to basing consent.', day: 186 },
  { title: 'Iranian missiles target Prince Hassan AB UAV hangars and Camp Titin', summary: '13 missiles engaged, 10 intercepted. Zero casualties. Ranged US ISR assets and a USMC facility in a single strike.', occurredAt: '2026-09-01T15:00:00Z', category: 'strike', affiliation: 'hostile', placeName: 'Prince Hassan Air Base', country: 'Jordan', confOrigin: 'high', confActor: 'high', usForcesFlag: true, usImpact: 'Ranged US ISR assets and a USMC facility in a single strike.', day: 186 },
  { title: 'Iranian drones strike Ahmed al-Jaber AB in coordinated retaliation wave', summary: 'Kuwaiti bases hit by Iranian drones. No casualties reported.', occurredAt: '2026-09-01T16:00:00Z', category: 'strike', affiliation: 'hostile', placeName: 'Ahmed al-Jaber Air Base', country: 'Kuwait', confOrigin: 'moderate', confActor: 'high', usForcesFlag: true, usImpact: 'Forces sustained air-defense alert at a primary USAF operating location.', day: 186 },
  { title: '~24 Iranian drones launched at US bases in Bahrain', summary: 'Most intercepted; no damage reported by the host government.', occurredAt: '2026-09-01T17:00:00Z', category: 'strike', affiliation: 'hostile', placeName: 'Manama', country: 'Bahrain', confOrigin: 'moderate', confActor: 'high', usForcesFlag: true, usImpact: 'Raid volume is a magazine-depth problem, not an intercept one.', day: 186 },
  { title: 'Iran claims drone strikes on Sheikh Isa AB radar installations', summary: 'Claimed strikes on radar installations and assembly points. No damage confirmed by Bahrain.', occurredAt: '2026-09-02T10:00:00Z', category: 'strike', affiliation: 'hostile', placeName: 'Sheikh Isa Air Base', country: 'Bahrain', confOrigin: 'low', confActor: 'moderate', usForcesFlag: true, usImpact: 'Expands the defended-asset list in Bahrain beyond NSA Bahrain.', day: 187 },
  { title: 'First claimed Iranian strike on Emirati soil at Al Minhad AB', summary: 'Iran claimed a strike on Al Minhad Air Base. The UAE neither confirmed nor denied it.', occurredAt: '2026-09-03T09:00:00Z', category: 'strike', affiliation: 'hostile', placeName: 'Al Minhad Air Base', country: 'UAE', confOrigin: 'low', confActor: 'moderate', usForcesFlag: true, usImpact: 'Adds a fourth host nation; Emirati silence complicates access.', day: 188 },
  { title: 'Houthi ballistic missile strike on Jizan refinery', summary: 'Satellite-confirmed damage to the refinery.', occurredAt: '2026-09-07T20:00:00Z', category: 'infrastructure', affiliation: 'hostile', placeName: 'Jazan', country: 'Saudi Arabia', confOrigin: 'high', confActor: 'high', usForcesFlag: false, usImpact: 'Opens a southern front, pulling air-defense coverage off the Gulf cluster.', day: 192 },
  { title: '20 ballistic missiles strike Muwaffaq Salti AB; A-10 and F-15s damaged', summary: '18 of 20 missiles intercepted. Leakers took the wing off one A-10 and damaged ~8 F-15s. Roughly 30 Patriot interceptors expended.', occurredAt: '2026-09-08T04:00:00Z', category: 'strike', affiliation: 'hostile', placeName: 'Muwaffaq Salti Air Base', country: 'Jordan', confOrigin: 'high', confActor: 'high', usForcesFlag: true, usImpact: 'First confirmed damage to US aircraft; ~30 interceptors per raid.', day: 193 },
  { title: 'Houthi strikes on Jazan industries, Najran and Abha Aramco sites, King Khalid AB', summary: 'Coordinated strikes wounded 73. Partner air base and energy sites hit together.', occurredAt: '2026-09-08T14:00:00Z', category: 'strike', affiliation: 'hostile', placeName: 'Najran', country: 'Saudi Arabia', confOrigin: 'moderate', confActor: 'high', usForcesFlag: false, usImpact: 'Partner AB and energy sites hit together, straining one air-defense pool.', day: 193 },
  { title: 'Extensive damage to NSA Bahrain command centres, piers and comms', summary: 'Acting Navy Secretary confirmed extensive damage to command centres, warehouses, piers and communications; ~$400M reconstruction estimate.', occurredAt: '2026-09-09T08:00:00Z', category: 'infrastructure', affiliation: 'hostile', placeName: 'NSA Bahrain', country: 'Bahrain', confOrigin: 'high', confActor: 'high', usForcesFlag: true, usImpact: 'Degrades 5th Fleet C2 and port access; logistics shift ports.', day: 194 },
  { title: 'Houthis take Mocha and Bab al-Mandeb approaches unopposed', summary: 'Houthi forces took Mocha, Dhubab, al-Omari camp and Mayyun Island without contest.', occurredAt: '2026-09-10T11:00:00Z', category: 'ground', affiliation: 'hostile', placeName: 'Mocha', country: 'Yemen', confOrigin: 'moderate', confActor: 'moderate', usForcesFlag: false, usImpact: 'Hostile control of both shores threatens the Red Sea SLOC.', day: 195 },
  { title: 'East-West (Petroline) crude pipeline struck by drones, line shut', summary: 'Saudi Arabia attributed the drones to Iraqi origin and shut the line as a precaution.', occurredAt: '2026-09-12T06:00:00Z', category: 'infrastructure', affiliation: 'unknown', placeName: 'Yanbu', country: 'Saudi Arabia', confOrigin: 'moderate', confActor: 'low', usForcesFlag: false, usImpact: 'Kills the only non-Hormuz crude route; Iraqi launch axis is new.', day: 197 },
];

function toEvent(r: SeedRow): TheaterEvent {
  const geo = geolocate(r.placeName, r.country);
  const src = GS(r.day);
  return {
    id: randomUUID(),
    aor: 'CENTCOM',
    title: r.title,
    summary: r.summary,
    occurredAt: r.occurredAt,
    reportedAt: r.occurredAt,
    category: r.category,
    affiliation: r.affiliation,
    placeName: r.placeName,
    country: r.country,
    lat: geo.lat,
    lon: geo.lon,
    precision: geo.precision,
    geomValidated: geo.validated,
    geoConfidence: geo.confidence,
    confOrigin: r.confOrigin,
    confActor: r.confActor,
    usForcesFlag: r.usForcesFlag,
    usImpact: r.usImpact,
    sources: [{ url: src.url, outlet: src.outlet, title: r.title }],
    revisions: [],
  };
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const result = await runIngestOnce('CENTCOM', {
  fetchFeeds: async () => [],
  extract: async () => ROWS.map(toEvent),
  store: makeSupabaseStore(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
});

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
