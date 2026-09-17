import { makeModel } from "@/lib/model";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasActiveEntitlement } from "@/lib/entitlement";

export const runtime = "nodejs";
export const maxDuration = 120;
export const DATA_TIMEOUT_MS = 10_000;
export const MODEL_TIMEOUT_MS = 60_000;
export const DRAFT_DISCLAIMER =
  "MACHINE-GENERATED DRAFT — reported facts only, not a published product, carries no analytic judgement.";
export const MARKING_LINE = "UNCLASSIFIED · OPEN SOURCES ONLY · NOT AN OFFICIAL GOVERNMENT PRODUCT";

const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 6_000;

// Analyst chat: drafts theater reports on request from published issue data.
// Guardrails, in line with the product's invariants:
//  - draws ONLY on published situation-update snapshots (public data);
//  - output is a MACHINE-GENERATED DRAFT, never a published product (AUTO-5/AUTO-6:
//    judgement publishes only over a named analyst's signature — this has none);
//  - instructed to reported-facts summarization with sourcing caveats.

const SYSTEM = `You are the drafting assistant inside Theater Picture, an open-source
situational awareness system. You draft report text over PUBLISHED situation-update data
provided in this conversation. Rules, non-negotiable:
- Reported facts only. Summarize, organize, and caveat — do not predict, assess intent,
  or produce key judgements. If the user asks for judgement or prediction, explain that
  judgement publishes only in a signed assessment product, and offer a facts-only
  summary instead.
- Attribute discipline: keep each event's stated affiliation and confidence; never
  upgrade "unknown" attribution. Flag single-source reporting as "single source — not
  confirmed."
- Begin every draft with the line: "MACHINE-GENERATED DRAFT — reported facts only, not a
  published product, carries no analytic judgement." (as an italic line)
- Then, for a specific-info request, lead with a one-line **BLUF** — a direct factual
  answer to exactly what was asked — before the supporting detail.
- Structure the body like the proof-build sheet: a reported-facts overview by geography
  or line of effort, then the supporting events. For each event give the who/what/where/
  when (place + country, Zulu time, affiliation, category), its confidence (origin/actor),
  US impact if any, and CITE ITS SOURCES as markdown links using the outlet name and URL
  provided, e.g. [BBC](https://…). Reference each event by its serial [n]. Never invent
  events or sources; only use links present in the data.
- Provenance & currency: name the issue serial and info cut-off, and state plainly what is
  NOT covered (e.g. an AOR with no coverage, or a gap in the window) so the reader knows
  the boundaries. Include a short change-from-previous note and a source-summary line.
- Deep links: where a request maps to a theater, offer links to the live filtered view at
  [/t/<aor>](/t/<aor>) and the briefable export sheet at [/t/<aor>/report](/t/<aor>/report)
  (use the lowercase AOR, e.g. /t/centcom), so the reader can open the specific picture.
- End with the marking line: "UNCLASSIFIED · OPEN SOURCES ONLY · NOT AN OFFICIAL GOVERNMENT PRODUCT".
Format in clean GitHub-flavored markdown (headings, bold, bullet lists, links).`;

interface ChatMessage {
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

export async function POST(req: Request) {
  const startedAt = Date.now();

  // Paywall: the analyst drafting workspace is the Analyst-tier feature. Situation
  // updates stay free; drafting requires an active subscription.
  if (!(await hasActiveEntitlement())) {
    return NextResponse.json(
      { error: "The analyst workspace requires an active subscription.", code: "subscription_required" },
      { status: 402 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const messages = parseChatMessages(body);
  if (!messages) {
    return NextResponse.json(
      { error: `Send 1–${MAX_MESSAGES} messages, ending with a user message of ${MAX_MESSAGE_CHARS.toLocaleString()} characters or fewer.` },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Analyst drafting is not configured on this server (published-data connection unavailable)." },
      { status: 503 },
    );
  }

  console.info("[analyst] request-start", { messageCount: messages.length });

  // Load the latest published issue per AOR (public data, anon key).
  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  let issues;
  try {
    const result = await sb
      .from("issues")
      .select("serial, aor, info_cutoff, window_start, tempo, change_log, source_summary, snapshot")
      .order("published_at", { ascending: false })
      .limit(30)
      .abortSignal(AbortSignal.any([req.signal, AbortSignal.timeout(DATA_TIMEOUT_MS)]));
    if (result.error) throw result.error;
    issues = result.data;
  } catch (error) {
    console.error("[analyst] published-data-failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      elapsedMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Published issue data is temporarily unavailable. Try again shortly." },
      { status: 503 },
    );
  }

  const seen = new Set<string>();
  const latest = (issues ?? []).filter((i) => (seen.has(i.aor) ? false : (seen.add(i.aor), true)));

  const context = latest
    .map((i) => {
      const asc = [...(i.snapshot ?? [])].sort((a: { occurredAt: string }, b: { occurredAt: string }) =>
        a.occurredAt.localeCompare(b.occurredAt),
      );
      const rows = asc
        .map((e: Record<string, unknown>, idx: number) => {
          const src = (e.sources as { outlet?: string; url?: string }[] | undefined) ?? [];
          const srcList = src
            .slice(0, 3)
            .map((s) => `${s.outlet ?? "source"} <${s.url ?? ""}>`)
            .join("; ");
          return `[${idx + 1}] ${e.occurredAt} | ${e.placeName}, ${e.country ?? "?"} | ${e.category} | affiliation:${e.affiliation} | conf:${e.confOrigin}/${e.confActor} | usForces:${e.usForcesFlag} | ${e.title} — ${e.summary}${e.usImpact ? ` | US impact: ${e.usImpact}` : ""} | sources(${src.length}): ${srcList || "none"}`;
        })
        .join("\n");
      return `=== ${i.aor} · ${i.serial} · window ${i.window_start} → cut-off ${i.info_cutoff} ===\n${rows || "(no events in window)"}\nSource summary: ${i.source_summary?.statement ?? "n/a"}`;
    })
    .join("\n\n");

  const covered = latest.map((i) => i.aor).join(", ") || "none";
  const eventCount = latest.reduce((count, issue) => count + (issue.snapshot?.length ?? 0), 0);

  console.info("[analyst] context-ready", {
    aorCount: latest.length,
    eventCount,
    contextChars: context.length,
    elapsedMs: Date.now() - startedAt,
  });

  const { client: anthropic, model } = makeModel();
  let response;
  try {
    response = await anthropic.messages.create({
      model,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [
        {
          role: "user" as const,
          content: `Published data available (AORs with coverage: ${covered}; all other AORs have NO coverage — say so if asked about them):\n\n${context}`,
        },
        { role: "assistant" as const, content: "Understood. I have the published issue data and will draft facts-only report text on request, citing event numbers and issue serials." },
        ...messages,
      ],
    }, {
      maxRetries: 0,
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(MODEL_TIMEOUT_MS)]),
      timeout: MODEL_TIMEOUT_MS,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[analyst] model-failed", {
      errorName: e instanceof Error ? e.name : "UnknownError",
      elapsedMs: Date.now() - startedAt,
      model,
    });
    if (/timeout|timed out|aborted/i.test(msg) || (e instanceof DOMException && e.name === "TimeoutError")) {
      return NextResponse.json(
        { error: "Drafting timed out before the model responded. Try again or narrow the request." },
        { status: 504 },
      );
    }
    if (/credential|authentication|api[- ]?key|resolve|expired token|security token/i.test(msg)) {
      return NextResponse.json(
        { error: "Analyst drafting is not configured on this server (model backend credentials unavailable)." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Model request failed. Try again shortly." }, { status: 502 });
  }

  if (response.stop_reason === "refusal") {
    return NextResponse.json({ error: "The model declined this request." }, { status: 422 });
  }
  const text = response.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  if (!text.trim()) {
    return NextResponse.json({ error: "The model returned an empty draft. Try the request again." }, { status: 502 });
  }
  const markedText = enforceDraftMarkings(text);

  console.info("[analyst] request-complete", {
    elapsedMs: Date.now() - startedAt,
    model,
    outputChars: markedText.length,
  });
  return NextResponse.json({ text: markedText });
}
