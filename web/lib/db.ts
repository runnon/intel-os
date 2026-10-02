import "server-only";
import type { Aor, SituationUpdate, TheaterEvent } from "@intel-os/core";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface IssueRow {
  id: string;
  serial: string;
  aor: Aor;
  issue_number: number;
  product_type: string;
  window_start: string;
  info_cutoff: string;
  published_at: string;
  event_ids: string[];
  tempo: SituationUpdate['tempo'];
  change_log: SituationUpdate['changeLog'];
  source_summary: SituationUpdate['sourceSummary'];
  disclaimer: string;
  snapshot: TheaterEvent[];
}

export interface IssueMetadata {
  serial: string;
  aor: Aor;
  issue_number: number;
  published_at: string;
  info_cutoff: string;
  tempo: SituationUpdate["tempo"];
}

/**
 * Recompute an issue's tempo/change-log/source summary from the snapshot it actually
 * carries. Used for the merged "All theaters" view, and as a safety net when a
 * projection's snapshot does not match its canonical aggregates (e.g. a database that
 * still serves the retired 72-hour public projection) so counts never describe events
 * the viewer isn't shown.
 */
export function summarizeIssue(issue: IssueRow): IssueRow {
  const snapshot = issue.snapshot ?? [];
  const ids = new Set(snapshot.map((event) => event.id));
  const outletCounts: Record<string, number> = {};
  let totalSources = 0;
  let singleSourceEvents = 0;
  const byCategory: Record<string, number> = {};
  const byAffiliation: Record<string, number> = {};

  for (const event of snapshot) {
    byCategory[event.category] = (byCategory[event.category] ?? 0) + 1;
    byAffiliation[event.affiliation] = (byAffiliation[event.affiliation] ?? 0) + 1;
    totalSources += event.sources.length;
    if (event.sources.length === 1) singleSourceEvents += 1;
    for (const source of event.sources) {
      outletCounts[source.outlet] = (outletCounts[source.outlet] ?? 0) + 1;
    }
  }

  const outletSummary = Object.entries(outletCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([outlet, count]) => `${outlet} (${count})`)
    .join(", ");
  const outletTotal = Object.keys(outletCounts).length;
  const changeLog = (issue.change_log ?? []).filter((entry) => ids.has(entry.eventId));

  return {
    ...issue,
    event_ids: snapshot.map((event) => event.id),
    change_log: changeLog,
    tempo: {
      totalEvents: snapshot.length,
      newSinceLastIssue: changeLog.filter((entry) => entry.kind === "new").length,
      byCategory,
      byAffiliation,
      usForcesEvents: snapshot.filter((event) => event.usForcesFlag).length,
      unplottedEvents: snapshot.filter((event) => event.lat == null || event.lon == null).length,
    },
    source_summary: {
      outletCounts,
      totalSources,
      singleSourceEvents,
      statement: outletTotal
        ? `Picture derives from ${totalSources} report(s) across ${outletTotal} outlet(s): ${outletSummary}.`
        : "No events fall inside this window.",
    },
  };
}

/**
 * A canonical issue row is served verbatim (AUTO-10: reproduced unchanged). The worker
 * builds tempo from the same event array it snapshots, so a mismatch means the row is a
 * filtered projection and its aggregates must be recomputed.
 */
export function canonicalOrSummarized(issue: IssueRow): IssueRow {
  const snapshotLength = issue.snapshot?.length ?? 0;
  return issue.tempo?.totalEvents === snapshotLength ? issue : summarizeIssue(issue);
}

/** Latest issue per AOR (full canonical snapshot) — powers the command selector tiles. */
export async function latestIssues(): Promise<IssueRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_latest_issues");
  if (error) throw new Error(error.message);
  return ((data ?? []) as IssueRow[]).map(canonicalOrSummarized);
}

/**
 * Combined "All theaters" view: every AOR's latest issue merged onto one global map
 * (the map fits to the combined extent).
 */
export async function combinedLatestIssue(): Promise<IssueRow | null> {
  const issues = await latestIssues();
  if (!issues.length) return null;
  const base = issues.reduce((a, b) => (b.info_cutoff > a.info_cutoff ? b : a));
  const snapshot = issues.flatMap((i) => i.snapshot ?? []);
  const infoCutoff = issues.reduce((m, i) => (i.info_cutoff > m ? i.info_cutoff : m), issues[0].info_cutoff);
  const windowStart = issues.reduce((m, i) => (i.window_start < m ? i.window_start : m), issues[0].window_start);
  return summarizeIssue({
    ...base,
    serial: "ALL-THEATERS",
    snapshot,
    change_log: issues.flatMap((i) => i.change_log ?? []),
    info_cutoff: infoCutoff,
    window_start: windowStart,
  });
}

/**
 * Current issue for an AOR, free for everyone. Read through a SECURITY DEFINER
 * projection with the anon key — the raw issues table is not readable by anon and no
 * service-role key lives in the web app.
 */
export async function latestIssueFor(aor: Aor): Promise<IssueRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_latest_issue", { p_aor: aor });
  if (error) throw new Error(error.message);
  const issue = (data?.[0] as IssueRow | undefined) ?? null;
  return issue ? canonicalOrSummarized(issue) : null;
}

/** Any published issue by serial (AUTO-10), free for everyone. */
export async function issueBySerial(serial: string): Promise<IssueRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_issue_by_serial", { p_serial: serial });
  if (error) throw new Error(error.message);
  const issue = (data?.[0] as IssueRow | undefined) ?? null;
  return issue ? canonicalOrSummarized(issue) : null;
}

export async function issueArchive(aor: Aor): Promise<IssueMetadata[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_issue_archive", { p_aor: aor });
  if (error) throw new Error(error.message);
  return (data ?? []) as IssueMetadata[];
}
