import { makeModel } from "@/lib/model";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

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
  upgrade "unknown" attribution. Flag single-source reporting as not confirmed.
- Cite events by their serial numbers [n] and name the issue serial and info cut-off in
  every draft. State clearly when data does not cover a question (e.g., an AOR with no
  coverage) — never invent events.
- Begin every draft with the line: "MACHINE-GENERATED DRAFT — reported facts only, not a
  published product, carries no analytic judgement."
- Structure drafts like the proof-build sheet: a reported-facts overview by line of
  effort or geography, per-event references, change-from-previous, and a source summary.
Format in clean markdown.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  const configured =
    process.env.MODEL_BACKEND === "anthropic"
      ? Boolean(process.env.ANTHROPIC_API_KEY)
      : Boolean(process.env.BEDROCK_AWS_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID);
  if (!configured) {
    return NextResponse.json(
      { error: "Analyst drafting is not configured yet (no model backend credentials on the server)." },
      { status: 503 },
    );
  }
  const body = (await req.json()) as { messages: ChatMessage[] };
  const messages = (body.messages ?? []).slice(-12).filter((m) => m.role === "user" || m.role === "assistant");
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "last message must be from the user" }, { status: 400 });
  }

  // Load the latest published issue per AOR (public data, anon key).
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: issues, error } = await sb
    .from("issues")
    .select("serial, aor, info_cutoff, window_start, tempo, change_log, source_summary, snapshot")
    .order("published_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const latest = (issues ?? []).filter((i) => (seen.has(i.aor) ? false : (seen.add(i.aor), true)));

  const context = latest
    .map((i) => {
      const asc = [...(i.snapshot ?? [])].sort((a: { occurredAt: string }, b: { occurredAt: string }) =>
        a.occurredAt.localeCompare(b.occurredAt),
      );
      const rows = asc
        .map(
          (e: Record<string, unknown>, idx: number) =>
            `[${idx + 1}] ${e.occurredAt} | ${e.placeName}, ${e.country ?? "?"} | ${e.category} | affiliation:${e.affiliation} | conf:${e.confOrigin}/${e.confActor} | usForces:${e.usForcesFlag} | ${e.title} — ${e.summary}${e.usImpact ? ` | US impact: ${e.usImpact}` : ""} | sources:${(e.sources as unknown[])?.length ?? 0}`,
        )
        .join("\n");
      return `=== ${i.aor} · ${i.serial} · window ${i.window_start} → cut-off ${i.info_cutoff} ===\n${rows || "(no events in window)"}\nSource summary: ${i.source_summary?.statement ?? "n/a"}`;
    })
    .join("\n\n");

  const covered = latest.map((i) => i.aor).join(", ") || "none";

  const { client: anthropic, model } = makeModel();
  const response = await anthropic.messages.create({
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
  });

  if (response.stop_reason === "refusal") {
    return NextResponse.json({ error: "The model declined this request." }, { status: 200 });
  }
  const text = response.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return NextResponse.json({ text });
}
