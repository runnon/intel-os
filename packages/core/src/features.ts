import type { Aor } from './types';
import { GAZETTEERS, type GazetteerEntry } from './gazetteer';

/**
 * Static, public-source geometry for linear infrastructure that cannot be
 * represented honestly by a point. The browser never calls a routing service:
 * the reviewed coordinates ship with the application and remain available on
 * restricted networks.
 *
 * `mapped` pipelines are simplified from published GIS alignments. `routed`
 * maritime lines follow a shipping-network path through navigable water; they
 * are representative corridors, not live vessel tracks or navigation advice.
 * `approximate` is reserved for older public-reference alignments that still
 * need a surveyed/open-GIS replacement.
 */
export interface LineFeature {
  name: string;
  aliases: string[];
  kind: 'pipeline' | 'corridor';
  coordinates: [number, number][];
  basis: 'mapped' | 'routed' | 'approximate';
  accuracy: string;
  sourceName: string;
  sourceUrl?: string;
}

const MARITIME_SOURCE = {
  basis: 'routed' as const,
  accuracy: '5 km public shipping-network route',
  sourceName: 'Eurostat SeaRoute / ORNL Global Shipping Lane Network',
  sourceUrl: 'https://github.com/eurostat/searoute',
};

const GOIT_SOURCE = {
  basis: 'mapped' as const,
  sourceName: 'Global Energy Monitor, Global Oil Infrastructure Tracker (June 2026)',
  sourceUrl:
    'https://github.com/GlobalEnergyMonitor/goit-ggit-data-ops/tree/3a8146fd84388a9c3d45440903199a6c08a4350b/writing-and-analysis/june-2026-goit-release/hormuz-alternatives',
};

const PUBLIC_ALIGNMENT = {
  basis: 'approximate' as const,
  accuracy: 'Public-reference alignment; not survey grade',
  sourceName: 'Curated public reporting',
};

export const INFRASTRUCTURE_LINES: Record<Aor, LineFeature[]> = {
  CENTCOM: [
    {
      name: 'East-West Pipeline',
      aliases: ['east-west pipeline', 'petroline', 'east west pipeline', 'east-west petroline'],
      kind: 'pipeline',
      coordinates: [
        [49.68719, 25.91462],
        [48.8588, 25.64631],
        [48.51756, 25.43392],
        [48.20465, 25.32065],
        [48.03615, 25.23286],
        [47.54907, 25.16207],
        [46.63297, 24.97941],
        [46.48147, 24.87251],
        [46.1643, 24.86897],
        [45.83864, 24.78402],
        [44.07015, 24.57941],
        [42.94732, 24.40809],
        [42.22449, 24.2488],
        [41.64467, 24.18933],
        [39.90308, 23.93234],
        [39.71335, 23.8757],
        [39.61353, 23.88986],
        [39.57105, 23.9203],
        [39.25388, 23.91393],
        [38.99052, 23.87924],
        [38.74061, 23.95499],
        [38.63796, 23.93021],
        [38.44185, 23.96703],
        [38.34344, 23.92667],
      ],
      ...GOIT_SOURCE,
      accuracy: 'Very high source alignment, simplified to map scale',
    },
    {
      name: 'Habshan–Fujairah Oil Pipeline',
      aliases: ['habshan fujairah pipeline', 'abu dhabi crude oil pipeline', 'adcop', 'fujairah pipeline'],
      kind: 'pipeline',
      coordinates: [
        [53.6176, 23.8279],
        [53.6909, 23.937],
        [54.1381, 24.0253],
        [54.3781, 24.1648],
        [54.7243, 24.1693],
        [54.7912, 24.211],
        [54.8052, 24.273],
        [54.8317, 24.2699],
        [55.0235, 24.41],
        [55.1303, 24.6067],
        [55.1916, 24.5746],
        [55.3609, 24.5772],
        [55.6388, 24.6895],
        [55.7521, 24.7037],
        [55.7525, 24.75478],
        [55.8028, 24.7992],
        [55.7827, 24.8901],
        [55.8882, 25.0177],
        [56.0259, 25.1101],
        [56.0351, 25.1993],
        [56.3413, 25.2128],
      ],
      ...GOIT_SOURCE,
      accuracy: 'High source alignment, simplified to map scale',
    },
    {
      name: 'Goureh–Jask Crude Oil Pipeline',
      aliases: ['goureh-jask pipeline', 'goreh-jask pipeline', 'goureh jask', 'goreh jask'],
      kind: 'pipeline',
      coordinates: [
        [57.30638, 25.86576],
        [57.3416, 25.87111],
        [57.34144, 25.88939],
        [57.30423, 26.06735],
        [57.2414, 26.20166],
        [57.24355, 26.39505],
        [57.15602, 26.49599],
        [57.05054, 26.75179],
        [57.09447, 26.7836],
        [57.12942, 26.98035],
        [57.04777, 27.41321],
        [56.95612, 27.46496],
        [56.90128, 27.60794],
        [56.86631, 27.64177],
        [56.5492, 27.67935],
        [56.48768, 27.66244],
        [56.45788, 27.6156],
        [56.25923, 27.56977],
        [56.19472, 27.52078],
        [56.04665, 27.51667],
        [55.87568, 27.45178],
        [55.73777, 27.45868],
        [55.61446, 27.43046],
        [55.41211, 27.46559],
        [55.29973, 27.42856],
        [55.12443, 27.48589],
        [55.08278, 27.55155],
        [55.02957, 27.57411],
        [54.97635, 27.57411],
        [54.90845, 27.50198],
        [54.8059, 27.47437],
        [54.65315, 27.51013],
        [54.49085, 27.49319],
        [54.31971, 27.52693],
        [54.17615, 27.51766],
        [53.82467, 27.67685],
        [53.43076, 27.77763],
        [53.36747, 27.82267],
        [53.35969, 27.85456],
        [53.17563, 27.93161],
        [53.18257, 28.01742],
        [53.1016, 28.07664],
        [52.85581, 28.1418],
        [52.66967, 28.23609],
        [52.31056, 28.36002],
        [52.18858, 28.42951],
        [52.1412, 28.44443],
        [52.0542, 28.41782],
        [51.94777, 28.44834],
        [51.84736, 28.51592],
        [51.73746, 28.53578],
        [51.45501, 28.80075],
        [51.34822, 28.8274],
        [51.29048, 28.94526],
        [51.25607, 29.1188],
        [51.21122, 29.17186],
        [51.10068, 29.17535],
        [50.9761, 29.21964],
        [50.83418, 29.42174],
        [50.59906, 29.68432],
        [50.58487, 29.72903],
        [50.51722, 29.76849],
        [50.46361, 29.88482],
        [50.43273, 29.88922],
      ],
      ...GOIT_SOURCE,
      accuracy: 'High source alignment, simplified to map scale',
    },
    {
      name: 'Strait of Hormuz Shipping Route',
      aliases: ['strait of hormuz', 'hormuz'],
      kind: 'corridor',
      coordinates: [
        [50.981, 27.2493],
        [53.3693, 26.579],
        [53.9143, 26.4593],
        [55.456, 26.4558],
        [56.4383, 26.4953],
        [56.6163, 26.447],
        [56.7305, 25.9753],
        [57.1, 25.5],
        [58.887, 24.0893],
      ],
      ...MARITIME_SOURCE,
    },
    {
      name: 'Red Sea Shipping Route',
      aliases: ['red sea shipping', 'bab al-mandeb', 'bab el-mandeb', 'bab-el-mandeb', 'gulf-red sea route', 'red sea sloc'],
      kind: 'corridor',
      coordinates: [
        [45.0055, 12.7955],
        [44.9623, 12.8035],
        [45.023, 12.607],
        [45.0005, 12],
        [44.898, 12.0422],
        [44.73, 12.1115],
        [43.6053, 12.5753],
        [43.4653, 12.633],
        [43.047, 13.1533],
        [43.0073, 13.2104],
        [42.4925, 14.1283],
        [42.0782, 14.8623],
        [42.0219, 14.9619],
        [41.3775, 16.0118],
        [41.2597, 16.203],
        [41.245, 16.2273],
        [39.335, 19.9085],
        [38.9053, 20.7403],
        [38.6415, 21.1383],
        [37, 23.6],
        [35.4875, 25.6575],
        [35.0284, 26.2818],
        [34.5525, 26.9038],
        [34.2235, 27.3335],
        [33.9815, 27.6325],
        [33.5028, 28.1175],
        [33.192, 28.4373],
        [32.8288, 29.0728],
        [32.5888, 29.557],
        [32.5763, 29.6825],
        [32.5613, 29.9315],
      ],
      ...MARITIME_SOURCE,
    },
  ],
  EUCOM: [
    {
      name: 'Nord Stream',
      aliases: ['nord stream 1', 'nord stream 2', 'nordstream'],
      kind: 'pipeline',
      coordinates: [[28.6, 60.7], [26, 59.8], [22, 57.5], [18, 56], [15.6, 55.5], [13.6, 54.1]],
      ...PUBLIC_ALIGNMENT,
    },
    {
      name: 'Druzhba Pipeline',
      aliases: ['druzhba', 'friendship pipeline'],
      kind: 'pipeline',
      coordinates: [[49.5, 52.6], [37.6, 52.1], [30.5, 52.1], [27.5, 52.1], [23, 52.2], [18.9, 52.4]],
      ...PUBLIC_ALIGNMENT,
    },
    {
      name: 'TurkStream',
      aliases: ['turkstream', 'turk stream'],
      kind: 'pipeline',
      coordinates: [[37.8, 44.9], [33, 43.2], [28.1, 41.6]],
      ...PUBLIC_ALIGNMENT,
    },
    {
      name: 'Black Sea Grain Corridor',
      aliases: ['grain corridor', 'black sea grain', 'bosphorus', 'bosporus'],
      kind: 'corridor',
      coordinates: [[30.9005, 46.25], [30.5217, 45.1805], [30.197, 44.318], [30.1145, 44.0908], [30.0115, 43.808], [29.598, 42.5975], [29.303, 41.7465], [29.1383, 41.274], [29.1226, 41.2496], [29.0993, 41.1912]],
      ...MARITIME_SOURCE,
    },
  ],
  INDOPACOM: [
    {
      name: 'Power of Siberia',
      aliases: ['power of siberia pipeline'],
      kind: 'pipeline',
      coordinates: [[122, 52], [127.5, 50.3], [125.3, 43.9]],
      ...PUBLIC_ALIGNMENT,
    },
    {
      name: 'Taiwan Strait Shipping Route',
      aliases: ['taiwan strait'],
      kind: 'corridor',
      coordinates: [[119.7533, 22.4557], [119.82, 23], [119.88, 23.6], [119.95, 24.2], [120, 24.6335], [120.0908, 25.4343]],
      ...MARITIME_SOURCE,
    },
    {
      name: 'Malacca–South China Sea Shipping Route',
      aliases: ['strait of malacca', 'malacca strait', 'south china sea shipping', 'malacca'],
      kind: 'corridor',
      coordinates: [[97, 7], [100.6395, 3.1668], [100.922, 2.9265], [101.1493, 2.735], [101.9743, 2.023], [102.8928, 1.498], [103.6, 1.1003], [103.8908, 1.1815], [104.4776, 1.4418], [104.5445, 1.479], [104.5768, 1.4968], [104.6485, 1.5356], [104.7502, 1.6453], [106, 3], [108, 5.5], [109.9343, 7.5455], [111.9135, 9.7978], [115.0445, 13.3608], [118.162, 16.9083], [118.5558, 17.3565], [119.5648, 18.5048], [120, 19], [120.4285, 19.8248], [121.4633, 21.8155]],
      ...MARITIME_SOURCE,
    },
  ],
  AFRICOM: [
    {
      name: 'East African Crude Oil Pipeline',
      aliases: ['eacop'],
      kind: 'pipeline',
      coordinates: [[31.35, 1.43], [33, -1.5], [35.5, -3.5], [39.1, -5.07]],
      ...PUBLIC_ALIGNMENT,
    },
    {
      name: 'Bab-el-Mandeb Shipping Route',
      aliases: ['bab el-mandeb', 'bab al-mandeb', 'bab-el-mandeb', 'gulf of aden'],
      kind: 'corridor',
      coordinates: [[51.0007, 13.0003], [49, 12.5], [47, 12.2], [45.0005, 12], [44.898, 12.0422], [44.73, 12.1115], [43.6053, 12.5753], [43.4653, 12.633], [43.3025, 12.699]],
      ...MARITIME_SOURCE,
    },
    {
      name: 'Mozambique Channel Shipping Route',
      aliases: ['mozambique channel'],
      kind: 'corridor',
      coordinates: [[43.0003, -12], [42.4, -14], [41.7, -15.0002], [41.3, -18], [41.35, -21], [42, -23]],
      ...MARITIME_SOURCE,
    },
  ],
  NORTHCOM: [],
  SOUTHCOM: [
    {
      name: 'Caño Limón–Coveñas Pipeline',
      aliases: ['cano limon', 'caño limón', 'caño limón–coveñas', 'cano limon-covenas'],
      kind: 'pipeline',
      coordinates: [[-71.3, 6.93], [-73.5, 7.8], [-75.68, 9.4]],
      ...PUBLIC_ALIGNMENT,
    },
    {
      name: 'Panama Canal Shipping Route',
      aliases: ['panama canal'],
      kind: 'corridor',
      coordinates: [[-79.9197, 9.4278], [-79.9277, 9.3996], [-79.9197, 9.3153], [-79.8625, 9.185], [-79.8015, 9.1275], [-79.691, 9.1075], [-79.6302, 9.0283], [-79.5129, 8.8696]],
      ...MARITIME_SOURCE,
    },
  ],
};

/**
 * Which line features are referenced by the current events. A line shows if any
 * event's title, summary, or place name mentions it — so infrastructure appears
 * even when the event that names it is itself unplotted (DATA/AUTO: mentioned →
 * shown).
 */
export function referencedLines(
  events: { title?: string; summary?: string; placeName?: string }[],
  aor: Aor,
): LineFeature[] {
  const lines = INFRASTRUCTURE_LINES[aor] ?? [];
  if (lines.length === 0 || events.length === 0) return [];
  const hay = events
    .map((e) => `${e.title ?? ''} ${e.summary ?? ''} ${e.placeName ?? ''}`)
    .join(' \n ')
    .toLowerCase();
  return lines.filter((line) =>
    [line.name, ...line.aliases].some((candidate) => hay.includes(candidate.toLowerCase())),
  );
}

// --- Context points of interest (airfields, ports, energy sites, cities) --------

export type PoiCategory = 'airfield' | 'port' | 'energy' | 'city';

export interface PointFeature {
  name: string;
  country: string;
  lat: number;
  lon: number;
  category: PoiCategory;
  kind: GazetteerEntry['kind'];
  reason: 'named' | 'nearby'; // why this site is shown
}

// Which curated gazetteer kinds map to a drawable context category. `region`
// centroids and chokepoints are deliberately excluded — they aren't point sites.
const POI_CATEGORY: Partial<Record<GazetteerEntry['kind'], PoiCategory>> = {
  base: 'airfield',
  airport: 'airfield',
  port: 'port',
  refinery: 'energy',
  nuclear: 'energy',
  dam: 'energy',
  facility: 'energy',
  city: 'city',
};

export const POI_CATEGORIES: PoiCategory[] = ['airfield', 'port', 'energy', 'city'];
export const POI_PROXIMITY_KM = 25; // show a site within this range of a plotted event
const POI_COLOCATED_KM = 2; // a site this close to an event IS the event's own spot
const POI_MAX = 60; // clutter backstop

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Curated context sites to draw beneath the event symbols: airfields, ports,
 * energy sites and cities that are either NAMED by a current event or lie within
 * POI_PROXIMITY_KM of a PLOTTED event. Same "mentioned → shown" discipline as
 * referencedLines, plus a proximity rule so the sites around an incident are
 * visible even when the report didn't name them. Never invents coordinates —
 * every point is a hand-curated gazetteer entry. A site sitting on top of an
 * event is skipped (the event symbol already marks that spot).
 */
export function referencedFeatures(
  events: {
    title?: string;
    summary?: string;
    placeName?: string;
    lat?: number | null;
    lon?: number | null;
  }[],
  aor: Aor,
  categories: PoiCategory[] = POI_CATEGORIES,
  proximityKm = POI_PROXIMITY_KM,
): PointFeature[] {
  const gaz = GAZETTEERS[aor] ?? [];
  if (gaz.length === 0 || events.length === 0) return [];
  const want = new Set(categories);
  const hay = events
    .map((e) => `${e.title ?? ''} ${e.summary ?? ''} ${e.placeName ?? ''}`)
    .join(' \n ')
    .toLowerCase();
  const plotted = events.filter(
    (e): e is typeof e & { lat: number; lon: number } => e.lat != null && e.lon != null,
  );

  const scored: { f: PointFeature; nearest: number }[] = [];
  for (const e of gaz) {
    const category = POI_CATEGORY[e.kind];
    if (!category || !want.has(category)) continue;
    const named = [e.name, ...e.aliases].some((c) => hay.includes(c.toLowerCase()));
    let nearest = Infinity;
    for (const p of plotted) {
      const d = haversineKm(e.lat, e.lon, p.lat, p.lon);
      if (d < nearest) nearest = d;
    }
    if (nearest <= POI_COLOCATED_KM) continue; // event symbol already marks this spot
    if (!named && nearest > proximityKm) continue;
    scored.push({
      f: { name: e.name, country: e.country, lat: e.lat, lon: e.lon, category, kind: e.kind, reason: named ? 'named' : 'nearby' },
      nearest,
    });
  }
  // Named first, then closest — so the clutter cap keeps the most relevant sites.
  scored.sort(
    (a, b) => Number(b.f.reason === 'named') - Number(a.f.reason === 'named') || a.nearest - b.nearest,
  );
  return scored.slice(0, POI_MAX).map((s) => s.f);
}
