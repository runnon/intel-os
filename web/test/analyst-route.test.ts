import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createMessage: vi.fn(),
  makeModel: vi.fn(),
  getAnalystUser: vi.fn(),
  rpc: vi.fn(),
  consumeAnalystQuota: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));
vi.mock("@/lib/model", () => ({ makeModel: mocks.makeModel }));
vi.mock("@/lib/entitlement", () => ({
  getAnalystUser: mocks.getAnalystUser,
  consumeAnalystQuota: mocks.consumeAnalystQuota,
}));

import {
  DATA_TIMEOUT_MS,
  DRAFT_DISCLAIMER,
  MARKING_LINE,
  MODEL_TIMEOUT_MS,
  enforceDraftMarkings,
  parseChatMessages,
} from "@/lib/analyst-policy";
import { POST } from "@/app/api/analyst/route";

const issue = {
  aor: "CENTCOM",
  info_cutoff: "2026-09-17T12:00:00.000Z",
  serial: "CE-SOU-26-001",
  snapshot: [
    {
      id: "event-1",
      occurredAt: "2026-09-17T10:00:00.000Z",
      placeName: "Gulf of Oman",
      country: "Oman",
      category: "maritime",
      affiliation: "unknown",
      confOrigin: "high",
      confActor: "low",
      usForcesFlag: false,
      title: "Reported maritime event",
      summary: "A publicly reported maritime event occurred.",
      sources: [{ outlet: "Example News", url: "https://example.com/report" }],
    },
  ],
  source_summary: { statement: "One public report." },
  window_start: "2026-09-17T00:00:00.000Z",
};

function mockIssueQuery(data: unknown[] | null, error: unknown = null) {
  const query = { abortSignal: vi.fn() };
  query.abortSignal.mockResolvedValue({ data, error });
  mocks.rpc.mockReturnValue(query);
  // No .from(): drafting must read through the public projection RPC, not the raw table.
  mocks.createSupabaseServerClient.mockResolvedValue({ rpc: mocks.rpc });
}

function analystRequest(messages: unknown = [{ role: "user", content: "Draft a short CENTCOM summary." }]) {
  return new Request("http://localhost/api/analyst", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://public.example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-anon-key");
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.getAnalystUser.mockResolvedValue({ id: "user-1", email: "analyst@example.com" });
  mocks.consumeAnalystQuota.mockResolvedValue("ok");
  mockIssueQuery([issue]);
  mocks.makeModel.mockReturnValue({
    client: { messages: { create: mocks.createMessage } },
    model: "test-model",
  });
  mocks.createMessage.mockResolvedValue({
    stop_reason: "end_turn",
    content: [{ type: "text", text: "Reported event." }],
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("analyst route", () => {
  it("validates and limits conversation input", () => {
    expect(parseChatMessages(null)).toBeNull();
    expect(parseChatMessages({ messages: [{ role: "assistant", content: "not user-led" }] })).toBeNull();
    expect(parseChatMessages({ messages: [{ role: "user", content: "x".repeat(6_001) }] })).toBeNull();

    const messages = Array.from({ length: 13 }, (_, index) => ({
      role: "user" as const,
      content: `message ${index}`,
    }));
    expect(parseChatMessages({ messages })).toHaveLength(12);
  });

  it("enforces draft and provenance markings in model output", () => {
    const marked = enforceDraftMarkings("Reported event.");
    expect(marked).toContain(DRAFT_DISCLAIMER);
    expect(marked).toContain("Reported event.");
    expect(marked).toContain(MARKING_LINE);

    const alreadyMarked = `*${DRAFT_DISCLAIMER}*\n\nReported event.\n\n${MARKING_LINE}`;
    expect(enforceDraftMarkings(alreadyMarked)).toBe(alreadyMarked);
  });

  it("requires sign-in (free) before drafting, and never mentions a subscription", async () => {
    mocks.getAnalystUser.mockResolvedValue(null);

    const response = await POST(analystRequest());

    expect(response.status).toBe(401);
    const payload = await response.json() as { error: string; code: string };
    expect(payload.code).toBe("sign_in_required");
    expect(payload.error).not.toMatch(/subscri|trial|upgrade|\$/i);
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });

  it("lets a signed-in user with no entitlement row draft", async () => {
    // getAnalystUser only knows about identity; there is no entitlement lookup at all.
    const response = await POST(analystRequest());

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("public_latest_issues");
    expect(mocks.createMessage).toHaveBeenCalledTimes(1);
  });

  it("treats a pre-migration subscription_required quota result as transient, not a paywall", async () => {
    mocks.consumeAnalystQuota.mockResolvedValue("subscription_required");

    const response = await POST(analystRequest());

    expect(response.status).toBe(503);
    const payload = await response.json() as { error: string };
    expect(payload.error).not.toMatch(/subscri|trial|upgrade/i);
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });

  it("enforces the monthly drafting allowance before calling the model", async () => {
    mocks.consumeAnalystQuota.mockResolvedValue("monthly_limit");

    const response = await POST(analystRequest());

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ code: "monthly_limit" });
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });

  it("returns a draft and bounds the model request below the function lifetime", async () => {
    const response = await POST(analystRequest());

    expect(response.status).toBe(200);
    const payload = await response.json() as { text: string };
    expect(payload.text).toContain(DRAFT_DISCLAIMER);
    expect(payload.text).toContain("Reported event.");
    expect(payload.text).toContain(MARKING_LINE);
    expect(mocks.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ model: "test-model", max_tokens: 4000 }),
      expect.objectContaining({ maxRetries: 0, timeout: MODEL_TIMEOUT_MS, signal: expect.any(AbortSignal) }),
    );
    const modelRequest = mocks.createMessage.mock.calls[0][0];
    expect(modelRequest.system).toContain("do not predict");
    expect(modelRequest.messages[0].content).toContain("affiliation:unknown");
    expect(modelRequest.messages[0].content).toContain("https://example.com/report");
    expect(DATA_TIMEOUT_MS + MODEL_TIMEOUT_MS).toBeLessThan(75_000);
    expect(MODEL_TIMEOUT_MS).toBeLessThan(120_000);
  });

  it("explain mode answers in plain language about the theater on screen only", async () => {
    mockIssueQuery([issue, { ...issue, aor: "EUCOM", serial: "SU-EUR-26-001", snapshot: [{ ...issue.snapshot[0], id: "eu-1", title: "Baltic event" }] }]);
    const response = await POST(new Request("http://localhost/api/analyst", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "What's happening?" }], mode: "explain", aor: "CENTCOM" }),
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as { text: string };
    expect(payload.text).toContain(MARKING_LINE);
    expect(payload.text).not.toContain(DRAFT_DISCLAIMER);
    const modelRequest = mocks.createMessage.mock.calls[0][0];
    expect(modelRequest.system).toContain("Plain language");
    expect(modelRequest.system).toContain("Do not predict");
    expect(modelRequest.max_tokens).toBe(1200);
    expect(modelRequest.messages[0].content).toContain("link: /t/centcom?ev=event-1");
    expect(modelRequest.messages[0].content).not.toContain("Baltic event");
  });

  it("explain mode still requires sign-in", async () => {
    mocks.getAnalystUser.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/analyst", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }], mode: "explain", aor: "CENTCOM" }),
    }));
    expect(response.status).toBe(401);
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });

  it("returns a retryable error when published data is unavailable", async () => {
    mockIssueQuery(null, new Error("database unavailable"));

    const response = await POST(analystRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Published issue data is temporarily unavailable. Try again shortly.",
    });
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });

  it("returns a clear timeout instead of waiting for the function to be killed", async () => {
    mocks.createMessage.mockRejectedValue(new Error("Request timed out"));

    const response = await POST(analystRequest());

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error: "Drafting timed out before the model responded. Try again or narrow the request.",
    });
  });

  it("returns a non-success status when the model declines the request", async () => {
    mocks.createMessage.mockResolvedValue({ stop_reason: "refusal", content: [] });

    const response = await POST(analystRequest());

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "The model declined this request." });
  });

  it("reports missing model credentials as configuration failure", async () => {
    mocks.createMessage.mockRejectedValue(new Error("Could not resolve AWS credentials"));

    const response = await POST(analystRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Analyst drafting is not configured on this server (model backend credentials unavailable).",
    });
  });
});
