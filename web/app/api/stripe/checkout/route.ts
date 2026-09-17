import { NextResponse } from "next/server";
import { getSessionUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { stripe, priceFor, APP_TAG, type Plan } from "@/lib/stripe";

export const runtime = "nodejs";

// Starts a hosted Stripe Checkout (mode: subscription) for the signed-in analyst.
// Returns a checkout.stripe.com URL to redirect to — no Stripe script loads in-app,
// keeping the deployed surface CDN-free (NFR-4/5).
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user?.email) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { plan?: Plan };
  const plan: Plan = body.plan === "annual" ? "annual" : "monthly";

  let price: string;
  try {
    price = priceFor(plan);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  // Reuse an existing Stripe customer for this user if we have one, so repeat
  // checkouts don't spawn duplicate customers.
  const supabase = await createSupabaseServerClient();
  const { data: ent } = await supabase
    .from("entitlements")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

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
