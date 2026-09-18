import "server-only";
import { createHash } from "node:crypto";
import type { Plan } from "@/lib/stripe";

// Price A/B experiment. A user's variant is a deterministic 50/50 split of their user id
// (stable across sessions, decided server-side so the client can't pick the cheaper one).
// Variant B is only live when its price IDs are configured; otherwise everyone gets A.
export type PriceVariant = "a" | "b";

type PlanInfo = { priceEnv: string; label: string; amount: number };

const VARIANTS: Record<PriceVariant, Record<Plan, PlanInfo>> = {
  a: {
    monthly: { priceEnv: "STRIPE_PRICE_MONTHLY", label: "$20 / month", amount: 20 },
    annual: { priceEnv: "STRIPE_PRICE_ANNUAL", label: "$190 / year", amount: 190 },
  },
  b: {
    monthly: { priceEnv: "STRIPE_PRICE_MONTHLY_B", label: "$10 / month", amount: 10 },
    annual: { priceEnv: "STRIPE_PRICE_ANNUAL_B", label: "$95 / year", amount: 95 },
  },
};

// Bump this to re-randomize buckets for a fresh experiment.
const EXPERIMENT_SALT = "pricing-experiment-2026-09";

function rawVariant(userId: string): PriceVariant {
  const digest = createHash("sha256").update(EXPERIMENT_SALT + userId).digest();
  return (digest[0] & 1) === 0 ? "a" : "b";
}

/**
 * True when the price experiment is running. Either the variant-B Stripe prices are
 * configured (real charging), or PRICING_EXPERIMENT=on forces it — used in free-beta mode,
 * where we still A/B the displayed price but don't charge, so no Stripe price ids exist.
 */
export function experimentLive(): boolean {
  if (process.env.PRICING_EXPERIMENT === "on") return true;
  return Boolean(process.env.STRIPE_PRICE_MONTHLY_B && process.env.STRIPE_PRICE_ANNUAL_B);
}

/** The user's assigned variant, collapsing to 'a' whenever the experiment is off. */
export function variantFor(userId: string): PriceVariant {
  return experimentLive() ? rawVariant(userId) : "a";
}

/** The Stripe price id to actually charge — the authoritative server-side selection. */
export function priceIdFor(userId: string, plan: Plan): string {
  const variant = variantFor(userId);
  const id = process.env[VARIANTS[variant][plan].priceEnv];
  if (!id) throw new Error(`Stripe price for variant ${variant}/${plan} is not configured`);
  return id;
}

/** Which experiment variant a Stripe price id belongs to (what the user actually paid). */
export function variantOfPrice(priceId: string | null): PriceVariant | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_MONTHLY || priceId === process.env.STRIPE_PRICE_ANNUAL) return "a";
  if (priceId === process.env.STRIPE_PRICE_MONTHLY_B || priceId === process.env.STRIPE_PRICE_ANNUAL_B) return "b";
  return null;
}

/** Billing cadence for either experiment variant's Stripe price. */
export function planOfPrice(priceId: string | null): Plan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_MONTHLY || priceId === process.env.STRIPE_PRICE_MONTHLY_B) return "monthly";
  if (priceId === process.env.STRIPE_PRICE_ANNUAL || priceId === process.env.STRIPE_PRICE_ANNUAL_B) return "annual";
  return null;
}

/** Prefer immutable subscription metadata so retired price env vars do not break webhooks. */
export function planFromSubscription(metadataPlan: string | null | undefined, priceId: string | null): Plan | null {
  if (metadataPlan === "monthly" || metadataPlan === "annual") return metadataPlan;
  return planOfPrice(priceId);
}

/** Display labels for the paywall, for the user's assigned variant. */
export function pricingDisplay(userId: string) {
  const variant = variantFor(userId);
  return {
    variant,
    monthly: { label: VARIANTS[variant].monthly.label, amount: VARIANTS[variant].monthly.amount },
    annual: { label: VARIANTS[variant].annual.label, amount: VARIANTS[variant].annual.amount },
  };
}
