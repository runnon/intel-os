import { after, NextResponse } from "next/server";
import { getSessionUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { variantFor } from "@/lib/pricing";
import { track } from "@/lib/analytics";

export const runtime = "nodejs";

// Free-beta access: grants the analyst entitlement without charging. The paywall shows the
// (A/B) price, and this records WHICH price the user chose to "subscribe" at — the
// willingness-to-pay signal — as a `subscribed` event (free: true) so the existing
// pricing_viewed → subscribed funnel keeps measuring the experiment.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { plan?: "monthly" | "annual" };
  const plan = body.plan === "annual" ? "annual" : "monthly";
  const variant = variantFor(user.id);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("claim_free_access", { p_plan: plan });
  if (error) {
    console.error("[access] claim-failed", error);
    return NextResponse.json({ error: "Could not grant access. Try again." }, { status: 500 });
  }

  after(() => track(user.id, "subscribed", { plan, variant, free: true }));
  return NextResponse.json({ ok: true });
}
