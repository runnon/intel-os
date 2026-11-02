import { NextResponse } from "next/server";
import { AORS, type Aor } from "@intel-os/core";
import { createSupabaseServerClient, getSessionUser } from "@/lib/supabase/server";
import {
  friendlyCommunityError,
  placeReport,
  toCommunityReport,
  validateCommunityInput,
  type CommunityReport,
  type CommunityRow,
} from "@/lib/community";

export const runtime = "nodejs";

// `mine` / `flagged` depend on the viewer, so nothing here is shared-cacheable.
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Community reports for one theater (public read, last 30 days). Reads go through the
// public_community_reports() projection, which never returns the submitter's id.
export async function GET(req: Request) {
  const aor = (new URL(req.url).searchParams.get("aor") ?? "").toUpperCase();
  if (!(AORS as readonly string[]).includes(aor)) {
    return NextResponse.json({ error: "Unknown theater." }, { status: 400, headers: PRIVATE_NO_STORE });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_community_reports", { p_aor: aor as Aor });
  if (error) {
    return NextResponse.json({ error: "Couldn't load community reports." }, { status: 502, headers: PRIVATE_NO_STORE });
  }
  const reports = ((data ?? []) as CommunityRow[])
    .map(toCommunityReport)
    .filter((r): r is CommunityReport => r !== null);
  return NextResponse.json({ reports }, { headers: PRIVATE_NO_STORE });
}

// Submit a report. Sign-in required; the row is written with the user's own session
// (RLS: user_id = auth.uid()), and the database enforces the source check and rate limits.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to submit a report." }, { status: 401, headers: PRIVATE_NO_STORE });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: PRIVATE_NO_STORE });
  }
  const parsed = validateCommunityInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400, headers: PRIVATE_NO_STORE });
  }
  const v = parsed.value;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("community_reports")
    .insert({
      user_id: user.id,
      aor: v.aor,
      title: v.title,
      summary: v.summary,
      place_name: v.placeName,
      country: v.country,
      occurred_at: v.occurredAt,
      source_url: v.sourceUrl,
    })
    .select("id")
    .single();
  if (error || !data) {
    const { status, error: message } = friendlyCommunityError(error);
    return NextResponse.json({ error: message }, { status, headers: PRIVATE_NO_STORE });
  }
  const place = placeReport(v.aor, v.placeName, v.country);
  return NextResponse.json(
    { id: data.id, plottedAt: place.matchedName, precision: place.lat == null ? null : place.precision },
    { status: 201, headers: PRIVATE_NO_STORE },
  );
}

// Delete your own report (RLS limits the delete to rows you submitted).
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: PRIVATE_NO_STORE });
  }
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Invalid report." }, { status: 400, headers: PRIVATE_NO_STORE });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("community_reports").delete().eq("id", id).select("id");
  if (error) {
    return NextResponse.json({ error: "Couldn't delete the report." }, { status: 502, headers: PRIVATE_NO_STORE });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Report not found." }, { status: 404, headers: PRIVATE_NO_STORE });
  }
  return NextResponse.json({ ok: true }, { headers: PRIVATE_NO_STORE });
}
