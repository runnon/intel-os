import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assessFreshness, type FreshnessRow } from "@/lib/health";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

// Public health probe: 200 when every command published within the limit and its last
// ingest run succeeded, 503 otherwise (with the reason per command). Point any uptime
// monitor at it; .github/workflows/staleness.yml checks it hourly.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_issue_freshness");
  if (error) {
    return NextResponse.json({ ok: false, error: "freshness probe unavailable" }, { status: 503, headers: NO_STORE });
  }
  const report = assessFreshness((data ?? []) as FreshnessRow[], new Date());
  return NextResponse.json(report, { status: report.ok ? 200 : 503, headers: NO_STORE });
}
