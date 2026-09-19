import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { analystQuotaLimits, isActive, type Entitlement } from "@/lib/entitlement";

function entitlement(overrides: Partial<Entitlement> = {}): Entitlement {
  return {
    status: "active",
    plan: "monthly",
    price_id: "price_test",
    current_period_end: "2099-01-01T00:00:00.000Z",
    cancel_at_period_end: false,
    trial_used: true,
    trial_end: null,
    stripe_customer_id: "cus_test",
    stripe_subscription_id: "sub_test",
    ...overrides,
  };
}

describe("subscription entitlement", () => {
  it("allows active and trialing periods that have not expired", () => {
    expect(isActive(entitlement())).toBe(true);
    expect(isActive(entitlement({ status: "trialing" }))).toBe(true);
  });

  it("fails closed for missing, invalid, expired, or non-active periods", () => {
    expect(isActive(entitlement({ current_period_end: null }))).toBe(false);
    expect(isActive(entitlement({ current_period_end: "not-a-date" }))).toBe(false);
    expect(isActive(entitlement({ current_period_end: "2020-01-01T00:00:00.000Z" }))).toBe(false);
    expect(isActive(entitlement({ status: "past_due" }))).toBe(false);
  });

  it("bounds configurable drafting limits", () => {
    vi.stubEnv("ANALYST_TRIAL_REQUEST_LIMIT", "0");
    vi.stubEnv("ANALYST_MONTHLY_REQUEST_LIMIT", "999999");
    vi.stubEnv("ANALYST_MINUTE_REQUEST_LIMIT", "invalid");
    expect(analystQuotaLimits()).toEqual({ trial: 1, monthly: 10_000, minute: 5 });
    vi.unstubAllEnvs();
  });
});
