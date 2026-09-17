import { NextResponse } from "next/server";
import { getSessionUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { stripe, billingPortalUrl, APP_TAG, type Plan } from "@/lib/stripe";
import { priceIdFor } from "@/lib/pricing";

export const runtime = "nodejs";

// Starts a hosted Stripe Checkout (mode: subscription) for the signed-in analyst, at the
// user's A/B-assigned price (chosen server-side — the client only names the cadence).
// Returns a checkout.stripe.com URL to redirect to — no Stripe script loads in-app (NFR-4/5).
// If the user already subscribes, returns the billing-portal URL instead of a second sub.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user?.email) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { plan?: Plan };
  const plan: Plan = body.plan === "annual" ? "annual" : "monthly";

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const supabase = await createSupabaseServerClient();
  const { data: ent } = await supabase
    .from("entitlements")
    .select("status, stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Already subscribing → don't create a duplicate; send them to manage billing.
  const alreadyActive = ent?.status === "active" || ent?.status === "trialing";
  if (alreadyActive && ent?.stripe_customer_id) {
    const url = await billingPortalUrl(ent.stripe_customer_id, `${origin}/analyst`);
    return NextResponse.json({ url, portal: true });
  }

  let price: string;
  try {
    price = priceIdFor(user.id, plan);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const meta = { app: APP_TAG, supabase_user_id: user.id };

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: user.id,
    ...(ent?.stripe_customer_id
      ? { customer: ent.stripe_customer_id }
      : { customer_email: user.email }),
    success_url: `${origin}/analyst?checkout=success`,
    cancel_url: `${origin}/analyst?checkout=cancelled`,
    allow_promotion_codes: true,
    metadata: meta,
    subscription_data: { metadata: meta },
  });

  return NextResponse.json({ url: session.url });
}
