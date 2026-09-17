import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { stripe, APP_TAG } from "@/lib/stripe";

export const runtime = "nodejs";

// Stripe subscription webhook. Verifies the signature over the RAW body, then grants or
// revokes the analyst entitlement via the SECURITY DEFINER grant_entitlement() RPC — so
// the service-role key never has to live in the web env (AGENTS.md). Events not tagged
// app=intel-os are ignored, so the account's other product never crosses over.

function planForPrice(priceId: string | null): string | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ANNUAL) return "annual";
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return "monthly";
  return null;
}

function periodEnd(sub: Stripe.Subscription): string | null {
  // current_period_end lives at the top level in older API versions and on the
  // subscription item in newer ones — read whichever is present.
  const unix =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    (sub.items.data[0] as unknown as { current_period_end?: number })?.current_period_end;
  return unix ? new Date(unix * 1000).toISOString() : null;
}

function grantClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

async function syncSubscription(
  sub: Stripe.Subscription,
  fallback: { userId?: string | null; email?: string | null } = {},
) {
  if (sub.metadata?.app !== APP_TAG) return; // not our product — ignore

  const userId = sub.metadata?.supabase_user_id ?? fallback.userId ?? null;
  if (!userId) return;

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  let email = fallback.email ?? null;
  if (!email) {
    const cust = await stripe().customers.retrieve(customerId);
    if (!cust.deleted) email = cust.email;
  }
  if (!email) return; // entitlements.email is NOT NULL; can't grant without it

  const priceId = sub.items.data[0]?.price.id ?? null;
  const secret = process.env.ENTITLEMENT_GRANT_SECRET;
  if (!secret) throw new Error("ENTITLEMENT_GRANT_SECRET is not set");

  const { error } = await grantClient().rpc("grant_entitlement", {
    p_secret: secret,
    p_user_id: userId,
    p_email: email,
    p_plan: planForPrice(priceId),
    p_status: sub.status,
    p_price_id: priceId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: sub.id,
    p_current_period_end: periodEnd(sub),
    p_cancel_at_period_end: sub.cancel_at_period_end ?? false,
  });
  if (error) throw new Error(`grant_entitlement failed: ${error.message}`);
}

export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "missing signature or secret" }, { status: 400 });
  }

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    return NextResponse.json({ error: `signature: ${(e as Error).message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.app !== APP_TAG || !session.subscription) break;
        const sub = await stripe().subscriptions.retrieve(session.subscription as string);
        await syncSubscription(sub, {
          userId: session.client_reference_id,
          email: session.customer_details?.email ?? session.customer_email,
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break; // ignore everything else
    }
  } catch (e) {
    // 500 → Stripe retries with backoff.
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
