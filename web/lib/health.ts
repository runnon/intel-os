// Freshness of the published picture, for /api/health and the scheduled staleness
// check (.github/workflows/staleness.yml). Audit 2026-10-30: a cycle that died before
// recording anything (10-22) and a worker running stale code (09-17 → 10-30) both went
// unnoticed because nothing watched the output.

export interface FreshnessRow {
  aor: string;
  serial: string | null;
  published_at: string | null;
  info_cutoff: string | null;
  last_run_at: string | null;
  last_run_ok: boolean | null;
}

export interface AorHealth {
  aor: string;
  serial: string | null;
  publishedAt: string | null;
  ageHours: number | null;
  lastRunAt: string | null;
  lastRunOk: boolean | null;
  problem: string | null;
}

/** Cron runs every 12 h; 14 h allows a slow cycle, and one missed cycle trips it. */
export const MAX_ISSUE_AGE_HOURS = 14;

export function assessFreshness(rows: FreshnessRow[], now: Date, maxAgeHours = MAX_ISSUE_AGE_HOURS) {
  const aors: AorHealth[] = rows.map((r) => {
    const ageHours = r.published_at
      ? Math.round(((now.getTime() - new Date(r.published_at).getTime()) / 3_600_000) * 10) / 10
      : null;
    let problem: string | null = null;
    if (ageHours == null) problem = "no published issue";
    else if (ageHours > maxAgeHours) problem = `latest issue is ${ageHours}h old (limit ${maxAgeHours}h)`;
    else if (r.last_run_ok === false) problem = "latest ingest run failed";
    return {
      aor: r.aor,
      serial: r.serial,
      publishedAt: r.published_at,
      ageHours,
      lastRunAt: r.last_run_at,
      lastRunOk: r.last_run_ok,
      problem,
    };
  });
  return { ok: aors.length > 0 && aors.every((a) => a.problem === null), checkedAt: now.toISOString(), maxAgeHours, aors };
}
