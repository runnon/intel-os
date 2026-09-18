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
 * The public RPC already removes old event payloads. Recompute summaries here so
 * a 30-day aggregate is never presented as if it described the public 72-hour slice.
 */
export function summarizePublicIssue(issue: IssueRow): IssueRow {
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
        ? `Public 72-hour picture derives from ${totalSources} report(s) across ${outletTotal} outlet(s): ${outletSummary}.`
        : "No events fall inside the public 72-hour window.",
    },
  };
}

/** Latest public 72-hour issue per AOR — powers the command selector tiles. */
export async function latestIssues(): Promise<IssueRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_latest_issues");
  if (error) throw new Error(error.message);
  return ((data ?? []) as IssueRow[]).map(summarizePublicIssue);
}

/** Current issue: full canonical snapshot for Analyst, 72-hour projection for Public. */
export async function latestIssueFor(aor: Aor, hasArchiveAccess = false): Promise<IssueRow | null> {
  const supabase = await createSupabaseServerClient();
  if (hasArchiveAccess) {
    const { data, error } = await supabase
      .from("issues")
      .select("*")
      .eq("aor", aor)
      .order("issue_number", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return (data?.[0] as IssueRow | undefined) ?? null;
  }

  const { data, error } = await supabase.rpc("public_latest_issue", { p_aor: aor });
  if (error) throw new Error(error.message);
  const issue = (data?.[0] as IssueRow | undefined) ?? null;
  return issue ? summarizePublicIssue(issue) : null;
}

/** Serial snapshot: full for Analyst; recent, filtered snapshot for Public. */
export async function issueBySerial(serial: string, hasArchiveAccess = false): Promise<IssueRow | null> {
  const supabase = await createSupabaseServerClient();
  if (hasArchiveAccess) {
    const { data, error } = await supabase.from("issues").select("*").eq("serial", serial).limit(1);
    if (error) throw new Error(error.message);
    return (data?.[0] as IssueRow | undefined) ?? null;
  }

  const { data, error } = await supabase.rpc("public_issue_by_serial", { p_serial: serial });
  if (error) throw new Error(error.message);
  const issue = (data?.[0] as IssueRow | undefined) ?? null;
  return issue ? summarizePublicIssue(issue) : null;
}

export async function issueArchive(aor: Aor): Promise<IssueMetadata[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_issue_archive", { p_aor: aor });
  if (error) throw new Error(error.message);
  return (data ?? []) as IssueMetadata[];
}

export async function issueMetadataBySerial(serial: string): Promise<IssueMetadata | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_issue_metadata", { p_serial: serial });
  if (error) throw new Error(error.message);
  return (data?.[0] as IssueMetadata | undefined) ?? null;
}
