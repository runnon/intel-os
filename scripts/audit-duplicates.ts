// Duplicate audit across ALL stored events. Ingest-time dedup (core `dedupe`) only compares
// within a single AOR window; this runs the same `isDuplicate` rule over the entire event
// corpus to surface duplicates that slipped through, plus near-misses and shared sources.
//
//   npx tsx scripts/audit-duplicates.ts
//
// Reads worker/.env for SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service role bypasses RLS).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { isDuplicate, titleSimilarity, type TheaterEvent } from "@intel-os/core";

const env = Object.fromEntries(
  readFileSync(new URL("../worker/.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
) as Record<string, string>;

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/* eslint-disable @typescript-eslint/no-explicit-any */
function toEvent(r: any): TheaterEvent {
  return {
    id: r.id, aor: r.aor, title: r.title, summary: r.summary,
    occurredAt: r.occurred_at, reportedAt: r.reported_at, category: r.category,
    affiliation: r.affiliation, placeName: r.place_name, country: r.country,
    lat: r.lat, lon: r.lon, precision: r.precision, geomValidated: r.geom_validated,
    geoConfidence: r.geo_confidence, confOrigin: r.conf_origin, confActor: r.conf_actor,
    usForcesFlag: r.us_forces_flag, usImpact: r.us_impact, sources: [],
  } as TheaterEvent;
}

void (async () => {
const { data: rows, error } = await sb.from("events").select("*").order("occurred_at");
if (error) throw error;
const { data: srcRows } = await sb.from("event_sources").select("event_id,url,outlet");
const events = (rows ?? []).map(toEvent);
const short = (id: string) => id.slice(0, 8);

// ---- A. Duplicate clusters via the project's isDuplicate rule (union-find) --------------
const parent = new Map(events.map((e) => [e.id, e.id]));
const find = (x: string): string => {
  while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x)!)!); x = parent.get(x)!; }
  return x;
};
let dupPairs = 0;
for (let i = 0; i < events.length; i++) {
  for (let j = i + 1; j < events.length; j++) {
    if (isDuplicate(events[i], events[j])) { parent.set(find(events[i].id), find(events[j].id)); dupPairs++; }
  }
}
const clusters = new Map<string, TheaterEvent[]>();
for (const e of events) { const r = find(e.id); (clusters.get(r) ?? clusters.set(r, []).get(r)!).push(e); }
const dupClusters = [...clusters.values()].filter((c) => c.length > 1).sort((a, b) => b.length - a.length);

console.log(`\n=== A. TRUE DUPLICATES (isDuplicate rule — should have merged) ===`);
console.log(`${events.length} events · ${dupPairs} duplicate pair(s) · ${dupClusters.length} cluster(s)\n`);
for (const c of dupClusters) {
  console.log(`[x${c.length}] ${c[0].aor} · ${c[0].category} · ~${c[0].placeName}`);
  for (const e of c.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
    console.log(`   ${short(e.id)}  ${e.occurredAt.slice(0, 16)}  ${e.title}`);
  }
}

// ---- B. Near-misses: same AOR+place+category, title overlap 0.3–0.5, within 72h ---------
console.log(`\n=== B. NEAR-DUPLICATES (borderline — review) ===`);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
let near = 0;
for (let i = 0; i < events.length; i++) {
  for (let j = i + 1; j < events.length; j++) {
    const a = events[i], b = events[j];
    if (isDuplicate(a, b)) continue; // already counted in A
    if (a.aor !== b.aor || a.category !== b.category) continue;
    const placeClose = norm(a.placeName) === norm(b.placeName) ||
      (a.lat != null && b.lat != null && a.lon != null && b.lon != null &&
        Math.hypot(a.lat - b.lat, (a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180)) * 111 < 40);
    if (!placeClose) continue;
    const hrs = Math.abs(new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()) / 3_600_000;
    const sim = titleSimilarity(a.title + " " + a.summary, b.title + " " + b.summary);
    if (hrs <= 72 && sim >= 0.3) {
      near++;
      console.log(`~${sim.toFixed(2)} ${Math.round(hrs)}h  ${a.aor}/${a.category}  ${short(a.id)} "${a.title}"  vs  ${short(b.id)} "${b.title}"`);
    }
  }
}
if (!near) console.log("(none)");

// ---- C. Same source URL cited by multiple distinct events (possible missed merge) -------
console.log(`\n=== C. SOURCE URLs shared across multiple events ===`);
const byUrl = new Map<string, Set<string>>();
for (const s of srcRows ?? []) { (byUrl.get(s.url) ?? byUrl.set(s.url, new Set()).get(s.url)!).add(s.event_id); }
const shared = [...byUrl.entries()].filter(([, ids]) => ids.size > 1).sort((a, b) => b[1].size - a[1].size);
if (!shared.length) console.log("(none)");
for (const [url, ids] of shared.slice(0, 25)) {
  console.log(`x${ids.size}  ${url}`);
}
if (shared.length > 25) console.log(`… and ${shared.length - 25} more`);

console.log(`\nSummary: ${dupClusters.length} true-duplicate cluster(s), ${near} near-duplicate pair(s), ${shared.length} shared-source URL(s).`);
})();
