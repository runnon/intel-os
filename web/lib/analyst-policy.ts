export const DATA_TIMEOUT_MS = 10_000;
export const MODEL_TIMEOUT_MS = 60_000;
export const DRAFT_DISCLAIMER =
  "MACHINE-GENERATED DRAFT — reported facts only, not a published product, carries no analytic judgement.";
// No classification markings ("UNCLASSIFIED", "(U)") — this is an open-source product,
// not a document produced under any classification system (docs/DECISIONS.md 2026-09-22).
export const MARKING_LINE = "OPEN SOURCES ONLY · NOT AN OFFICIAL GOVERNMENT PRODUCT";

const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 6_000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function parseChatMessages(body: unknown): ChatMessage[] | null {
  if (!body || typeof body !== "object" || !("messages" in body) || !Array.isArray(body.messages)) {
    return null;
  }

  const messages = body.messages.slice(-MAX_MESSAGES);
  if (
    messages.length === 0 ||
    messages.some(
      (message) =>
        !message ||
        typeof message !== "object" ||
        !("role" in message) ||
        (message.role !== "user" && message.role !== "assistant") ||
        !("content" in message) ||
        typeof message.content !== "string" ||
        message.content.trim().length === 0 ||
        message.content.length > MAX_MESSAGE_CHARS,
    ) ||
    messages[messages.length - 1].role !== "user"
  ) {
    return null;
  }

  return messages as ChatMessage[];
}

export function invalidMessagesError(): string {
  return `Send 1–${MAX_MESSAGES} messages, ending with a user message of ${MAX_MESSAGE_CHARS.toLocaleString()} characters or fewer.`;
}

export function enforceDraftMarkings(text: string): string {
  let marked = text.trim();
  if (!marked.includes(DRAFT_DISCLAIMER)) {
    marked = `*${DRAFT_DISCLAIMER}*\n\n${marked}`;
  }
  if (!marked.includes(MARKING_LINE)) {
    marked = `${marked}\n\n---\n\n${MARKING_LINE}`;
  }
  return marked;
}
