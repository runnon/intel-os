import { after, type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { track } from "@/lib/analytics";
import { visitEventFor } from "@/lib/visits";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Paths whose handlers consume or refresh an authenticated entitlement. The Supabase
// session refresh below runs ONLY for these (unchanged behaviour); the wider matcher
// exists for page-view capture.
const AUTH_PATH = /^\/(t|i|analyst|auth|api\/(analyst|access|entitlement|pricing|stripe))(\/|$)|^\/(signin|reset-password)\/?$/;

// Server-side page-view capture (docs/DECISIONS.md 2026-09-24): the site ships no
// browser analytics script (NFR-4/5), so "visitors per day" is derived here from the
// document requests the proxy already sees. Pure decision in lib/visits.ts; delivery
// through lib/analytics.ts, which is a no-op unless POSTHOG_KEY/POSTHOG_HOST are set.
function capturePageView(request: NextRequest) {
  const salt = process.env.VISITOR_HASH_SALT?.trim() || process.env.POSTHOG_KEY?.trim();
  if (!salt) return;
  const h = request.headers;
  const ev = visitEventFor({
    method: request.method,
    pathname: request.nextUrl.pathname,
    host: h.get("host"),
    accept: h.get("accept"),
    userAgent: h.get("user-agent"),
    referer: h.get("referer"),
    rsc: h.get("rsc"),
    prefetch: h.get("next-router-prefetch"),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip"),
    now: new Date(),
    salt,
  });
  if (!ev) return;
  after(() => track(ev.distinctId, ev.event, ev.properties));
}

// Refreshes the Supabase auth session on every request and writes the rotated
// cookies back onto the response, so server components/route handlers see a live user.
export async function proxy(request: NextRequest) {
  capturePageView(request);

  let response = NextResponse.next({ request });
  if (!AUTH_PATH.test(request.nextUrl.pathname)) return response;

  // Anonymous map traffic has no session to refresh. Keeping it off the auth
  // network path preserves the public picture when the identity service is slow.
  const hasAuthCookie = request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
  if (!hasAuthCookie) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Every route except Next internals and static files, so page views are counted
  // on every page. The auth refresh above still gates itself on AUTH_PATH.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
