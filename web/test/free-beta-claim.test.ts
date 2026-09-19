import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn((callback: () => unknown) => { void callback(); }),
  getSessionUser: vi.fn(),
  rpc: vi.fn(),
  track: vi.fn(),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: mocks.after };
});
vi.mock("@/lib/supabase/server", () => ({
  getSessionUser: mocks.getSessionUser,
  createSupabaseServerClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/pricing", () => ({ variantFor: () => "b" }));
vi.mock("@/lib/analytics", () => ({ track: mocks.track }));

import { POST } from "@/app/api/access/claim/route";

function request(plan = "monthly") {
  return new Request("https://intel-os.example/api/access/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionUser.mockResolvedValue({
    id: "user-1",
    email: "analyst@example.gov",
    email_confirmed_at: "2026-09-18T12:00:00.000Z",
  });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
});

describe("free-beta access claim", () => {
  it("requires authentication", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires a confirmed email", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "user-1", email_confirmed_at: null });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("records price intent separately from paid conversion", async () => {
    const response = await POST(request("annual"));
    await expect(response.json()).resolves.toEqual({ ok: true, access: "free_beta", plan: "annual", firstClaim: true });
    expect(mocks.rpc).toHaveBeenCalledWith("claim_free_access", { p_plan: "annual" });
    expect(mocks.track).toHaveBeenCalledWith("user-1", "pricing_intent", {
      plan: "annual",
      variant: "b",
      access_granted: "free_beta",
    });
  });

  it("does not count a repeated claim as another price-intent conversion", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const response = await POST(request("monthly"));
    await expect(response.json()).resolves.toMatchObject({ ok: true, firstClaim: false });
    expect(mocks.track).not.toHaveBeenCalled();
  });
});
