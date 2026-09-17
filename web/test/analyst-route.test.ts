import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createMessage: vi.fn(),
  makeModel: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/model", () => ({ makeModel: mocks.makeModel }));

import {
  DATA_TIMEOUT_MS,
  DRAFT_DISCLAIMER,
  MARKING_LINE,
  MODEL_TIMEOUT_MS,
  POST,
  enforceDraftMarkings,
  parseChatMessages,
} from "@/app/api/analyst/route";

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
  const query = {
    abortSignal: vi.fn(),
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.abortSignal.mockResolvedValue({ data, error });
  mocks.createClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
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

  it("enforces draft and classification markings in model output", () => {
    const marked = enforceDraftMarkings("Reported event.");
    expect(marked).toContain(DRAFT_DISCLAIMER);
    expect(marked).toContain("Reported event.");
    expect(marked).toContain(MARKING_LINE);

    const alreadyMarked = `*${DRAFT_DISCLAIMER}*\n\nReported event.\n\n${MARKING_LINE}`;
    expect(enforceDraftMarkings(alreadyMarked)).toBe(alreadyMarked);
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
