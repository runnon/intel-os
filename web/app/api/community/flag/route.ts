import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSessionUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Flag a community report as wrong, spam, or not publicly sourced. One flag per
// signed-in user; three distinct flags hide the report (flag_community_report()).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to flag a report." }, { status: 401, headers: PRIVATE_NO_STORE });
  }
  let id = "";
  try {
    id = String(((await req.json()) as { id?: unknown })?.id ?? "");
  } catch {
    // fall through to the id check
  }
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Invalid report." }, { status: 400, headers: PRIVATE_NO_STORE });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("flag_community_report", { p_id: id });
  if (error) {
    const own = (error.message ?? "").includes("own report");
    return NextResponse.json(
      { error: own ? "You can't flag your own report." : "Couldn't flag the report." },
      { status: own ? 400 : 502, headers: PRIVATE_NO_STORE },
    );
  }
  return NextResponse.json({ ok: true, hidden: data === true }, { headers: PRIVATE_NO_STORE });
}
