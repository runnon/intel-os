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

// The Analyst tier's two recurring prices, isolated in the shared Stripe account by
// metadata app=intel-os. Price IDs come from scripts/create-stripe-products.mjs.
export type Plan = "monthly" | "annual";

export function priceFor(plan: Plan): string {
  const id = plan === "annual" ? process.env.STRIPE_PRICE_ANNUAL : process.env.STRIPE_PRICE_MONTHLY;
  if (!id) throw new Error(`Stripe price for '${plan}' plan is not configured`);
  return id;
}

// Tags every intel-os object so the webhook (and reporting) can tell this product's
// payments apart from the other product sharing the account.
export const APP_TAG = "intel-os";
