import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Refreshes the Supabase auth session on every request and writes the rotated
// cookies back onto the response, so server components/route handlers see a live user.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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
  // Only routes that can consume or refresh an authenticated entitlement.
  matcher: ["/t/:path*", "/i/:path*", "/analyst/:path*", "/signin", "/auth/:path*", "/api/analyst", "/api/entitlement", "/api/pricing", "/api/stripe/:path*"],
};
