import { after, NextResponse } from "next/server";
import { getSessionUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { variantFor } from "@/lib/pricing";
import { track } from "@/lib/analytics";

export const runtime = "nodejs";

// Free-beta access: after verified onboarding, the user chooses a displayed price and
// receives beta access without a card or charge. This records price intent separately
// from real Stripe subscription conversion.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: "Confirm your email before choosing Analyst access." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { plan?: "monthly" | "annual" };
  const plan = body.plan === "annual" ? "annual" : "monthly";
  const variant = variantFor(user.id);

  const supabase = await createSupabaseServerClient();
  const { data: firstClaim, error } = await supabase.rpc("claim_free_access", { p_plan: plan });
  if (error) {
    console.error("[access] claim-failed", error);
    return NextResponse.json({ error: "Could not grant access. Try again." }, { status: 500 });
  }

  // This is a price-intent/fake-door signal, not a completed purchase. Keeping
  // the event name honest prevents beta clicks from inflating paid conversion.
  if (firstClaim) {
    after(() => track(user.id, "pricing_intent", { plan, variant, access_granted: "free_beta" }));
  }
  return NextResponse.json({ ok: true, access: "free_beta", plan, firstClaim: Boolean(firstClaim) });
}
