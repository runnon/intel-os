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
const MONTHLY_LOOKUP = "intel_os_analyst_monthly";
const ANNUAL_LOOKUP = "intel_os_analyst_annual";

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

async function ensurePrice(productId, lookupKey, amount, interval) {
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0];
  return stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: amount,
    recurring: { interval },
    lookup_key: lookupKey,
    metadata: { app: APP, tier: "analyst" },
  });
}

const product = await ensureProduct();
const monthly = await ensurePrice(product.id, MONTHLY_LOOKUP, 2000, "month"); // $20/mo
const annual = await ensurePrice(product.id, ANNUAL_LOOKUP, 19000, "year"); // $190/yr

console.log("\n✓ Stripe objects ready (account-shared, tagged app=intel-os)\n");
console.log(`Product:  ${product.id}  (${product.name})`);
console.log(`\nAdd these to Vercel env (and web/.env.local for dev):\n`);
console.log(`STRIPE_PRICE_MONTHLY=${monthly.id}`);
console.log(`STRIPE_PRICE_ANNUAL=${annual.id}`);
