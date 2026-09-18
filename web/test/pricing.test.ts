import { afterEach, describe, expect, it, vi } from "vitest";

// pricing.ts guards itself with `server-only`; neutralize it for the node test runner.
vi.mock("server-only", () => ({}));

import {
  variantFor,
  experimentLive,
  planFromSubscription,
  planOfPrice,
  priceIdFor,
  pricingDisplay,
  variantOfPrice,
} from "@/lib/pricing";

afterEach(() => vi.unstubAllEnvs());

describe("price A/B experiment", () => {
  it("collapses everyone to variant A when the B prices are unset", () => {
    vi.stubEnv("STRIPE_PRICE_MONTHLY_B", "");
    vi.stubEnv("STRIPE_PRICE_ANNUAL_B", "");
    expect(experimentLive()).toBe(false);
    expect(variantFor("whoever")).toBe("a");
    expect(pricingDisplay("whoever").monthly.amount).toBe(20);
  });

  it("assigns a stable, roughly balanced 50/50 split when live", () => {
    vi.stubEnv("STRIPE_PRICE_MONTHLY_B", "price_mb");
    vi.stubEnv("STRIPE_PRICE_ANNUAL_B", "price_ab");
    expect(experimentLive()).toBe(true);

    // stable per user
    expect(variantFor("user-123")).toBe(variantFor("user-123"));

    // balanced across many ids
    let a = 0;
    for (let i = 0; i < 1000; i++) if (variantFor(`u${i}`) === "a") a += 1;
    expect(a).toBeGreaterThan(400);
    expect(a).toBeLessThan(600);
  });

  it("charges the price id of the user's assigned variant", () => {
    vi.stubEnv("STRIPE_PRICE_MONTHLY", "price_ma");
    vi.stubEnv("STRIPE_PRICE_MONTHLY_B", "price_mb");
    vi.stubEnv("STRIPE_PRICE_ANNUAL_B", "price_ab");

    let userA = "";
    let userB = "";
    for (let i = 0; i < 100 && (!userA || !userB); i++) {
      const id = `pick${i}`;
      if (variantFor(id) === "a") userA = id;
      else userB = id;
    }
    expect(priceIdFor(userA, "monthly")).toBe("price_ma");
    expect(priceIdFor(userB, "monthly")).toBe("price_mb");
  });

  it("maps both A and B prices back to the correct plan and variant", () => {
    vi.stubEnv("STRIPE_PRICE_MONTHLY", "price_ma");
    vi.stubEnv("STRIPE_PRICE_ANNUAL", "price_aa");
    vi.stubEnv("STRIPE_PRICE_MONTHLY_B", "price_mb");
    vi.stubEnv("STRIPE_PRICE_ANNUAL_B", "price_ab");

    expect(planOfPrice("price_ma")).toBe("monthly");
    expect(planOfPrice("price_mb")).toBe("monthly");
    expect(planOfPrice("price_aa")).toBe("annual");
    expect(planOfPrice("price_ab")).toBe("annual");
    expect(variantOfPrice("price_mb")).toBe("b");
  });

  it("keeps webhook plan mapping stable after a price id is retired", () => {
    expect(planFromSubscription("annual", "price_no_longer_configured")).toBe("annual");
    expect(planFromSubscription("invalid", "price_no_longer_configured")).toBeNull();
  });
});
