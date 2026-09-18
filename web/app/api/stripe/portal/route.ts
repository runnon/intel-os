import { NextResponse } from "next/server";
import { getViewerEntitlement } from "@/lib/entitlement";
import { billingPortalUrl, siteUrl } from "@/lib/stripe";

export const runtime = "nodejs";

// Opens the Stripe Billing Portal for the signed-in subscriber: cancel, resume, update
// the card, or download invoices. Returns the hosted portal URL to redirect to.
export async function POST() {
  const { user, entitlement } = await getViewerEntitlement();
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  if (!entitlement?.stripe_customer_id) {
    return NextResponse.json({ error: "no billing account found" }, { status: 404 });
  }

  try {
    const url = await billingPortalUrl(entitlement.stripe_customer_id, `${siteUrl()}/analyst`);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("[billing] portal-create-failed", error);
    return NextResponse.json({ error: "Billing management is temporarily unavailable." }, { status: 502 });
  }
}
