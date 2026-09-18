import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn((callback: () => unknown) => { void callback(); }),
  getViewerEntitlement: vi.fn(),
  checkoutCreate: vi.fn(),
  billingPortalUrl: vi.fn(),
  track: vi.fn(),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: mocks.after };
});
vi.mock("@/lib/entitlement", () => ({ getViewerEntitlement: mocks.getViewerEntitlement }));
vi.mock("@/lib/stripe", () => ({
  APP_TAG: "intel-os",
  TRIAL_DAYS: 7,
  siteUrl: () => "https://intel-os.example",
  billingPortalUrl: mocks.billingPortalUrl,
  stripe: () => ({ checkout: { sessions: { create: mocks.checkoutCreate } } }),
}));
vi.mock("@/lib/pricing", () => ({
  priceIdFor: () => "price_monthly",
  variantFor: () => "a",
}));
vi.mock("@/lib/analytics", () => ({ track: mocks.track }));

import { POST } from "@/app/api/stripe/checkout/route";

function request(plan = "monthly") {
  return new Request("https://intel-os.example/api/stripe/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getViewerEntitlement.mockResolvedValue({
    user: { id: "user-1", email: "analyst@example.gov" },
    entitlement: null,
    active: false,
  });
  mocks.checkoutCreate.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
  mocks.billingPortalUrl.mockResolvedValue("https://billing.stripe.test/portal");
});

describe("subscription checkout", () => {
  it("starts a card-backed seven-day trial with an idempotency key", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        payment_method_collection: "always",
        subscription_data: expect.objectContaining({
          trial_period_days: 7,
          trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        }),
      }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining("intel-os-checkout:user-1:price_monthly:trial:") }),
    );
  });

  it("does not grant a second trial after one has been used", async () => {
    mocks.getViewerEntitlement.mockResolvedValue({
      user: { id: "user-1", email: "analyst@example.gov" },
      entitlement: { status: "canceled", trial_used: true, stripe_customer_id: "cus_1" },
      active: false,
    });

    await POST(request("annual"));

    const params = mocks.checkoutCreate.mock.calls[0][0];
    expect(params.subscription_data).not.toHaveProperty("trial_period_days");
    expect(params.customer).toBe("cus_1");
  });

  it("sends non-terminal subscriptions to billing management instead of duplicating them", async () => {
    mocks.getViewerEntitlement.mockResolvedValue({
      user: { id: "user-1", email: "analyst@example.gov" },
      entitlement: { status: "past_due", trial_used: true, stripe_customer_id: "cus_1" },
      active: false,
    });

    const response = await POST(request());

    await expect(response.json()).resolves.toMatchObject({ portal: true });
    expect(mocks.checkoutCreate).not.toHaveBeenCalled();
  });
});
