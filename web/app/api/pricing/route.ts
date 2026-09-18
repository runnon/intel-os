import { after, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { analystQuotaLimits, getViewerEntitlement } from "@/lib/entitlement";
import { pricingDisplay } from "@/lib/pricing";
import { track } from "@/lib/analytics";

export const runtime = "nodejs";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

// The signed-in user's A/B-assigned prices for the paywall, and a one-time exposure log
// (the denominator for conversion). Requires sign-in: the variant keys on the user id.
export async function GET() {
  const { user, entitlement } = await getViewerEntitlement();
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401, headers: PRIVATE_NO_STORE });
  }

  const pricing = pricingDisplay(user.id);

  // Record first exposure; the primary key makes it idempotent. A row with no error is a
  // NEW exposure, so fire the analytics event only then (keeps pricing_viewed one-per-user).
  const supabase = await createSupabaseServerClient();
  const secret = process.env.ENTITLEMENT_GRANT_SECRET;
  const { data: inserted } = secret
    ? await supabase.rpc("record_pricing_exposure", { p_secret: secret, p_variant: pricing.variant })
    : { data: false };
  if (inserted) {
    after(() => track(user.id, "pricing_viewed", {
      variant: pricing.variant,
      monthly_amount: pricing.monthly.amount,
      annual_amount: pricing.annual.amount,
    }));
  }

  return NextResponse.json(
    {
      ...pricing,
      trialEligible: !entitlement?.trial_used,
      trialDraftLimit: analystQuotaLimits().trial,
    },
    { headers: PRIVATE_NO_STORE },
  );
}
