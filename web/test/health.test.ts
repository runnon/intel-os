import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { assessFreshness, type FreshnessRow } from "@/lib/health";
import { GET } from "@/app/api/health/route";

const NOW = new Date("2026-10-30T12:30:00Z");
const row = (over: Partial<FreshnessRow> = {}): FreshnessRow => ({
  aor: "CENTCOM",
  serial: "SU-CEN-26-097",
  published_at: "2026-10-30T00:20:00Z",
  info_cutoff: "2026-10-30T00:01:00Z",
  last_run_at: "2026-10-30T00:20:00Z",
  last_run_ok: true,
  ...over,
});

describe("assessFreshness", () => {
  it("is ok when every command published within the limit", () => {
    const r = assessFreshness([row(), row({ aor: "EUCOM" })], NOW);
    expect(r.ok).toBe(true);
    expect(r.aors[0].ageHours).toBe(12.2);
  });

  it("flags a missed cycle", () => {
    const r = assessFreshness([row(), row({ aor: "EUCOM", published_at: "2026-10-29T12:20:00Z" })], NOW);
    expect(r.ok).toBe(false);
    expect(r.aors[1].problem).toMatch(/24.2h old/);
  });

  it("flags a failed last run and a command with no issue", () => {
    expect(assessFreshness([row({ last_run_ok: false })], NOW).aors[0].problem).toBe("latest ingest run failed");
    expect(assessFreshness([row({ published_at: null })], NOW).aors[0].problem).toBe("no published issue");
  });

  it("is not ok with no rows", () => {
    expect(assessFreshness([], NOW).ok).toBe(false);
  });
});

describe("/api/health", () => {
  it("returns 503 when the probe is unavailable", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "x" } }) });
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("returns 200 for a fresh picture", async () => {
    const fresh = row({ published_at: new Date(Date.now() - 3_600_000).toISOString() });
    mocks.createSupabaseServerClient.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: [fresh], error: null }) });
    const res = await GET();
    expect(res.status).toBe(200);
  });
});
