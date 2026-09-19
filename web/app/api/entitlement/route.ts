import { NextResponse } from "next/server";
import { getViewerEntitlement } from "@/lib/entitlement";

export const runtime = "nodejs";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

// Status for the client: is the viewer signed in, do they hold an active Analyst
// subscription, and the plan/renewal details that drive the account bar and paywall.
export async function GET() {
  const { user, entitlement: ent, active } = await getViewerEntitlement();
  if (!user) {
    return NextResponse.json({ signedIn: false, active: false }, { headers: PRIVATE_NO_STORE });
  }

  return NextResponse.json(
    {
      signedIn: true,
      email: user.email ?? null,
      active,
      status: ent?.status ?? "none",
      plan: ent?.plan ?? null,
      accessKind: ent?.price_id === "free_beta" ? "free_beta" : ent ? "paid" : "none",
      currentPeriodEnd: ent?.current_period_end ?? null,
      cancelAtPeriodEnd: ent?.cancel_at_period_end ?? false,
      trialEnd: ent?.trial_end ?? null,
    },
    { headers: PRIVATE_NO_STORE },
  );
}
