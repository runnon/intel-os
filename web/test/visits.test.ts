import { describe, expect, it } from "vitest";
import { aorOf, isPageView, pageKind, referringDomain, visitEventFor, visitorId, type VisitInput } from "@/lib/visits";

const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/128.0 Safari/537.36";

function req(overrides: Partial<VisitInput> = {}): VisitInput {
  return {
    method: "GET",
    pathname: "/t/centcom",
    host: "intel-os.org",
    accept: "text/html,application/xhtml+xml,*/*;q=0.8",
    userAgent: BROWSER_UA,
    referer: null,
    rsc: null,
    prefetch: null,
    ip: "203.0.113.7",
    now: new Date("2026-09-24T14:00:00Z"),
    salt: "test-salt",
    ...overrides,
  };
}

describe("visits (server-side page views, decision 2026-09-24)", () => {
  it("builds a $pageview for a human document request", () => {
    const ev = visitEventFor(req());
    expect(ev).not.toBeNull();
    expect(ev!.event).toBe("$pageview");
    expect(ev!.properties).toMatchObject({
      $current_url: "https://intel-os.org/t/centcom",
      $pathname: "/t/centcom",
      $host: "intel-os.org",
      $referring_domain: "$direct",
      $lib: "intel-os-proxy",
      $process_person_profile: false,
      page_kind: "theater",
      aor: "centcom",
    });
  });

  it("ignores everything that is not a browser asking for HTML", () => {
    expect(isPageView(req({ method: "POST" }))).toBe(false);
    expect(isPageView(req({ rsc: "1" }))).toBe(false); // React Server Component fetch
    expect(isPageView(req({ prefetch: "1" }))).toBe(false); // router prefetch
    expect(isPageView(req({ accept: "text/x-component" }))).toBe(false);
    expect(isPageView(req({ accept: null }))).toBe(false);
    expect(isPageView(req({ pathname: "/api/pricing" }))).toBe(false);
    expect(isPageView(req({ pathname: "/_next/static/chunk.js" }))).toBe(false);
    expect(isPageView(req({ pathname: "/auth/callback" }))).toBe(false);
    expect(isPageView(req({ pathname: "/icon.svg" }))).toBe(false);
    expect(isPageView(req({ pathname: "/robots.txt" }))).toBe(false);
  });

  it("drops bots and empty user agents so 'visitors' means people", () => {
    expect(isPageView(req({ userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" }))).toBe(false);
    expect(isPageView(req({ userAgent: "curl/8.4.0" }))).toBe(false);
    expect(isPageView(req({ userAgent: "vercel-screenshot/1.0" }))).toBe(false);
    expect(isPageView(req({ userAgent: "" }))).toBe(false);
    expect(isPageView(req({ userAgent: null }))).toBe(false);
  });

  it("gives one person one id per UTC day, and never exposes the IP", () => {
    const a = visitorId("s", new Date("2026-09-24T01:00:00Z"), "203.0.113.7", BROWSER_UA);
    const sameDay = visitorId("s", new Date("2026-09-24T23:59:00Z"), "203.0.113.7", BROWSER_UA);
    const nextDay = visitorId("s", new Date("2026-09-25T00:01:00Z"), "203.0.113.7", BROWSER_UA);
    const otherIp = visitorId("s", new Date("2026-09-24T01:00:00Z"), "203.0.113.8", BROWSER_UA);
    const otherSalt = visitorId("t", new Date("2026-09-24T01:00:00Z"), "203.0.113.7", BROWSER_UA);
    expect(a).toBe(sameDay);
    expect(a).not.toBe(nextDay);
    expect(a).not.toBe(otherIp);
    expect(a).not.toBe(otherSalt);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toContain("203");
    const ev = visitEventFor(req())!;
    expect(JSON.stringify(ev.properties)).not.toContain("203.0.113.7");
    expect(JSON.stringify(ev.properties)).not.toContain("Mozilla");
  });

  it("classifies pages and extracts the AOR", () => {
    expect(pageKind("/")).toBe("home");
    expect(pageKind("/t/eucom")).toBe("theater");
    expect(pageKind("/t/eucom/report")).toBe("report");
    expect(pageKind("/t/eucom/history")).toBe("history");
    expect(pageKind("/i/SU-CEN-26-014")).toBe("issue");
    expect(pageKind("/i/SU-CEN-26-014/report")).toBe("issue_report");
    expect(pageKind("/analyst")).toBe("analyst");
    expect(pageKind("/signin")).toBe("auth");
    expect(pageKind("/somewhere")).toBe("other");
    expect(aorOf("/t/INDOPACOM/report")).toBe("indopacom");
    expect(aorOf("/analyst")).toBeNull();
    expect(visitEventFor(req({ pathname: "/t/centcom/" }))!.properties.$pathname).toBe("/t/centcom");
  });

  it("reduces the referrer to a domain, marking own-site and missing referrers", () => {
    expect(referringDomain("https://news.ycombinator.com/item?id=1", "intel-os.org")).toBe("news.ycombinator.com");
    expect(referringDomain("https://intel-os.org/t/centcom", "intel-os.org")).toBe("$internal");
    expect(referringDomain(null, "intel-os.org")).toBe("$direct");
    expect(referringDomain("not a url", "intel-os.org")).toBe("$direct");
  });
});
