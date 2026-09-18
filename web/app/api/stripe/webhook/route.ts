import { after, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { stripe, APP_TAG } from "@/lib/stripe";
import { planFromSubscription, planOfPrice, variantOfPrice } from "@/lib/pricing";
import { track } from "@/lib/analytics";

export const runtime = "nodejs";

// Stripe subscription webhook. Verifies the signature over the RAW body, then grants or
// revokes the analyst entitlement via a guarded, idempotent SECURITY DEFINER RPC — so
// the service-role key never has to live in the web env (AGENTS.md). Events not tagged
// app=intel-os are ignored, so the account's other product never crosses over.

function planForPrice(priceId: string | null): string | null {
  return planOfPrice(priceId);
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
  event: Stripe.Event,
  fallback: { userId?: string | null; email?: string | null } = {},
) {
  if (sub.metadata?.app !== APP_TAG) return "ignored"; // not our product — ignore

  const userId = sub.metadata?.supabase_user_id ?? fallback.userId ?? null;
  if (!userId) throw new Error("subscription is missing supabase_user_id metadata");

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  let email = fallback.email ?? null;
  if (!email) {
    const cust = await stripe().customers.retrieve(customerId);
    if (!cust.deleted) email = cust.email;
  }
  if (!email) throw new Error("subscription customer is missing an email");

  const priceId = sub.items.data[0]?.price.id ?? null;
  const plan = planFromSubscription(sub.metadata?.plan, priceId);
  if (!priceId || !plan) throw new Error("subscription uses an unrecognized Analyst price");
  const currentPeriodEnd = periodEnd(sub);
  if ((sub.status === "active" || sub.status === "trialing") && !currentPeriodEnd) {
    throw new Error("active subscription is missing current_period_end");
  }
  const secret = process.env.ENTITLEMENT_GRANT_SECRET;
  if (!secret) throw new Error("ENTITLEMENT_GRANT_SECRET is not set");

  const { data, error } = await grantClient().rpc("process_stripe_entitlement_event", {
    p_secret: secret,
    p_event_id: event.id,
    p_event_created: event.created,
    p_event_type: event.type,
    p_user_id: userId,
    p_email: email,
    p_plan: plan,
    p_status: sub.status,
    p_price_id: priceId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: sub.id,
    p_current_period_end: currentPeriodEnd,
    p_cancel_at_period_end: sub.cancel_at_period_end ?? false,
    p_trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
  });
  if (error) throw new Error(`process_stripe_entitlement_event failed: ${error.message}`);
  return data as string;
}

async function cancelIfDuplicate(sub: Stripe.Subscription, outcome: string) {
  if (outcome !== "conflicting_active" || sub.status === "canceled") return;
  await stripe().subscriptions.cancel(sub.id);
  console.warn("[billing] canceled-duplicate-subscription", { subscriptionId: sub.id });
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
    console.warn("[billing] invalid-webhook-signature", e);
    return NextResponse.json({ error: "invalid webhook signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.app !== APP_TAG || !session.subscription) break;
        const sub = await stripe().subscriptions.retrieve(session.subscription as string);
        const outcome = await syncSubscription(sub, event, {
          userId: session.client_reference_id,
          email: session.customer_details?.email ?? session.customer_email,
        });
        await cancelIfDuplicate(sub, outcome);
        const userId = sub.metadata?.supabase_user_id ?? session.client_reference_id;
        const priceId = sub.items.data[0]?.price.id ?? null;
        if (userId && outcome === "applied") {
          after(() => track(userId, "subscribed", {
            plan: planForPrice(priceId),
            variant: variantOfPrice(priceId),
            price_id: priceId,
            trial: sub.status === "trialing",
          }));
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const delivered = event.data.object as Stripe.Subscription;
        // Stripe does not guarantee webhook ordering. Re-read the subscription so
        // every delivery applies its current canonical state, then let the DB reject
        // duplicate/stale event ids atomically.
        const current = await stripe().subscriptions.retrieve(delivered.id);
        const outcome = await syncSubscription(current, event);
        await cancelIfDuplicate(current, outcome);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const outcome = await syncSubscription(sub, event);
        const userId = sub.metadata?.supabase_user_id;
        if (userId && sub.metadata?.app === APP_TAG && outcome === "applied") {
          after(() => track(userId, "subscription_canceled", {
            plan: planForPrice(sub.items.data[0]?.price.id ?? null),
          }));
        }
        break;
      }
      default:
        break; // ignore everything else
    }
  } catch (e) {
    // 500 → Stripe retries with backoff.
    console.error("[billing] webhook-processing-failed", { eventId: event.id, eventType: event.type, error: e });
    return NextResponse.json({ error: "webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
