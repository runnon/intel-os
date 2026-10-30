import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { canonicalOrSummarized, summarizeIssue, type IssueRow } from "@/lib/db";

const EVENT_A = "11111111-1111-4111-8111-111111111111";
const EVENT_B = "22222222-2222-4222-8222-222222222222";

function event(id: string) {
  return {
    id,
    category: "maritime",
    affiliation: "unknown",
    usForcesFlag: false,
    lat: 1,
    lon: 2,
    sources: [{ outlet: "Public Wire", url: "https://example.com/report" }],
  };
}

describe("issue summaries", () => {
  it("recomputes counts and sources from only the snapshot it carries", () => {
    const issue = {
      snapshot: [event(EVENT_A)],
      change_log: [
        { eventId: EVENT_A, kind: "new", summary: "current" },
        { eventId: EVENT_B, kind: "new", summary: "old" },
      ],
      tempo: { totalEvents: 99 },
      source_summary: { statement: "30-day aggregate" },
    } as unknown as IssueRow;

    const result = summarizeIssue(issue);

    expect(result.event_ids).toEqual([EVENT_A]);
    expect(result.tempo.totalEvents).toBe(1);
    expect(result.tempo.newSinceLastIssue).toBe(1);
    expect(result.change_log).toHaveLength(1);
    expect(result.source_summary).toMatchObject({ totalSources: 1, singleSourceEvents: 1 });
    expect(result.source_summary.statement).not.toContain("30-day");
    expect(result.source_summary.statement).not.toMatch(/72-hour|public window/i);
  });

  it("serves a full canonical issue verbatim (AUTO-10: reproduced unchanged)", () => {
    const canonical = {
      snapshot: [event(EVENT_A), event(EVENT_B)],
      change_log: [{ eventId: EVENT_A, kind: "new", summary: "current" }],
      tempo: { totalEvents: 2, newSinceLastIssue: 1 },
      source_summary: { statement: "Canonical worker statement." },
    } as unknown as IssueRow;

    expect(canonicalOrSummarized(canonical)).toBe(canonical);
  });

  it("recomputes aggregates for a filtered projection whose tempo describes more events", () => {
    const projected = {
      snapshot: [event(EVENT_A)],
      change_log: [],
      tempo: { totalEvents: 40, newSinceLastIssue: 3 },
      source_summary: { statement: "30-day aggregate" },
    } as unknown as IssueRow;

    const result = canonicalOrSummarized(projected);
    expect(result).not.toBe(projected);
    expect(result.tempo.totalEvents).toBe(1);
  });
});
