// Create (idempotently) the intel-os Analyst product and its two recurring prices in
// the shared Stripe account, tagged metadata app=intel-os so this product's payments
// stay separable from the other product in the account.
//
// Run from the web workspace so the `stripe` dep resolves:
//   cd web && STRIPE_SECRET_KEY=rk_live_... node scripts/create-stripe-products.mjs
//
// Use a RESTRICTED key with write access to Products and Prices. Prints the price IDs
// to paste into STRIPE_PRICE_MONTHLY / STRIPE_PRICE_ANNUAL.

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error("Set STRIPE_SECRET_KEY (a restricted key with Products+Prices write).");
  process.exit(1);
}
const stripe = new Stripe(key);

const APP = "intel-os";
// Variant A = control ($20/$190); Variant B = experiment ($10/$95). Set the B env vars
// only when you want the A/B price test live (lib/pricing.ts falls back to A otherwise).
const PRICES = [
  { env: "STRIPE_PRICE_MONTHLY", lookup: "intel_os_analyst_monthly", amount: 2000, interval: "month", variant: "a" },
  { env: "STRIPE_PRICE_ANNUAL", lookup: "intel_os_analyst_annual", amount: 19000, interval: "year", variant: "a" },
  { env: "STRIPE_PRICE_MONTHLY_B", lookup: "intel_os_analyst_monthly_b", amount: 1000, interval: "month", variant: "b" },
  { env: "STRIPE_PRICE_ANNUAL_B", lookup: "intel_os_analyst_annual_b", amount: 9500, interval: "year", variant: "b" },
];

async function ensureProduct() {
  const found = await stripe.products.search({
    query: `metadata['app']:'${APP}' AND metadata['tier']:'analyst' AND active:'true'`,
  });
  if (found.data[0]) return found.data[0];
  return stripe.products.create({
    name: "Theater Picture — Analyst",
    description: "Analyst drafting workspace subscription (intel-os / Theater Picture).",
    metadata: { app: APP, tier: "analyst" },
  });
}

async function ensurePrice(productId, { lookup, amount, interval, variant }) {
  const existing = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0];
  return stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: amount,
    recurring: { interval },
    lookup_key: lookup,
    metadata: { app: APP, tier: "analyst", variant },
  });
}

const product = await ensureProduct();

console.log("\n✓ Stripe objects ready (account-shared, tagged app=intel-os)\n");
console.log(`Product:  ${product.id}  (${product.name})`);
console.log(`\nAdd these to Vercel env (and web/.env.local for dev):\n`);
for (const spec of PRICES) {
  const price = await ensurePrice(product.id, spec);
  console.log(`${spec.env}=${price.id}`);
}
console.log(`\n(Set the _B vars only when you want the $10 vs $20 A/B test live.)`);
