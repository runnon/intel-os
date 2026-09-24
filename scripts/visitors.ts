// Visitors per day for intel-os.org, from the server-side page views the proxy captures
// (docs/DECISIONS.md 2026-09-24). One HogQL query against PostHog, printed as a table.
//
//   npx tsx scripts/visitors.ts            # last 30 days
//   npx tsx scripts/visitors.ts 90         # last 90 days
//   npx tsx scripts/visitors.ts 30 --pages # plus the top pages over the window
//
// Env (a personal API key, NOT the project key the app writes with):
//   POSTHOG_PERSONAL_API_KEY  PostHog → Settings → Personal API keys, scope query:read
//   POSTHOG_PROJECT_ID        the project POSTHOG_KEY on Vercel writes into
//   POSTHOG_HOST              default https://us.posthog.com
//
// "Visitors" = distinct daily-rotating anonymous ids (salted hash of day+IP+UA), so the
// number is comparable day to day but never sums across days into "unique people".

const days = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 30;
const wantPages = process.argv.includes("--pages");
const key = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
const project = process.env.POSTHOG_PROJECT_ID?.trim();
const host = (process.env.POSTHOG_HOST?.trim() || "https://us.posthog.com").replace(/\/$/, "");
if (!key || !project) {
  console.error("Set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID (see header of this script).");
  process.exit(2);
}

async function hogql(query: string): Promise<{ columns: string[]; results: unknown[][] }> {
  const res = await fetch(`${host}/api/projects/${project}/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) throw new Error(`PostHog ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return (await res.json()) as { columns: string[]; results: unknown[][] };
}

function table(columns: string[], rows: unknown[][]) {
  const cells = [columns, ...rows.map((r) => r.map((v) => String(v ?? "")))];
  const w = columns.map((_, i) => Math.max(...cells.map((r) => r[i].length)));
  for (const [n, r] of cells.entries()) {
    console.log(r.map((c, i) => c.padEnd(w[i])).join("  "));
    if (n === 0) console.log(w.map((x) => "-".repeat(x)).join("  "));
  }
}

void (async () => {
  const daily = await hogql(`
    SELECT toDate(timestamp) AS day,
           count(DISTINCT distinct_id) AS visitors,
           count() AS pageviews
    FROM events
    WHERE event = '$pageview' AND properties.$lib = 'intel-os-proxy'
      AND timestamp > now() - INTERVAL ${days} DAY
    GROUP BY day ORDER BY day`);
  console.log(`\nintel-os.org — visitors per day (last ${days} days)\n`);
  if (!daily.results.length) {
    console.log("(no page views recorded yet — capture starts with the first deploy that carries proxy.ts's page-view hook and a POSTHOG_KEY)");
  } else {
    table(daily.columns, daily.results);
    const v = daily.results.map((r) => Number(r[1]));
    console.log(`\navg ${Math.round(v.reduce((a, b) => a + b, 0) / v.length)} visitors/day · max ${Math.max(...v)} · ${daily.results.length} day(s) with traffic`);
  }
  if (wantPages) {
    const pages = await hogql(`
      SELECT properties.$pathname AS path, count(DISTINCT distinct_id) AS visitors, count() AS pageviews
      FROM events
      WHERE event = '$pageview' AND properties.$lib = 'intel-os-proxy'
        AND timestamp > now() - INTERVAL ${days} DAY
      GROUP BY path ORDER BY visitors DESC LIMIT 25`);
    console.log(`\ntop pages (last ${days} days)\n`);
    table(pages.columns, pages.results);
  }
})().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
