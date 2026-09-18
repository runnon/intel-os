import { after, NextResponse } from "next/server";
import { getViewerEntitlement } from "@/lib/entitlement";
import { stripe, billingPortalUrl, siteUrl, APP_TAG, TRIAL_DAYS, type Plan } from "@/lib/stripe";
import { priceIdFor, variantFor } from "@/lib/pricing";
import { track } from "@/lib/analytics";

export const runtime = "nodejs";

// Starts a hosted Stripe Checkout (mode: subscription) for the signed-in analyst, at the
// user's A/B-assigned price (chosen server-side — the client only names the cadence).
// Returns a checkout.stripe.com URL to redirect to — no Stripe script loads in-app (NFR-4/5).
// If the user already subscribes, returns the billing-portal URL instead of a second sub.
export async function POST(request: Request) {
  const { user, entitlement: ent } = await getViewerEntitlement();
  if (!user?.email) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { plan?: Plan };
  const plan: Plan = body.plan === "annual" ? "annual" : "monthly";

  let origin: string;
  try {
    origin = siteUrl();
  } catch (error) {
    console.error("[billing] invalid-site-url", error);
    return NextResponse.json({ error: "Billing is not configured on this server." }, { status: 503 });
  }

  // Already subscribing → don't create a duplicate; send them to manage billing.
  const terminal = new Set(["canceled", "inactive", "incomplete_expired"]);
  if (ent?.stripe_customer_id && !terminal.has(ent.status)) {
    try {
      const url = await billingPortalUrl(ent.stripe_customer_id, `${origin}/analyst`);
      return NextResponse.json({ url, portal: true });
    } catch (error) {
      console.error("[billing] portal-create-failed", error);
      return NextResponse.json({ error: "Billing management is temporarily unavailable." }, { status: 502 });
    }
  }

  let price: string;
  try {
    price = priceIdFor(user.id, plan);
  } catch (e) {
    console.error("[billing] price-configuration-failed", e);
    return NextResponse.json({ error: "Billing is not configured on this server." }, { status: 503 });
  }

  // Persist the cadence on the subscription itself. Price IDs can be retired or
  // rotated later; immutable metadata keeps lifecycle webhooks interpretable.
  const meta = { app: APP_TAG, supabase_user_id: user.id, plan };

  try {
    const trialEligible = !ent?.trial_used;
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
      payment_method_collection: "always",
      metadata: meta,
      subscription_data: {
        metadata: meta,
        ...(trialEligible
          ? {
              trial_period_days: TRIAL_DAYS,
              trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } },
            }
          : {}),
      },
    }, {
      // Stripe retains idempotency results for at least 24 hours. This prevents
      // double-clicks/retries from creating a second subscription session.
      idempotencyKey: `intel-os-checkout:${user.id}:${price}:${trialEligible ? "trial" : "paid"}:${new Date().toISOString().slice(0, 10)}`,
    });
    if (!session.url) throw new Error("Stripe Checkout did not return a redirect URL");

    after(() => track(user.id, "checkout_started", {
      plan,
      variant: variantFor(user.id),
      trial: trialEligible,
    }));
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[billing] checkout-create-failed", error);
    return NextResponse.json({ error: "Checkout is temporarily unavailable. Try again shortly." }, { status: 502 });
  }
}
