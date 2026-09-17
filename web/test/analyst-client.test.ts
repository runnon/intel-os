import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AnalystDraftError,
  requestAnalystDraft,
  type AnalystMessage,
} from "@/lib/analyst-client";

const messages: AnalystMessage[] = [{ role: "user", content: "Draft a short CENTCOM summary." }];

afterEach(() => {
  vi.useRealTimers();
});

describe("requestAnalystDraft", () => {
  it("returns report text from a successful response", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ text: "MACHINE-GENERATED DRAFT" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(requestAnalystDraft(messages, { fetchImpl })).resolves.toBe("MACHINE-GENERATED DRAFT");
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/analyst",
      expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) }),
    );
  });

  it("surfaces a structured API error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "Published issue data is temporarily unavailable." }), { status: 503 }),
    );

    await expect(requestAnalystDraft(messages, { fetchImpl })).rejects.toThrow(
      "Published issue data is temporarily unavailable.",
    );
  });

  it("rejects an empty successful response", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ text: "" }), { status: 200 }),
    );

    await expect(requestAnalystDraft(messages, { fetchImpl })).rejects.toThrow(
      "Drafting completed without report text.",
    );
  });

  it("surfaces an error payload even when an upstream response uses status 200", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "The model declined this request." }), { status: 200 }),
    );

    await expect(requestAnalystDraft(messages, { fetchImpl })).rejects.toThrow(
      "The model declined this request.",
    );
  });

  it("aborts and reports requests that exceed the client timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    );

    const result = requestAnalystDraft(messages, { fetchImpl, timeoutMs: 100 });
    const assertion = expect(result).rejects.toEqual(
      new AnalystDraftError("Drafting timed out before the model responded. Try again or narrow the request."),
    );
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });
});
