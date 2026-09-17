import { NextResponse } from "next/server";
import { getSessionUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { pricingDisplay } from "@/lib/pricing";

export const runtime = "nodejs";

// The signed-in user's A/B-assigned prices for the paywall, and a one-time exposure log
// (the denominator for conversion). Requires sign-in: the variant keys on the user id.
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const pricing = pricingDisplay(user.id);

  // Record first exposure; idempotent (primary key on user_id), best-effort.
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("pricing_exposures")
    .insert({ user_id: user.id, variant: pricing.variant })
    .then(
      () => undefined,
      () => undefined, // already exposed, or transient — never block the paywall
    );

  return NextResponse.json(pricing);
}
