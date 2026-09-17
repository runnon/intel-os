import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/server";
import { getEntitlement, isActive } from "@/lib/entitlement";

export const runtime = "nodejs";

// Status for the client: is the viewer signed in, do they hold an active Analyst
// subscription, and the plan/renewal details that drive the account bar and paywall.
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ signedIn: false, active: false });
  }

  const ent = await getEntitlement();
  return NextResponse.json({
    signedIn: true,
    email: user.email ?? null,
    active: isActive(ent),
    status: ent?.status ?? "none",
    plan: ent?.plan ?? null,
    currentPeriodEnd: ent?.current_period_end ?? null,
    cancelAtPeriodEnd: ent?.cancel_at_period_end ?? false,
  });
}
