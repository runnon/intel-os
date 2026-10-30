/**
 * Build worker/data/places.tsv.gz + worker/data/countries.tsv from a GeoNames dump
 * (https://download.geonames.org/export/dump/, CC-BY 4.0).
 *
 *   npx tsx scripts/build-places.ts <allCountries.zip> <no-country.zip> <countryInfo.txt>
 *
 * Keeps what news reporting actually names — towns, provinces/districts, seas and
 * straits, airports/bases/ports/plants, notable islands and named regions — and
 * drops the long tail (hamlets, streams, hills). Coordinates are copied verbatim
 * from GeoNames; nothing is computed or guessed. Re-run to refresh the table.
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { gzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [allZip, noCountryZip, countryInfo] = process.argv.slice(2);
if (!allZip || !noCountryZip || !countryInfo) {
  console.error('usage: tsx scripts/build-places.ts <allCountries.zip> <no-country.zip> <countryInfo.txt>');
  process.exit(1);
}

// Active ground-war countries keep every named settlement, however small — that is
// where frontline villages are reported. Elsewhere only places of 1,000+ people
// or administrative seats are kept.
const ALL_SETTLEMENTS = new Set(['UA', 'PS', 'IL', 'LB', 'SY']);
const SEATS = new Set(['PPLC', 'PPLA', 'PPLA2', 'PPLA3', 'PPLG']);
const WATER_MAJOR = new Set(['SEA', 'OCN', 'STRT', 'GULF']);
const WATER_MINOR = new Set(['BAY', 'CHN', 'SD', 'LGN']);
const SITES = new Set(['AIRP', 'AIRB', 'MILB', 'INSM', 'NVB', 'PRT', 'NPPT', 'OILR', 'OILT', 'DAM', 'PS', 'CSTM']);
const LATIN = /^[\p{Script=Latin}0-9 '’.\-()]+$/u;

type Kind = 'settlement' | 'site' | 'island' | 'admin' | 'area' | 'water';

function classify(f: string[]): { kind: Kind; importance: number } | null {
  const [, , , alt = '', , , cls, code = '', cc = '', , , , , , popRaw] = f;
  const pop = Number(popRaw) || 0;
  const alts = alt ? alt.split(',').length : 0;
  switch (cls) {
    case 'P':
      // City sections, historical and abandoned places aren't where events are reported.
      if (code === 'PPLX' || code === 'PPLH' || code === 'PPLQ') return null;
      if (pop >= 1000 || SEATS.has(code) || ALL_SETTLEMENTS.has(cc)) return { kind: 'settlement', importance: pop };
      return null;
    case 'A':
      if (code === 'ADM1') return { kind: 'admin', importance: 1000 + alts };
      if (code === 'ADM2') return { kind: 'admin', importance: alts };
      return null;
    case 'H':
      if (WATER_MAJOR.has(code)) return { kind: 'water', importance: alts };
      if (WATER_MINOR.has(code) && alts >= 5) return { kind: 'water', importance: alts };
      return null;
    case 'S':
      if (SITES.has(code) && (code === 'MILB' || code === 'NVB' || code === 'AIRB' || alts >= 3)) {
        return { kind: 'site', importance: alts };
      }
      return null;
    case 'T':
      if ((code === 'ISL' || code === 'ISLS') && alts >= 5) return { kind: 'island', importance: alts };
      if (code === 'PEN' && alts >= 5) return { kind: 'area', importance: alts };
      return null;
    case 'L':
      if ((code === 'RGN' || code === 'RGNE') && alts >= 3) return { kind: 'area', importance: alts };
      return null;
    default:
      return null;
  }
}

const fold = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// 0 = plain English letters, 1 = ASCII with apostrophes/marks, 2 = anything else.
const plainness = (s: string) => (/^[A-Za-z .\-]+$/.test(s) ? 0 : /^[\x20-\x7e]+$/.test(s) ? 1 : 2);

// GeoNames lists alternates alphabetically, so a plain cap would keep "Doneck" and
// drop "Donetsk Oblast". Plain-ASCII spellings (English transliterations) go first,
// and spellings that fold to the same key don't spend a slot.
function names(f: string[], kind: Kind): string[] {
  const [, name = '', ascii = '', alt = ''] = f;
  const cap = kind === 'settlement' ? 8 : 60;
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (n: string) => {
    const k = fold(n);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(n);
  };
  add(name);
  add(ascii);
  const alts = alt
    .split(',')
    .filter((a) => a.length >= 3 && a.length <= 60 && LATIN.test(a) && !/^[A-Z0-9]{3,4}$/.test(a)) // drop IATA/ICAO codes
    .sort((a, b) => plainness(a) - plainness(b));
  for (const a of alts) {
    if (out.length >= cap) break;
    add(a);
  }
  return out;
}

async function scan(zip: string, rows: string[]): Promise<number> {
  const unzip = spawn('unzip', ['-p', zip], { stdio: ['ignore', 'pipe', 'inherit'] });
  let kept = 0;
  for await (const line of createInterface({ input: unzip.stdout, crlfDelay: Infinity })) {
    const f = line.split('\t');
    if (f.length < 15) continue;
    const c = classify(f);
    if (!c) continue;
    const [, , , , lat, lon, , , cc] = f;
    // 4 decimals ≈ 11 m: well inside any precision this product claims.
    rows.push([Number(lat).toFixed(4), Number(lon).toFixed(4), cc || '', c.kind, c.importance, names(f, c.kind).join('|')].join('\t'));
    kept++;
  }
  return kept;
}

async function main() {
const rows: string[] = [];
const fromAll = await scan(allZip, rows);
const fromNoCountry = await scan(noCountryZip, rows);

const countries = readFileSync(countryInfo, 'utf8')
  .split('\n')
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => l.split('\t'))
  .map((f) => `${f[0]}\t${f[4]}`);

const out = join(__dirname, '..', 'worker', 'data');
mkdirSync(out, { recursive: true });
const gz = gzipSync(Buffer.from(rows.join('\n') + '\n'), { level: 9 });
writeFileSync(join(out, 'places.tsv.gz'), gz);
writeFileSync(join(out, 'countries.tsv'), countries.join('\n') + '\n');
console.log(`places: ${fromAll} + ${fromNoCountry} international = ${rows.length} rows, ${(gz.length / 1e6).toFixed(1)} MB gz; countries: ${countries.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
