import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
  getSessionUser: mocks.getSessionUser,
}));

import {
  friendlyCommunityError,
  placeReport,
  sourceProblem,
  toCommunityReport,
  validateCommunityInput,
  type CommunityRow,
} from "@/lib/community";
import { DELETE, GET, POST } from "@/app/api/community/route";
import { POST as FLAG } from "@/app/api/community/flag/route";

const NOW = new Date("2026-10-30T12:00:00Z");
const good = {
  aor: "centcom",
  title: "  Explosions reported near   the port ",
  summary: "Local outlet reports two blasts.",
  placeName: "Bandar Abbas",
  country: "Iran",
  occurredAt: "2026-10-30T09:15:00Z",
  sourceUrl: "https://www.example.com/news/1",
};

const row = (over: Partial<CommunityRow> = {}): CommunityRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  created_at: "2026-10-30T10:00:00Z",
  aor: "CENTCOM",
  title: "Explosions reported near the port",
  summary: "",
  place_name: "Bandar Abbas",
  country: "Iran",
  occurred_at: "2026-10-30T09:15:00Z",
  source_url: "https://www.example.com/news/1",
  mine: false,
  flagged: false,
  ...over,
});

describe("validateCommunityInput", () => {
  it("normalizes a good report", () => {
    const v = validateCommunityInput(good, NOW);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value).toMatchObject({
      aor: "CENTCOM",
      title: "Explosions reported near the port",
      occurredAt: "2026-10-30T09:15:00.000Z",
    });
  });

  it.each([
    [{ aor: "MARS" }, "aor"],
    [{ title: "short" }, "title"],
    [{ title: "x".repeat(141) }, "title"],
    [{ placeName: "" }, "placeName"],
    [{ occurredAt: "not a date" }, "occurredAt"],
    [{ occurredAt: "2026-10-30T14:00:00Z" }, "occurredAt"], // 2h in the future
    [{ occurredAt: "2026-09-01T00:00:00Z" }, "occurredAt"], // older than 30 days
    [{ summary: "x".repeat(1001) }, "summary"],
    [{ sourceUrl: "" }, "sourceUrl"],
  ])("rejects %o", (patch, field) => {
    const v = validateCommunityInput({ ...good, ...patch }, NOW);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.field).toBe(field);
  });
});

describe("sourceProblem (MARK-4 for people)", () => {
  it.each([
    "file:///etc/passwd",
    "javascript:alert(1)",
    "ftp://example.com/x",
    "http://localhost:3000/x",
    "https://10.0.0.5/report",
    "https://192.168.1.1/",
    "https://169.254.169.254/latest/meta-data",
    "https://intranet/home",
    "https://wiki.corp/page",
    "https://share.intranet/x",
    "https://user:pass@example.com/",
  ])("refuses %s", (url) => {
    expect(sourceProblem(url)).not.toBeNull();
  });

  it("accepts a public https link", () => {
    expect(sourceProblem("https://www.reuters.com/world/some-story")).toBeNull();
  });
});

describe("placement comes from the gazetteer, never the submitter", () => {
  it("plots a known place", () => {
    const p = placeReport("CENTCOM", "Bandar Abbas", "Iran");
    expect(p.lat).not.toBeNull();
    expect(p.matchedName).toBeTruthy();
  });

  it("lists an unknown place without a point when no country centroid applies", () => {
    expect(placeReport("CENTCOM", "Zzyzx Junction", "").lat).toBeNull();
  });

  it("drops rows whose link fails today's source check", () => {
    expect(toCommunityReport(row({ source_url: "http://127.0.0.1/x" }))).toBeNull();
    const r = toCommunityReport(row());
    expect(r?.sourceHost).toBe("example.com");
    expect(r).not.toHaveProperty("user_id");
  });
});

describe("friendlyCommunityError", () => {
  it("maps the insert guard's errors", () => {
    expect(friendlyCommunityError({ code: "P0429", message: "rate limit: 5 reports per hour" }).status).toBe(429);
    expect(friendlyCommunityError({ code: "23505", message: "duplicate" }).status).toBe(409);
    expect(friendlyCommunityError({ code: "23514" }).status).toBe(400);
    expect(friendlyCommunityError(null).status).toBe(502);
  });
});

describe("/api/community", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
    mocks.getSessionUser.mockReset();
  });

  it("GET reads through the public projection RPC, never the raw table", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row()], error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ rpc });
    const res = await GET(new Request("http://x/api/community?aor=centcom"));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("public_community_reports", { p_aor: "CENTCOM" });
    const body = await res.json();
    expect(body.reports).toHaveLength(1);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("GET rejects an unknown theater", async () => {
    const res = await GET(new Request("http://x/api/community?aor=mars"));
    expect(res.status).toBe(400);
  });

  it("POST requires sign-in", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const res = await POST(new Request("http://x/api/community", { method: "POST", body: JSON.stringify(good) }));
    expect(res.status).toBe(401);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("POST validates before touching the database", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "u1" });
    const res = await POST(
      new Request("http://x/api/community", { method: "POST", body: JSON.stringify({ ...good, sourceUrl: "http://localhost/x" }) }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe("sourceUrl");
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("POST inserts as the signed-in user with no coordinates", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "u1" });
    const single = vi.fn().mockResolvedValue({ data: { id: "r1" }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    mocks.createSupabaseServerClient.mockResolvedValue({ from });
    const res = await POST(
      new Request("http://x/api/community", { method: "POST", body: JSON.stringify({ ...good, lat: 1, lon: 2 }) }),
    );
    expect(res.status).toBe(201);
    expect(from).toHaveBeenCalledWith("community_reports");
    const inserted = (insert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(inserted.user_id).toBe("u1");
    expect(inserted).not.toHaveProperty("lat");
    expect(inserted).not.toHaveProperty("lon");
  });

  it("POST surfaces the rate limit as 429", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "u1" });
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: "P0429", message: "rate limit" } });
    mocks.createSupabaseServerClient.mockResolvedValue({
      from: () => ({ insert: () => ({ select: () => ({ single }) }) }),
    });
    const res = await POST(new Request("http://x/api/community", { method: "POST", body: JSON.stringify(good) }));
    expect(res.status).toBe(429);
  });

  it("DELETE requires sign-in and a valid id", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    expect((await DELETE(new Request("http://x/api/community?id=abc", { method: "DELETE" }))).status).toBe(401);
    mocks.getSessionUser.mockResolvedValue({ id: "u1" });
    expect((await DELETE(new Request("http://x/api/community?id=abc", { method: "DELETE" }))).status).toBe(400);
  });

  it("flag requires sign-in and calls the RPC", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const id = "11111111-1111-4111-8111-111111111111";
    expect((await FLAG(new Request("http://x", { method: "POST", body: JSON.stringify({ id }) }))).status).toBe(401);
    mocks.getSessionUser.mockResolvedValue({ id: "u2" });
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ rpc });
    const res = await FLAG(new Request("http://x", { method: "POST", body: JSON.stringify({ id }) }));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("flag_community_report", { p_id: id });
  });
});
