import { createHash } from "node:crypto";

/**
 * Server-side page-view capture (decision 2026-09-24, docs/DECISIONS.md).
 *
 * The site ships NO browser analytics script (NFR-4/5: nothing a DoD network filter
 * could block), so "visitors per day" has to be derived on the server from the
 * document requests the proxy already sees. This module is the PURE part: given the
 * facts of one request it decides whether it is a human page view and, if so, builds
 * the PostHog `$pageview` event. `proxy.ts` feeds it and `lib/analytics.ts` sends it.
 *
 * Privacy: the visitor id is a salted hash of (UTC day, client IP, user agent). It
 * rotates daily, cannot be reversed to an IP, and no IP or UA is stored on the event.
 * "Visitors per day" is therefore count(DISTINCT distinct_id) per day — the id is not
 * stable across days by design (no cross-day tracking, no cookie).
 */

export interface VisitInput {
  method: string;
  pathname: string;
  host: string | null;
  accept: string | null;
  userAgent: string | null;
  referer: string | null;
  /** Next's RSC/prefetch requests carry these; they are not page views. */
  rsc: string | null;
  prefetch: string | null;
  ip: string | null;
  now: Date;
  salt: string;
}

export interface VisitEvent {
  distinctId: string;
  event: "$pageview";
  properties: Record<string, unknown>;
}

export const VISIT_LIB = "intel-os-proxy";

const BOT_UA =
  /bot|crawl|spider|slurp|preview|fetch|monitor|headless|lighthouse|pingdom|uptime|curl|wget|python-requests|go-http-client|vercel-screenshot/i;

const SKIP_PREFIXES = ["/api/", "/_next/", "/auth/", "/.well-known/"];

export type PageKind =
  | "home" | "theater" | "report" | "history" | "issue" | "issue_report" | "analyst" | "auth" | "other";

export function pageKind(pathname: string): PageKind {
  if (pathname === "/") return "home";
  if (/^\/t\/[^/]+\/report\/?$/.test(pathname)) return "report";
  if (/^\/t\/[^/]+\/history\/?$/.test(pathname)) return "history";
  if (/^\/t\/[^/]+\/?$/.test(pathname)) return "theater";
  if (/^\/i\/[^/]+\/report\/?$/.test(pathname)) return "issue_report";
  if (/^\/i\/[^/]+\/?$/.test(pathname)) return "issue";
  if (pathname.startsWith("/analyst")) return "analyst";
  if (pathname === "/signin" || pathname === "/reset-password") return "auth";
  return "other";
}

export function aorOf(pathname: string): string | null {
  const m = /^\/t\/([^/]+)/.exec(pathname);
  return m ? m[1].toLowerCase() : null;
}

export function referringDomain(referer: string | null, host: string | null): string {
  if (!referer) return "$direct";
  try {
    const h = new URL(referer).hostname.toLowerCase();
    if (host && h === host.toLowerCase()) return "$internal";
    return h;
  } catch {
    return "$direct";
  }
}

/** Daily-rotating anonymous visitor id. Same person (ip+ua) → same id within a UTC day. */
export function visitorId(salt: string, now: Date, ip: string | null, userAgent: string | null): string {
  const day = now.toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${salt}|${day}|${ip ?? ""}|${userAgent ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

/** True when the request is a human browser asking for an HTML document. */
export function isPageView(input: VisitInput): boolean {
  if (input.method.toUpperCase() !== "GET") return false;
  if (input.rsc || input.prefetch) return false;
  const p = input.pathname;
  if (SKIP_PREFIXES.some((s) => p.startsWith(s))) return false;
  if (/\.[a-z0-9]{2,5}$/i.test(p)) return false; // static asset (icon.svg, robots.txt, …)
  if (!input.accept || !input.accept.includes("text/html")) return false;
  const ua = input.userAgent?.trim() ?? "";
  if (!ua || BOT_UA.test(ua)) return false;
  return true;
}

export function visitEventFor(input: VisitInput): VisitEvent | null {
  if (!isPageView(input)) return null;
  const pathname = input.pathname.replace(/\/+$/, "") || "/";
  const host = input.host ?? "";
  return {
    distinctId: visitorId(input.salt, input.now, input.ip, input.userAgent),
    event: "$pageview",
    properties: {
      $current_url: host ? `https://${host}${pathname}` : pathname,
      $host: host,
      $pathname: pathname,
      $referring_domain: referringDomain(input.referer, input.host),
      $lib: VISIT_LIB,
      // Anonymous event: no person profile is created or merged (cheaper, and there
      // is nothing to profile — the id rotates daily by design).
      $process_person_profile: false,
      page_kind: pageKind(pathname),
      aor: aorOf(pathname),
    },
  };
}
