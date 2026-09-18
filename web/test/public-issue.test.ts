import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { summarizePublicIssue, type IssueRow } from "@/lib/db";

describe("public issue summaries", () => {
  it("recomputes counts and sources from only the projected snapshot", () => {
    const issue = {
      snapshot: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          category: "maritime",
          affiliation: "unknown",
          usForcesFlag: false,
          lat: 1,
          lon: 2,
          sources: [{ outlet: "Public Wire", url: "https://example.com/report" }],
        },
      ],
      change_log: [
        { eventId: "11111111-1111-4111-8111-111111111111", kind: "new", summary: "current" },
        { eventId: "22222222-2222-4222-8222-222222222222", kind: "new", summary: "old" },
      ],
      tempo: { totalEvents: 99 },
      source_summary: { statement: "30-day aggregate" },
    } as unknown as IssueRow;

    const result = summarizePublicIssue(issue);

    expect(result.event_ids).toEqual(["11111111-1111-4111-8111-111111111111"]);
    expect(result.tempo.totalEvents).toBe(1);
    expect(result.tempo.newSinceLastIssue).toBe(1);
    expect(result.change_log).toHaveLength(1);
    expect(result.source_summary).toMatchObject({ totalSources: 1, singleSourceEvents: 1 });
    expect(result.source_summary.statement).not.toContain("30-day");
  });
});
