export interface AnalystMessage {
  role: "user" | "assistant";
  content: string;
}

export const ANALYST_CLIENT_TIMEOUT_MS = 75_000;

interface DraftResponse {
  text?: unknown;
  error?: unknown;
}

interface DraftRequestOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class AnalystDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalystDraftError";
  }
}

export async function requestAnalystDraft(
  messages: AnalystMessage[],
  options: DraftRequestOptions = {},
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? ANALYST_CLIENT_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl("/api/analyst", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload: DraftResponse = {};
    try {
      payload = raw ? JSON.parse(raw) as DraftResponse : {};
    } catch {
      throw new AnalystDraftError(`Drafting service returned an unreadable response (${response.status}).`);
    }

    if (!response.ok || typeof payload.error === "string") {
      throw new AnalystDraftError(
        typeof payload.error === "string" && payload.error.trim()
          ? payload.error
          : `Drafting failed (${response.status}). Try again.`,
      );
    }
    if (typeof payload.text !== "string" || !payload.text.trim()) {
      throw new AnalystDraftError("Drafting completed without report text. Try again.");
    }

    return payload.text;
  } catch (error) {
    if (timedOut) {
      throw new AnalystDraftError("Drafting timed out before the model responded. Try again or narrow the request.");
    }
    if (error instanceof AnalystDraftError) throw error;
    throw new AnalystDraftError("Unable to reach the drafting service. Check the connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}
