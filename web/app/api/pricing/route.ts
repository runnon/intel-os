import { NextResponse } from "next/server";
import { getSessionUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { pricingDisplay } from "@/lib/pricing";
import { track } from "@/lib/analytics";

export const runtime = "nodejs";

// The signed-in user's A/B-assigned prices for the paywall, and a one-time exposure log
// (the denominator for conversion). Requires sign-in: the variant keys on the user id.
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const pricing = pricingDisplay(user.id);

  // Record first exposure; the primary key makes it idempotent. A row with no error is a
  // NEW exposure, so fire the analytics event only then (keeps pricing_viewed one-per-user).
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("pricing_exposures")
    .insert({ user_id: user.id, variant: pricing.variant });
  if (!error) {
    await track(user.id, "pricing_viewed", {
      variant: pricing.variant,
      monthly_amount: pricing.monthly.amount,
      annual_amount: pricing.annual.amount,
    });
  }

  return NextResponse.json(pricing);
}
