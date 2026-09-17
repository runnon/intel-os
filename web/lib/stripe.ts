import "server-only";
import Stripe from "stripe";

// Server-only Stripe client. The secret key lives only in the web server env
// (never NEXT_PUBLIC, never shipped to the client, never on the map surface).
let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key);
  }
  return client;
}

// The Analyst tier's billing cadence. The actual price id is chosen per-user by the
// A/B experiment in lib/pricing.ts (server-authoritative). Price objects are isolated in
// the shared Stripe account by metadata app=intel-os (scripts/create-stripe-products.mjs).
export type Plan = "monthly" | "annual";

// Tags every intel-os object so the webhook (and reporting) can tell this product's
// payments apart from the other product sharing the account.
export const APP_TAG = "intel-os";

/** A Stripe Billing Portal URL for an existing customer (cancel, update card, invoices). */
export async function billingPortalUrl(customerId: string, returnUrl: string): Promise<string> {
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}
